import { describe, expect, it, vi } from 'vitest';
import { TransactionLifecycle, type TransactionLifecycleDeps } from './transactionLifecycle';

const lifetime = { blockhash: 'blockhash', lastValidBlockHeight: 100 };

function dependencies(overrides: Partial<TransactionLifecycleDeps<string>> = {}) {
  return {
    getLatestBlockhash: vi.fn().mockResolvedValue(lifetime),
    buildTransaction: vi.fn().mockResolvedValue('transaction'),
    signTransaction: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    broadcastOnce: vi.fn().mockResolvedValue('signature'),
    confirmTransaction: vi.fn().mockResolvedValue({ err: null }),
    getSignatureStatus: vi.fn().mockResolvedValue(null),
    getBlockHeight: vi.fn().mockResolvedValue(50),
    ...overrides,
  } satisfies TransactionLifecycleDeps<string>;
}

describe('transaction lifecycle', () => {
  it('prevents a double click and broadcasts once', async () => {
    let release!: () => void;
    const waiting = new Promise<{ err: null }>((resolve) => { release = () => resolve({ err: null }); });
    const deps = dependencies({ confirmTransaction: vi.fn(() => waiting) });
    const lifecycle = new TransactionLifecycle(deps);

    const first = lifecycle.execute(1);
    const second = lifecycle.execute(1);
    await vi.waitFor(() => expect(deps.broadcastOnce).toHaveBeenCalledTimes(1));
    release();
    await Promise.all([first, second]);

    expect(deps.buildTransaction).toHaveBeenCalledTimes(1);
    expect(deps.signTransaction).toHaveBeenCalledTimes(1);
    expect(deps.broadcastOnce).toHaveBeenCalledTimes(1);
  });

  it('tracks the returned signature and lifetime without rebroadcasting when tracking is temporarily unavailable', async () => {
    const trackSubmission = vi.fn().mockRejectedValue(new Error('tracking unavailable'));
    const deps = dependencies({ trackSubmission });
    const lifecycle = new TransactionLifecycle(deps);
    await lifecycle.execute(1);
    expect(trackSubmission).toHaveBeenCalledWith('signature', lifetime);
    expect(deps.broadcastOnce).toHaveBeenCalledTimes(1);
    expect(deps.signTransaction).toHaveBeenCalledTimes(1);
  });

  it('reconciles a confirmation timeout to confirmed by signature', async () => {
    const deps = dependencies({
      confirmTransaction: vi.fn().mockRejectedValue(new Error('timeout')),
      getSignatureStatus: vi.fn().mockResolvedValue({ confirmationStatus: 'confirmed', err: null }),
    });
    const lifecycle = new TransactionLifecycle(deps);
    await lifecycle.execute(1);
    expect(lifecycle.state.phase).toBe('confirmed');
    expect(deps.getSignatureStatus).toHaveBeenCalledWith('signature');
    expect(deps.broadcastOnce).toHaveBeenCalledTimes(1);
  });

  it('marks a missing signature status as unknown while blockhash is live', async () => {
    const deps = dependencies({ confirmTransaction: vi.fn().mockRejectedValue(new Error('timeout')) });
    const lifecycle = new TransactionLifecycle(deps);
    await lifecycle.execute(1);
    expect(lifecycle.state.phase).toBe('unknown');
    expect(deps.broadcastOnce).toHaveBeenCalledTimes(1);
  });

  it('marks a transaction expired after its last valid block height', async () => {
    const deps = dependencies({
      confirmTransaction: vi.fn().mockRejectedValue(new Error('blockheight exceeded')),
      getBlockHeight: vi.fn().mockResolvedValue(101),
    });
    const lifecycle = new TransactionLifecycle(deps);
    await lifecycle.execute(1);
    expect(lifecycle.state.phase).toBe('expired');
  });

  it('retries only the report using the same signature', async () => {
    const report = vi.fn()
      .mockRejectedValueOnce(new Error('report unavailable'))
      .mockResolvedValueOnce(undefined);
    const deps = dependencies({ report });
    const lifecycle = new TransactionLifecycle(deps);
    await lifecycle.execute(1);
    expect(lifecycle.state.phase).toBe('report_pending');

    await lifecycle.retryReport();
    expect(lifecycle.state.phase).toBe('confirmed');
    expect(report).toHaveBeenNthCalledWith(1, 'signature');
    expect(report).toHaveBeenNthCalledWith(2, 'signature');
    expect(deps.broadcastOnce).toHaveBeenCalledTimes(1);
    expect(deps.signTransaction).toHaveBeenCalledTimes(1);
  });
});
