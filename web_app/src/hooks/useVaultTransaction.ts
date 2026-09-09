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

export function useVaultTransaction(
  kind: 'deposit' | 'withdraw',
  walletVerified: boolean,
  onSuccess?: (signature: string) => void,
) {
  const { ready, authenticated, wallet, sessionKey } = useSolStreakWallet();
  const { identityToken } = useIdentityToken();
  const { signTransaction } = useSignTransaction();
  const [snapshot, setSnapshot] = useState<TransactionSnapshot>({ phase: 'idle', signature: null, error: null });
  const [checkingStatus, setCheckingStatus] = useState(false);
  const lifecycleRef = useRef<TransactionLifecycle<VersionedTransaction> | null>(null);
  const identityTokenRef = useRef(identityToken);
  const walletRef = useRef(wallet);
  const signTransactionRef = useRef(signTransaction);
  const onSuccessRef = useRef(onSuccess);
  identityTokenRef.current = identityToken;
  walletRef.current = wallet;
  signTransactionRef.current = signTransaction;
  onSuccessRef.current = onSuccess;
  const walletAddress = wallet?.address;
  const hasIdentityToken = Boolean(identityToken);
  const busy = ['preparing', 'awaiting_signature', 'submitted', 'confirming'].includes(snapshot.phase);
  const locked = busy || checkingStatus || snapshot.phase === 'report_pending' || snapshot.phase === 'unknown';
  const connection = useMemo(() => (SOLANA_RPC_CONFIGURED ? new Connection(SOLANA_RPC_URL, 'confirmed') : null), []);

  const trackReference = useCallback(async (reference: {
    signature: string; blockhash: string; lastValidBlockHeight: number;
  }) => {
    const token = identityTokenRef.current;
    if (!walletAddress) throw new Error('Wallet unavailable for submission tracking.');
    savePendingSubmission({ ...reference, wallet: walletAddress, kind, networkProfile: ACTIVE_NETWORK.name });
    const response = await fetch('/api/transactions/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'privy-id-token': token } : {}) },
      body: JSON.stringify({
        wallet: walletAddress, signature: reference.signature, kind,
        blockhash: reference.blockhash, lastValidBlockHeight: reference.lastValidBlockHeight,
        networkProfile: ACTIVE_NETWORK.name,
      }),
    });
    if (!response.ok) throw new Error('Submission tracking is pending.');
    const tracked = await response.json() as { status?: string };
    if (tracked.status && ['reconciled', 'failed', 'expired'].includes(tracked.status)) {
      removePendingSubmission(ACTIVE_NETWORK.name, reference.signature);
    }
  }, [walletAddress, kind]);

  const reportSignature = useCallback(async (signature: string) => {
    const token = identityTokenRef.current;
    if (!token || !walletAddress) throw new Error('Session unavailable. Sign in again to report.');
    const response = await fetch('/api/streak/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'privy-id-token': token },
      body: JSON.stringify({ signature, wallet: walletAddress, networkProfile: ACTIVE_NETWORK.name }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Report failed (HTTP ${response.status})`);
    }
    removePendingSubmission(ACTIVE_NETWORK.name, signature);
  }, [walletAddress]);

  const unresolvedForKind = useCallback(async () => {
    const token = identityTokenRef.current;
    if (!token || !walletAddress) return null;
    const response = await fetch(`/api/transactions/submissions?wallet=${encodeURIComponent(walletAddress)}`, {
      headers: { 'privy-id-token': token },
    });
    if (!response.ok) throw new Error('Transaction status is temporarily unavailable.');
    const body = await response.json() as {
      submissions?: Array<{ signature: string; kind: string; status: string }>;
    };
    return body.submissions?.find(item => item.kind === kind) ?? null;
  }, [walletAddress, kind]);

  const showUnresolved = useCallback((record: { signature: string; status: string }) => {
    const reportPending = record.status === 'report_pending' || record.status === 'confirmed_unreported';
    const unresolvedMessage = record.status === 'processing'
      ? 'A status check for this prior transaction is already in progress.'
      : record.status === 'pending' || record.status === 'submitted'
        ? 'A prior transaction is still pending on-chain. Check all transaction statuses before sending another.'
        : 'A prior submission needs a status check before another transaction can be sent.';
    setSnapshot({
      phase: reportPending ? 'report_pending' : 'unknown',
      signature: record.signature,
      error: reportPending
        ? 'On-chain confirmation succeeded, but reporting is pending.'
        : unresolvedMessage,
    });
  }, []);

  useEffect(() => {
    lifecycleRef.current = null;
    setSnapshot((current) => (
      current.phase === 'idle' && current.signature === null && current.error === null
        ? current
        : { phase: 'idle', signature: null, error: null }
    ));
  }, [kind, sessionKey]);

  useEffect(() => {
    if (walletVerified) return;
    setSnapshot((current) => (
      ['confirmed', 'failed', 'expired'].includes(current.phase)
        ? { phase: 'idle', signature: null, error: null }
        : current
    ));
  }, [walletVerified]);

  const createLifecycle = useCallback(() => {
    const activeWallet = walletRef.current;
    if (!connection || !walletAddress || !activeWallet) return null;
    const lifecycle = new TransactionLifecycle<VersionedTransaction>({
      getLatestBlockhash: async () => {
        await assertRpcCluster(connection);
        return connection.getLatestBlockhash('confirmed');
      },
      buildTransaction: (amount, lifetime) => {
        const publicKey = new PublicKey(walletAddress);
        return kind === 'deposit'
          ? buildDepositTx(publicKey, amount, connection, lifetime.blockhash)
          : buildWithdrawTx(publicKey, amount, connection, lifetime.blockhash);
      },
      signTransaction: async (transaction) => {
        const { signedTransaction } = await signTransactionRef.current({
          transaction: transaction.serialize(), wallet: activeWallet, chain: ACTIVE_NETWORK.chain,
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
      if (next.phase === 'confirmed' && next.signature) onSuccessRef.current?.(next.signature);
    });
    lifecycleRef.current = lifecycle;
    return lifecycle;
  }, [connection, walletAddress, kind, trackReference, reportSignature]);

  useEffect(() => {
    if (!ready || !authenticated || !walletAddress || !hasIdentityToken) return;
    let cancelled = false;
    void (async () => {
      const token = identityTokenRef.current;
      if (!token) return;
      const local = pendingSubmissionReferences(walletAddress, ACTIVE_NETWORK.name, kind);
      await Promise.all(local.map((reference) => trackReference(reference).catch(() => undefined)));
      const unresolved = await unresolvedForKind().catch(() => null);
      if (cancelled) return;
      if (!unresolved) return;
      showUnresolved(unresolved);
    })();
    return () => { cancelled = true; };
  }, [ready, authenticated, walletAddress, hasIdentityToken, kind, trackReference, unresolvedForKind, showUnresolved]);

  const execute = useCallback(async (amountUsdc: number) => {
    const gate = getTransactionGate({
      featureEnabled: MAINNET_TRANSACTIONS_ENABLED && !NETWORK_CONFIGURATION_ERROR,
      privyReady: ready,
      authenticated,
      hasEmbeddedWallet: Boolean(walletAddress),
      walletVerified,
      rpcConfigured: SOLANA_RPC_CONFIGURED,
      amount: amountUsdc,
      pending: locked,
    });
    if (!gate.enabled) {
      setSnapshot((current) => ({ ...current, phase: 'failed', error: gate.reason }));
      return;
    }
    await (lifecycleRef.current ?? createLifecycle())?.execute(amountUsdc);
  }, [ready, authenticated, walletAddress, walletVerified, locked, createLifecycle]);

  const retryReport = useCallback(async () => {
    if (lifecycleRef.current) return lifecycleRef.current.retryReport();
    if (kind !== 'deposit' || snapshot.phase !== 'report_pending' || !snapshot.signature) return;
    try {
      await reportSignature(snapshot.signature);
      setSnapshot((current) => ({ ...current, phase: 'confirmed', error: null }));
      onSuccessRef.current?.(snapshot.signature);
    } catch (error) {
      setSnapshot((current) => ({ ...current, error: error instanceof Error ? error.message : 'Report remains pending.' }));
    }
  }, [kind, snapshot.phase, snapshot.signature, reportSignature]);

  const checkStatus = useCallback(async () => {
    const token = identityTokenRef.current;
    if (!token || !walletAddress || checkingStatus) return;
    const previousSignature = snapshot.signature;
    setCheckingStatus(true);
    try {
      const response = await fetch('/api/transactions/submissions/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'privy-id-token': token },
        body: JSON.stringify({ wallet: walletAddress, kind }),
      });
      const summary = await response.json().catch(() => null) as {
        error?: string;
        reconciled?: number;
        failed?: number;
        expired?: number;
      } | null;
      if (!response.ok) throw new Error(summary?.error ?? 'Transaction status check failed.');

      const unresolved = await unresolvedForKind();
      if (unresolved) {
        showUnresolved(unresolved);
        return;
      }
      if (previousSignature) removePendingSubmission(ACTIVE_NETWORK.name, previousSignature);
      if ((summary?.reconciled ?? 0) > 0 && previousSignature) {
        setSnapshot({ phase: 'confirmed', signature: previousSignature, error: null });
        onSuccessRef.current?.(previousSignature);
      } else if ((summary?.failed ?? 0) > 0) {
        setSnapshot({
          phase: 'failed', signature: previousSignature,
          error: 'The previous transaction failed on-chain. You can safely start a new transaction.',
        });
      } else if ((summary?.expired ?? 0) > 0) {
        setSnapshot({
          phase: 'expired', signature: previousSignature,
          error: 'The previous transaction expired before confirmation. You can safely try again.',
        });
      } else {
        setSnapshot({ phase: 'idle', signature: null, error: null });
      }
    } catch (error) {
      setSnapshot(current => ({
        ...current,
        error: error instanceof Error ? error.message : 'Transaction status check failed.',
      }));
    } finally {
      setCheckingStatus(false);
    }
  }, [walletAddress, kind, checkingStatus, snapshot.signature, unresolvedForKind, showUnresolved]);

  return {
    phase: snapshot.phase,
    busy,
    locked,
    checkingStatus,
    statusLabel: PHASE_LABELS[snapshot.phase] ?? null,
    signature: snapshot.signature,
    error: snapshot.error,
    execute,
    retryReport,
    checkStatus,
    availability: {
      featureEnabled: MAINNET_TRANSACTIONS_ENABLED,
      rpcConfigured: SOLANA_RPC_CONFIGURED,
      ready,
      authenticated,
      hasWallet: Boolean(walletAddress),
      walletVerified,
    },
  };
}
