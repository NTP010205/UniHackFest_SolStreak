import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ runConfiguredReconciliation: vi.fn(), enforceApiRateLimit: vi.fn() }));
vi.mock('@/lib/reconciliationServer', () => ({ runConfiguredReconciliation: mocks.runConfiguredReconciliation }));
vi.mock('@/lib/rateLimit', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/rateLimit')>()),
  enforceApiRateLimit: mocks.enforceApiRateLimit,
}));

import { createSchedulerHandler, POST } from './route';
import { RateLimitExceededError } from '@/lib/rateLimit';

const ZERO_SUMMARY = {
  claimed: 0, pending: 0, reconciled: 0, reportPending: 0,
  failed: 0, expired: 0, unknown: 0, skipped: 0,
};

describe('reconciliation scheduler entry point', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('RECONCILIATION_SECRET', 'scheduler-secret');
    mocks.runConfiguredReconciliation.mockResolvedValue(ZERO_SUMMARY);
    mocks.enforceApiRateLimit.mockResolvedValue({ allowed: true, remaining: 5, retryAfterSeconds: 60 });
  });

  it('rejects requests without the server-only bearer secret', async () => {
    expect((await POST(new Request('http://localhost/api/internal/reconcile', { method: 'POST' }))).status).toBe(401);
    expect(mocks.runConfiguredReconciliation).not.toHaveBeenCalled();
    expect(mocks.enforceApiRateLimit).not.toHaveBeenCalled();
  });

  it('rejects a wrong secret, query-string secret, and unsupported method', async () => {
    expect((await POST(new Request('http://localhost/api/internal/reconcile', {
      method: 'POST', headers: { authorization: 'Bearer wrong' },
    }))).status).toBe(401);
    expect((await POST(new Request('http://localhost/api/internal/reconcile?secret=scheduler-secret', {
      method: 'POST',
    }))).status).toBe(401);
    const handler = createSchedulerHandler({ secret: 'scheduler-secret', run: mocks.runConfiguredReconciliation });
    const response = await handler(new Request('http://localhost/api/internal/reconcile', {
      method: 'GET', headers: { authorization: 'Bearer scheduler-secret' },
    }));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(mocks.runConfiguredReconciliation).not.toHaveBeenCalled();
  });

  it('caps the requested batch and returns only summary counts', async () => {
    const response = await POST(new Request('http://localhost/api/internal/reconcile?limit=999', {
      method: 'POST', headers: { authorization: 'Bearer scheduler-secret' },
    }));
    expect(response.status).toBe(200);
    expect(mocks.runConfiguredReconciliation).toHaveBeenCalledWith(100);
    expect(await response.json()).toEqual(ZERO_SUMMARY);
  });

  it('applies the scheduler-global limiter only after authorization', async () => {
    mocks.enforceApiRateLimit.mockRejectedValue(new RateLimitExceededError(17));
    const denied = await POST(new Request('http://localhost/api/internal/reconcile', {
      method: 'POST', headers: { authorization: 'Bearer scheduler-secret' },
    }));
    expect(denied.status).toBe(429);
    expect(denied.headers.get('retry-after')).toBe('17');
    expect(mocks.runConfiguredReconciliation).not.toHaveBeenCalled();

    mocks.enforceApiRateLimit.mockClear();
    await POST(new Request('http://localhost/api/internal/reconcile', {
      method: 'POST', headers: { authorization: 'Bearer wrong' },
    }));
    expect(mocks.enforceApiRateLimit).not.toHaveBeenCalled();
  });

  it('whitelists summary counts and redacts runner failures', async () => {
    mocks.runConfiguredReconciliation.mockResolvedValue({
      ...ZERO_SUMMARY,
      claimed: 2.9,
      pending: -1,
      databaseUrl: 'postgres://password@host/db',
    });
    let response = await POST(new Request('http://localhost/api/internal/reconcile', {
      method: 'POST', headers: { authorization: 'Bearer scheduler-secret' },
    }));
    expect(await response.json()).toEqual({ ...ZERO_SUMMARY, claimed: 2 });

    mocks.runConfiguredReconciliation.mockRejectedValue(
      new Error('postgres://password@host/db https://rpc.invalid/?token=secret'),
    );
    response = await POST(new Request('http://localhost/api/internal/reconcile', {
      method: 'POST', headers: { authorization: 'Bearer scheduler-secret' },
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Reconciliation unavailable', code: 'RECONCILIATION_UNAVAILABLE',
    });
  });

  it('enforces the execution timeout without leaking the cause', async () => {
    vi.useFakeTimers();
    const handler = createSchedulerHandler({
      secret: 'scheduler-secret',
      run: () => new Promise(() => undefined),
      timeoutMs: 10,
    });
    const pending = handler(new Request('http://localhost/api/internal/reconcile', {
      method: 'POST', headers: { authorization: 'Bearer scheduler-secret' },
    }));
    await vi.advanceTimersByTimeAsync(10);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Reconciliation unavailable', code: 'RECONCILIATION_UNAVAILABLE',
    });
    vi.useRealTimers();
  });
});
