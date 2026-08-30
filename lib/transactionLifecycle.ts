export type TransactionPhase =
  | 'idle'
  | 'preparing'
  | 'awaiting_signature'
  | 'submitted'
  | 'confirming'
  | 'confirmed'
  | 'report_pending'
  | 'failed'
  | 'expired'
  | 'unknown';

export interface BlockhashLifetime {
  blockhash: string;
  lastValidBlockHeight: number;
}

export interface SignatureStatus {
  confirmationStatus?: 'processed' | 'confirmed' | 'finalized' | null;
  err: unknown;
}

export interface TransactionLifecycleDeps<TTransaction> {
  getLatestBlockhash(): Promise<BlockhashLifetime>;
  buildTransaction(amount: number, lifetime: BlockhashLifetime): Promise<TTransaction>;
  signTransaction(transaction: TTransaction): Promise<Uint8Array>;
  broadcastOnce(signedTransaction: Uint8Array): Promise<string>;
  trackSubmission?(signature: string, lifetime: BlockhashLifetime): Promise<void>;
  confirmTransaction(input: BlockhashLifetime & { signature: string }): Promise<{ err: unknown }>;
  getSignatureStatus(signature: string): Promise<SignatureStatus | null>;
  getBlockHeight(): Promise<number>;
  report?(signature: string): Promise<void>;
}

export interface TransactionSnapshot {
  phase: TransactionPhase;
  signature: string | null;
  error: string | null;
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isExpiredError(error: unknown): boolean {
  const value = message(error, '').toLowerCase();
  return value.includes('blockheight exceeded') || value.includes('blockhash not found') || value.includes('expired');
}

export class TransactionLifecycle<TTransaction> {
  private running = false;
  private snapshot: TransactionSnapshot = { phase: 'idle', signature: null, error: null };

  constructor(
    private readonly deps: TransactionLifecycleDeps<TTransaction>,
    private readonly onChange: (snapshot: TransactionSnapshot) => void = () => undefined,
  ) {}

  get state(): TransactionSnapshot {
    return this.snapshot;
  }

  private update(patch: Partial<TransactionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.onChange(this.snapshot);
  }

  async execute(amount: number): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.update({ phase: 'preparing', signature: null, error: null });

    let lifetime: BlockhashLifetime | null = null;
    let signature: string | null = null;
    try {
      lifetime = await this.deps.getLatestBlockhash();
      const transaction = await this.deps.buildTransaction(amount, lifetime);
      this.update({ phase: 'awaiting_signature' });
      const signed = await this.deps.signTransaction(transaction);

      // This is the only broadcast call in the lifecycle. Once a signature is
      // returned, every ambiguous outcome is reconciled by signature instead.
      signature = await this.deps.broadcastOnce(signed);
      this.update({ phase: 'submitted', signature });
      try {
        await this.deps.trackSubmission?.(signature, lifetime);
      } catch {
        // The client keeps a minimal local reference and continues confirming.
        // Tracking is retried with this signature; the transaction is never resent.
      }
      this.update({ phase: 'confirming' });
      const confirmation = await this.deps.confirmTransaction({ signature, ...lifetime });
      if (confirmation.err) {
        this.update({ phase: 'failed', error: 'Transaction failed on-chain.' });
        return;
      }
      await this.finishConfirmed(signature);
    } catch (error) {
      if (signature && lifetime) {
        await this.reconcile(signature, lifetime, error);
      } else {
        this.update({ phase: isExpiredError(error) ? 'expired' : 'failed', error: message(error, 'Transaction failed.') });
      }
    } finally {
      this.running = false;
    }
  }

  async retryReport(): Promise<void> {
    const signature = this.snapshot.signature;
    if (this.running || this.snapshot.phase !== 'report_pending' || !signature || !this.deps.report) return;
    this.running = true;
    try {
      await this.deps.report(signature);
      this.update({ phase: 'confirmed', error: null });
    } catch (error) {
      this.update({ phase: 'report_pending', error: message(error, 'On-chain confirmation succeeded, but reporting is still pending.') });
    } finally {
      this.running = false;
    }
  }

  private async finishConfirmed(signature: string): Promise<void> {
    this.update({ phase: 'confirmed', signature, error: null });
    if (!this.deps.report) return;
    try {
      await this.deps.report(signature);
    } catch (error) {
      this.update({
        phase: 'report_pending',
        error: message(error, 'On-chain confirmation succeeded, but reporting is pending.'),
      });
    }
  }

  private async reconcile(signature: string, lifetime: BlockhashLifetime, cause: unknown): Promise<void> {
    try {
      const status = await this.deps.getSignatureStatus(signature);
      if (status?.err) {
        this.update({ phase: 'failed', error: 'Transaction failed on-chain.' });
        return;
      }
      if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
        await this.finishConfirmed(signature);
        return;
      }
      const blockHeight = await this.deps.getBlockHeight();
      if (blockHeight > lifetime.lastValidBlockHeight || isExpiredError(cause)) {
        this.update({ phase: 'expired', error: 'The signed transaction expired before confirmation. Reconciliation found no confirmation.' });
        return;
      }
      this.update({
        phase: 'unknown',
        error: 'Confirmation timed out and the signature is not yet visible. Reconciliation is required; do not submit again.',
      });
    } catch {
      this.update({
        phase: 'unknown',
        error: 'Unable to reconcile the submitted signature. Do not submit again until its on-chain status is known.',
      });
    }
  }
}
