import { Connection } from '@solana/web3.js';

import { ACTIVE_NETWORK, assertRpcCluster } from './networkProfile';
import { verifyDepositOnChain, verifyWithdrawalOnChain } from './onchain';
import { reconcileSubmissions } from './reconciliation';
import { claimSubmissionBatch, recordVerifiedDeposit, updateClaimedSubmission } from './store';
import { cleanupConfiguredRateLimitBuckets } from './rateLimitMaintenance';
import { emitOperationalEvent, safeErrorStatus, safeRequestId } from './observability';

function configuredRpcUrl() {
  return ACTIVE_NETWORK.name === 'devnet'
    ? process.env.SOLANA_DEVNET_RPC_URL?.trim()
    : process.env.RPC_URL?.trim();
}

export async function preserveReconciliationResultDuringCleanup<T>(
  result: T,
  cleanup: () => Promise<unknown>,
  onFailure: () => void,
) {
  try { await cleanup(); } catch { onFailure(); }
  return result;
}

export async function runConfiguredReconciliation(limit: number) {
  const rpcUrl = configuredRpcUrl();
  if (!rpcUrl) throw new Error('Server RPC is not configured');
  const connection = new Connection(rpcUrl, 'confirmed');
  const requestId = safeRequestId();
  const rpcEvent = (error: unknown, routeKey: string) => emitOperationalEvent({
    event: safeErrorStatus(error) === 'rate_limited' ? 'rpc.rate_limited' : 'rpc.request.failed',
    severity: 'error', requestId, routeKey, networkProfile: ACTIVE_NETWORK.name,
    status: safeErrorStatus(error), durationMs: 0,
  });
  let summary;
  try {
    summary = await reconcileSubmissions({
    profile: ACTIVE_NETWORK.name,
    limit,
    onStaleClaim: () => emitOperationalEvent({ event: 'reconciliation.stale_claim', severity: 'warning', requestId,
      routeKey: 'reconciliation.claim', networkProfile: ACTIVE_NETWORK.name, status: 'reclaimed', durationMs: 0 }),
    store: {
      claimBatch: claimSubmissionBatch,
      updateClaimed: updateClaimedSubmission,
      reportDeposit: async (userId, deposit) => { await recordVerifiedDeposit(userId, deposit); },
    },
    chain: {
      assertCluster: async () => {
        try { await assertRpcCluster(connection); }
        catch (error) {
          emitOperationalEvent({ event: error instanceof Error && error.message.startsWith('RPC cluster mismatch')
            ? 'rpc.genesis_mismatch' : 'rpc.request.failed', severity: 'error', requestId,
          routeKey: 'reconciliation.rpc.genesis', networkProfile: ACTIVE_NETWORK.name,
          status: error instanceof Error && error.message.startsWith('RPC cluster mismatch') ? 'mismatch' : 'unavailable', durationMs: 0 });
          throw error;
        }
      },
      getSignatureStatus: async (signature) => {
        try {
          const response = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
          return response.value[0];
        } catch (error) { rpcEvent(error, 'reconciliation.rpc.status'); throw error; }
      },
      getBlockHeight: async () => {
        try { return await connection.getBlockHeight('confirmed'); }
        catch (error) { rpcEvent(error, 'reconciliation.rpc.block_height'); throw error; }
      },
      verifyDeposit: (record) => verifyDepositOnChain(record.signature, record.walletAddress),
      verifyWithdraw: async (record) => Boolean(await verifyWithdrawalOnChain(record.signature, record.walletAddress)),
    },
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'PostgresError' || error.name === 'DatabaseConfigurationError')) {
      emitOperationalEvent({ event: 'database.unavailable', severity: 'error', requestId,
        routeKey: 'reconciliation.database', networkProfile: ACTIVE_NETWORK.name, status: 'unavailable', durationMs: 0 });
    }
    throw error;
  }
  return preserveReconciliationResultDuringCleanup(summary, cleanupConfiguredRateLimitBuckets, () => {
    emitOperationalEvent({ event: 'database.unavailable', severity: 'error', requestId,
      routeKey: 'maintenance.rate_limit_cleanup', networkProfile: ACTIVE_NETWORK.name,
      status: 'cleanup_failed', durationMs: 0 });
  });
}
