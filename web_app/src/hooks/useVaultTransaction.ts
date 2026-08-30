'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIdentityToken } from '@privy-io/react-auth';
import { useSignTransaction } from '@privy-io/react-auth/solana';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';

import { buildDepositTx, buildWithdrawTx } from '@/lib/jupiter';
import { TransactionLifecycle, type TransactionPhase, type TransactionSnapshot } from '@/lib/transactionLifecycle';
import { getTransactionGate, MAINNET_TRANSACTIONS_ENABLED, SOLANA_RPC_CONFIGURED, SOLANA_RPC_URL } from '@/lib/transactionSafety';
import { useSolStreakWallet } from './useSolStreakWallet';
import { ACTIVE_NETWORK, assertRpcCluster, NETWORK_CONFIGURATION_ERROR } from '@/lib/networkProfile';
import { pendingSubmissionReferences, removePendingSubmission, savePendingSubmission } from '@/lib/submissionRecovery';

export type TxPhase = TransactionPhase;

const PHASE_LABELS: Partial<Record<TxPhase, string>> = {
  preparing: 'Preparing transaction',
  awaiting_signature: 'Awaiting signature',
  submitted: 'Submitted to Solana',
  confirming: 'Confirming on-chain',
  confirmed: 'Confirmed',
  report_pending: 'Report pending',
  failed: 'Failed',
  expired: 'Expired',
  unknown: 'Unknown — reconciliation required',
};

