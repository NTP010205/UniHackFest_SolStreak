import { describe, expect, it, vi } from 'vitest';

import { reconcileSubmissions, sanitizedErrorCode, type ReconciliationChain, type ReconciliationStore } from './reconciliation';
import type { SubmissionRecord, SubmissionStatus } from './submissions';

const now = new Date('2026-08-29T00:00:00Z');
function record(overrides: Partial<SubmissionRecord> = {}): SubmissionRecord {
  return {
    networkProfile: 'devnet', signature: '1'.repeat(88), userId: 'user',
    walletAddress: '11111111111111111111111111111111', kind: 'deposit',
    blockhash: '2'.repeat(44), lastValidBlockHeight: 100, status: 'submitted',
    submittedAt: now, confirmedAt: null, reportedAt: null, attemptCount: 1,
    nextAttemptAt: now, lastErrorCode: null, createdAt: now, updatedAt: now,
    ...overrides,
  };
}

function harness(records = [record()]) {
  const updates: Array<{ signature: string; status: SubmissionStatus; errorCode?: string | null }> = [];
  let available = [...records];
  const store: ReconciliationStore = {
    claimBatch: vi.fn(async (profile, limit) => {
      const claimed = available.filter(item => item.networkProfile === profile).slice(0, limit);
      available = available.filter(item => !claimed.includes(item));
      return claimed;
    }),
    updateClaimed: vi.fn(async (item, _token, update) => {
      updates.push({ signature: item.signature, status: update.status, errorCode: update.errorCode });
      return true;
    }),
    reportDeposit: vi.fn().mockResolvedValue(undefined),
  };
  const chain: ReconciliationChain = {
    assertCluster: vi.fn().mockResolvedValue(undefined),
    getSignatureStatus: vi.fn().mockResolvedValue(null),
    getBlockHeight: vi.fn().mockResolvedValue(50),
    verifyDeposit: vi.fn().mockResolvedValue({
      signature: records[0]?.signature ?? '1'.repeat(88), walletAddress: records[0]?.walletAddress ?? '',
      amountBaseUnits: 1_000_000n, blockTime: now, networkProfile: 'devnet',
    }),
    verifyWithdraw: vi.fn().mockResolvedValue(true),
  };
  return { store, chain, updates };
}

describe('durable transaction reconciliation', () => {
  it('keeps a live missing signature pending', async () => {
    const h = harness();
    const summary = await reconcileSubmissions({ profile: 'devnet', limit: 10, ...h, now });
    expect(summary.pending).toBe(1);
    expect(h.updates.at(-1)?.status).toBe('pending');
  });

  it('reports a confirmed deposit exactly once', async () => {
    const h = harness();
    vi.mocked(h.chain.getSignatureStatus).mockResolvedValue({ confirmationStatus: 'confirmed', err: null });
    await reconcileSubmissions({ profile: 'devnet', limit: 10, ...h, now });
    expect(h.store.reportDeposit).toHaveBeenCalledTimes(1);
    expect(h.updates.at(-1)?.status).toBe('reconciled');
  });

  it('marks confirmed withdraw reconciled without creating a deposit or streak', async () => {
    const h = harness([record({ kind: 'withdraw' })]);
    vi.mocked(h.chain.getSignatureStatus).mockResolvedValue({ confirmationStatus: 'finalized', err: null });
    await reconcileSubmissions({ profile: 'devnet', limit: 10, ...h, now });
    expect(h.chain.verifyWithdraw).toHaveBeenCalledOnce();
    expect(h.store.reportDeposit).not.toHaveBeenCalled();
    expect(h.updates.at(-1)?.status).toBe('reconciled');
  });

  it('classifies failed, expired, and unknown outcomes without broadcasting', async () => {
    const failed = harness();
    vi.mocked(failed.chain.getSignatureStatus).mockResolvedValue({ confirmationStatus: 'confirmed', err: { InstructionError: [0, 'x'] } });
    expect((await reconcileSubmissions({ profile: 'devnet', limit: 1, ...failed, now })).failed).toBe(1);

    const expired = harness();
    vi.mocked(expired.chain.getBlockHeight).mockResolvedValue(101);
    expect((await reconcileSubmissions({ profile: 'devnet', limit: 1, ...expired, now })).expired).toBe(1);

    const unknown = harness();
    vi.mocked(unknown.chain.getSignatureStatus).mockRejectedValue(new Error('https://secret.rpc/?token=private'));
    expect((await reconcileSubmissions({ profile: 'devnet', limit: 1, ...unknown, now })).unknown).toBe(1);
    expect(unknown.updates.at(-1)).toMatchObject({ status: 'unknown', errorCode: 'rpc_error' });
    expect(JSON.stringify(unknown.updates)).not.toContain('secret.rpc');
    expect('broadcast' in unknown.chain).toBe(false);
  });

  it('retries report_pending with the same signature after worker restart', async () => {
    const pending = record({ status: 'report_pending', attemptCount: 3 });
    const h = harness([pending]);
    vi.mocked(h.chain.getSignatureStatus).mockResolvedValue({ confirmationStatus: 'confirmed', err: null });
    await reconcileSubmissions({ profile: 'devnet', limit: 1, ...h, now });
    expect(h.chain.getSignatureStatus).toHaveBeenCalledWith(pending.signature);
    expect(h.store.reportDeposit).toHaveBeenCalledOnce();
    expect(h.updates.at(-1)?.status).toBe('reconciled');
  });

  it('leaves report_pending durable when reporting fails', async () => {
    const h = harness();
    vi.mocked(h.chain.getSignatureStatus).mockResolvedValue({ confirmationStatus: 'confirmed', err: null });
    vi.mocked(h.store.reportDeposit).mockRejectedValue(new Error('database unavailable'));
    const summary = await reconcileSubmissions({ profile: 'devnet', limit: 1, ...h, now });
    expect(summary.reportPending).toBe(1);
    expect(h.updates.at(-1)).toMatchObject({ status: 'report_pending', errorCode: 'report_error' });
  });

  it('allows only one competing worker to claim a record', async () => {
    const h = harness();
    vi.mocked(h.chain.getSignatureStatus).mockResolvedValue({ confirmationStatus: 'confirmed', err: null });
    await Promise.all([
      reconcileSubmissions({ profile: 'devnet', limit: 1, ...h, now, claimToken: 'a' }),
      reconcileSubmissions({ profile: 'devnet', limit: 1, ...h, now, claimToken: 'b' }),
    ]);
    expect(h.store.reportDeposit).toHaveBeenCalledTimes(1);
  });

  it('does not claim Mainnet rows during Devnet reconciliation', async () => {
    const h = harness([record({ networkProfile: 'mainnet' }), record({ signature: '3'.repeat(88) })]);
    await reconcileSubmissions({ profile: 'devnet', limit: 10, ...h, now });
    expect(h.store.claimBatch).toHaveBeenCalledWith('devnet', 10, expect.any(String), now);
    expect(h.updates.map(update => update.signature)).toEqual(['3'.repeat(88)]);
  });

  it('uses fixed sanitized codes that cannot contain tokens or RPC URLs', () => {
    expect(sanitizedErrorCode('rpc')).toBe('rpc_error');
    expect(sanitizedErrorCode('report')).toBe('report_error');
  });
});
