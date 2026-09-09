import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticationError } from '@/lib/auth';

const mocks = vi.hoisted(() => ({
  authenticateWallet: vi.fn(),
  enforceApiRateLimit: vi.fn(),
  runConfiguredUserReconciliation: vi.fn(),
}));

vi.mock('@/lib/networkProfile', () => ({
  ACTIVE_NETWORK: { name: 'devnet' },
  NETWORK_CONFIGURATION_ERROR: null,
}));
vi.mock('@/lib/auth', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  authenticateWallet: mocks.authenticateWallet,
}));
vi.mock('@/lib/rateLimit', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/rateLimit')>()),
  enforceApiRateLimit: mocks.enforceApiRateLimit,
}));
vi.mock('@/lib/reconciliationServer', () => ({
  runConfiguredUserReconciliation: mocks.runConfiguredUserReconciliation,
}));

import { POST } from './route';

const wallet = '11111111111111111111111111111111';
const summary = {
  claimed: 1, pending: 0, reconciled: 0, reportPending: 0,
  failed: 1, expired: 0, unknown: 0, skipped: 0,
};

function request(body: unknown, token = 'token') {
  return new Request('http://localhost/api/transactions/submissions/reconcile', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { 'privy-id-token': token } : {}) },
    body: JSON.stringify(body),
  });
}

describe('user-owned submission reconciliation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateWallet.mockResolvedValue({ userId: 'did:privy:user', walletAddress: wallet });
    mocks.enforceApiRateLimit.mockResolvedValue({ allowed: true, remaining: 5, retryAfterSeconds: 60 });
    mocks.runConfiguredUserReconciliation.mockResolvedValue(summary);
  });

  it('authenticates the requested wallet before rate limiting or reconciliation', async () => {
    mocks.authenticateWallet.mockRejectedValue(new AuthenticationError('not linked'));
    const response = await POST(request({ wallet, kind: 'deposit' }));
    expect(response.status).toBe(401);
    expect(mocks.enforceApiRateLimit).not.toHaveBeenCalled();
    expect(mocks.runConfiguredUserReconciliation).not.toHaveBeenCalled();
  });

  it.each([
    [{ wallet: 'bad', kind: 'deposit' }],
    [{ wallet, kind: 'transfer' }],
    [{ wallet, kind: 'deposit', userId: 'another-user' }],
  ])('strictly rejects invalid or identity-bearing input', async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(mocks.authenticateWallet).not.toHaveBeenCalled();
    expect(mocks.runConfiguredUserReconciliation).not.toHaveBeenCalled();
  });

  it('scopes the runner to the authenticated identity and requested transaction kind', async () => {
    const response = await POST(request({ wallet, kind: 'deposit' }));
    expect(response.status).toBe(200);
    expect(mocks.runConfiguredUserReconciliation).toHaveBeenCalledWith({
      userId: 'did:privy:user', walletAddress: wallet, kind: 'deposit', limit: 5,
    });
    expect(await response.json()).toEqual({
      claimed: 1, pending: 0, reconciled: 0, reportPending: 0,
      failed: 1, expired: 0, unknown: 0,
    });
  });
});