export function useVaultTransaction(kind: 'deposit' | 'withdraw', onSuccess?: () => void) {
  const { ready, authenticated, wallet } = useSolStreakWallet();
  const { identityToken } = useIdentityToken();
  const { signTransaction } = useSignTransaction();
  const [snapshot, setSnapshot] = useState<TransactionSnapshot>({ phase: 'idle', signature: null, error: null });
  const lifecycleRef = useRef<TransactionLifecycle<VersionedTransaction> | null>(null);
  const busy = ['preparing', 'awaiting_signature', 'submitted', 'confirming'].includes(snapshot.phase);
  const locked = busy || snapshot.phase === 'report_pending' || snapshot.phase === 'unknown';
  const connection = useMemo(() => (SOLANA_RPC_CONFIGURED ? new Connection(SOLANA_RPC_URL, 'confirmed') : null), []);

  const trackReference = useCallback(async (reference: {
    signature: string; blockhash: string; lastValidBlockHeight: number;
  }) => {
    if (!wallet) throw new Error('Wallet unavailable for submission tracking.');
    savePendingSubmission({ ...reference, wallet: wallet.address, kind, networkProfile: ACTIVE_NETWORK.name });
    const response = await fetch('/api/transactions/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(identityToken ? { 'privy-id-token': identityToken } : {}) },
      body: JSON.stringify({
        wallet: wallet.address, signature: reference.signature, kind,
        blockhash: reference.blockhash, lastValidBlockHeight: reference.lastValidBlockHeight,
        networkProfile: ACTIVE_NETWORK.name,
      }),
    });
    if (!response.ok) throw new Error('Submission tracking is pending.');
    const tracked = await response.json() as { status?: string };
    if (tracked.status && ['reconciled', 'failed', 'expired'].includes(tracked.status)) {
      removePendingSubmission(ACTIVE_NETWORK.name, reference.signature);
    }
  }, [wallet, kind, identityToken]);

  const reportSignature = useCallback(async (signature: string) => {
    if (!identityToken || !wallet) throw new Error('Session unavailable. Sign in again to report.');
    const response = await fetch('/api/streak/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'privy-id-token': identityToken },
      body: JSON.stringify({ signature, wallet: wallet.address, networkProfile: ACTIVE_NETWORK.name }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Report failed (HTTP ${response.status})`);
    }
    removePendingSubmission(ACTIVE_NETWORK.name, signature);
  }, [identityToken, wallet]);

  useEffect(() => { lifecycleRef.current = null; }, [kind, wallet, identityToken, signTransaction, connection]);

  const createLifecycle = useCallback(() => {
    if (!connection || !wallet) return null;
    const lifecycle = new TransactionLifecycle<VersionedTransaction>({
      getLatestBlockhash: async () => {
        await assertRpcCluster(connection);
        return connection.getLatestBlockhash('confirmed');
      },
      buildTransaction: (amount, lifetime) => {
        const publicKey = new PublicKey(wallet.address);
        return kind === 'deposit'
          ? buildDepositTx(publicKey, amount, connection, lifetime.blockhash)
          : buildWithdrawTx(publicKey, amount, connection, lifetime.blockhash);
      },
      signTransaction: async (transaction) => {
        const { signedTransaction } = await signTransaction({
          transaction: transaction.serialize(), wallet, chain: ACTIVE_NETWORK.chain,
        });
        return signedTransaction;
      },
      broadcastOnce: (signed) => connection.sendRawTransaction(signed, { skipPreflight: false, maxRetries: 0 }),
      trackSubmission: (signature, lifetime) => trackReference({ signature, ...lifetime }),
      confirmTransaction: (input) => connection.confirmTransaction(input, 'confirmed').then((result) => result.value),
      getSignatureStatus: (signature) => connection
        .getSignatureStatuses([signature], { searchTransactionHistory: true })
        .then((result) => result.value[0]),
      getBlockHeight: () => connection.getBlockHeight('confirmed'),
      report: kind === 'deposit' ? reportSignature : undefined,
    }, (next) => {
      setSnapshot(next);
      if (next.signature && (['failed', 'expired'].includes(next.phase) || (kind === 'withdraw' && next.phase === 'confirmed'))) {
        removePendingSubmission(ACTIVE_NETWORK.name, next.signature);
      }
      if (next.phase === 'confirmed') onSuccess?.();
    });
    lifecycleRef.current = lifecycle;
    return lifecycle;
  }, [connection, wallet, kind, signTransaction, identityToken, onSuccess, trackReference, reportSignature]);

  useEffect(() => {
    if (!ready || !authenticated || !wallet || !identityToken) return;
    let cancelled = false;
    void (async () => {
      const local = pendingSubmissionReferences(wallet.address, ACTIVE_NETWORK.name, kind);
      await Promise.all(local.map((reference) => trackReference(reference).catch(() => undefined)));
      const response = await fetch(`/api/transactions/submissions?wallet=${encodeURIComponent(wallet.address)}`, {
        headers: { 'privy-id-token': identityToken },
      });
      if (!response.ok || cancelled) return;
      const body = await response.json() as { submissions?: Array<{ signature: string; kind: string; status: string }> };
      const unresolved = body.submissions?.find((item) => item.kind === kind);
      if (!unresolved) return;
      setSnapshot({
        phase: unresolved.status === 'report_pending' || unresolved.status === 'confirmed_unreported' ? 'report_pending' : 'unknown',
        signature: unresolved.signature,
        error: unresolved.status === 'report_pending' || unresolved.status === 'confirmed_unreported'
          ? 'On-chain confirmation succeeded, but reporting is pending.'
          : 'A prior submission requires reconciliation. It will not be sent again.',
      });
    })();
    return () => { cancelled = true; };
  }, [ready, authenticated, wallet, identityToken, kind, trackReference]);

  const execute = useCallback(async (amountUsdc: number) => {
    const gate = getTransactionGate({
      featureEnabled: MAINNET_TRANSACTIONS_ENABLED && !NETWORK_CONFIGURATION_ERROR,
      privyReady: ready,
      authenticated,
      hasEmbeddedWallet: Boolean(wallet),
      rpcConfigured: SOLANA_RPC_CONFIGURED,
      amount: amountUsdc,
      pending: locked,
    });
    if (!gate.enabled) {
      setSnapshot((current) => ({ ...current, phase: 'failed', error: gate.reason }));
      return;
    }
    await (lifecycleRef.current ?? createLifecycle())?.execute(amountUsdc);
  }, [ready, authenticated, wallet, locked, createLifecycle]);

  const retryReport = useCallback(async () => {
    if (lifecycleRef.current) return lifecycleRef.current.retryReport();
    if (kind !== 'deposit' || snapshot.phase !== 'report_pending' || !snapshot.signature) return;
    try {
      await reportSignature(snapshot.signature);
      setSnapshot((current) => ({ ...current, phase: 'confirmed', error: null }));
      onSuccess?.();
    } catch (error) {
      setSnapshot((current) => ({ ...current, error: error instanceof Error ? error.message : 'Report remains pending.' }));
    }
  }, [kind, snapshot.phase, snapshot.signature, reportSignature, onSuccess]);

  return {
    phase: snapshot.phase,
    busy,
    locked,
    statusLabel: PHASE_LABELS[snapshot.phase] ?? null,
    signature: snapshot.signature,
    error: snapshot.error,
    execute,
    retryReport,
    availability: {
      featureEnabled: MAINNET_TRANSACTIONS_ENABLED,
      rpcConfigured: SOLANA_RPC_CONFIGURED,
      ready,
      authenticated,
      hasWallet: Boolean(wallet),
    },
  };
}
