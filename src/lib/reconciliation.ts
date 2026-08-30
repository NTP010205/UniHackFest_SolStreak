import { randomUUID } from 'node:crypto';

import type { VerifiedDeposit } from './onchain';
import type { SolanaNetworkProfileName } from './networkProfile';
import type { SubmissionRecord, SubmissionStatus } from './submissions';

export interface ReconciliationStatus {
  confirmationStatus?: 'processed' | 'confirmed' | 'finalized' | null;
  err: unknown;
}

export interface ReconciliationStore {
  claimBatch(profile: SolanaNetworkProfileName, limit: number, claimToken: string, now: Date): Promise<SubmissionRecord[]>;
  updateClaimed(
    record: SubmissionRecord,
    claimToken: string,
    update: { status: SubmissionStatus; nextAttemptAt: Date; errorCode?: string | null; confirmedAt?: Date | null; reportedAt?: Date | null },
  ): Promise<boolean>;
  reportDeposit(userId: string, deposit: VerifiedDeposit): Promise<void>;
}

export interface ReconciliationChain {
  assertCluster(profile: SolanaNetworkProfileName): Promise<void>;
  getSignatureStatus(signature: string): Promise<ReconciliationStatus | null>;
  getBlockHeight(): Promise<number>;
  verifyDeposit(record: SubmissionRecord): Promise<VerifiedDeposit | null>;
  verifyWithdraw(record: SubmissionRecord): Promise<boolean>;
}

export interface ReconciliationSummary {
  claimed: number;
  pending: number;
  reconciled: number;
  reportPending: number;
  failed: number;
  expired: number;
  unknown: number;
  skipped: number;
}

export function sanitizedErrorCode(kind: 'rpc' | 'verification' | 'report' | 'claim'): string {
  return `${kind}_error`;
}

function retryAt(now: Date, attemptCount: number) {
  const delay = Math.min(15 * 60_000, 5_000 * 2 ** Math.min(attemptCount, 8));
  return new Date(now.getTime() + delay);
}

export async function reconcileSubmissions(input: {
  profile: SolanaNetworkProfileName;
  limit: number;
  store: ReconciliationStore;
  chain: ReconciliationChain;
  now?: Date;
  claimToken?: string;
  onStaleClaim?: (record: SubmissionRecord) => void;
}): Promise<ReconciliationSummary> {
  const now = input.now ?? new Date();
  const token = input.claimToken ?? randomUUID();
  const summary: ReconciliationSummary = {
    claimed: 0, pending: 0, reconciled: 0, reportPending: 0,
    failed: 0, expired: 0, unknown: 0, skipped: 0,
  };
  await input.chain.assertCluster(input.profile);
  const records = await input.store.claimBatch(input.profile, Math.max(1, Math.min(input.limit, 100)), token, now);
  summary.claimed = records.length;
  for (const record of records) if (record.reclaimedStale) input.onStaleClaim?.(record);

  for (const record of records) {
    const update = async (
      status: SubmissionStatus,
      options: { errorCode?: string | null; confirmedAt?: Date | null; reportedAt?: Date | null; terminal?: boolean } = {},
    ) => input.store.updateClaimed(record, token, {
      status,
      nextAttemptAt: options.terminal ? now : retryAt(now, record.attemptCount),
      errorCode: options.errorCode ?? null,
      confirmedAt: options.confirmedAt,
      reportedAt: options.reportedAt,
    });

    try {
      const status = await input.chain.getSignatureStatus(record.signature);
      if (status?.err) {
        summary.failed += 1;
        await update('failed', { errorCode: 'onchain_transaction_failed', terminal: true });
        continue;
      }
      if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
        if (record.kind === 'withdraw') {
          if (!(await input.chain.verifyWithdraw(record))) {
            summary.failed += 1;
            await update('failed', { errorCode: 'withdraw_verification_failed', terminal: true });
            continue;
          }
          summary.reconciled += 1;
          await update('reconciled', { confirmedAt: now, terminal: true });
          continue;
        }

        const deposit = await input.chain.verifyDeposit(record);
        if (!deposit) {
          summary.failed += 1;
          await update('failed', { errorCode: 'deposit_verification_failed', terminal: true });
          continue;
        }
        try {
          await input.store.reportDeposit(record.userId, deposit);
          summary.reconciled += 1;
          await update('reconciled', { confirmedAt: now, reportedAt: now, terminal: true });
        } catch {
          summary.reportPending += 1;
          await update('report_pending', { confirmedAt: now, errorCode: sanitizedErrorCode('report') });
        }
        continue;
      }

      const blockHeight = await input.chain.getBlockHeight();
      if (blockHeight > record.lastValidBlockHeight) {
        summary.expired += 1;
        await update('expired', { errorCode: 'blockheight_expired', terminal: true });
      } else {
        summary.pending += 1;
        await update('pending');
      }
    } catch {
      summary.unknown += 1;
      await update('unknown', { errorCode: sanitizedErrorCode('rpc') });
    }
  }
  return summary;
}
