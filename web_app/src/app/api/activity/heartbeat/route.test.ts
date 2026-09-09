import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticationError } from '@/lib/auth';

const mocks = vi.hoisted(() => ({
  authenticateWallet: vi.fn(),
  enforceApiRateLimit: vi.fn(),
  recordUserActivity: vi.fn(),
}));

vi.mock('@/lib/networkProfile', () => ({ ACTIVE_NETWORK: { name: 'devnet' } }));
vi.mock('@/lib/auth', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  authenticateWallet: mocks.authenticateWallet,
}));
vi.mock('@/lib/rateLimit', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/rateLimit')>()),
  enforceApiRateLimit: mocks.enforceApiRateLimit,
}));
vi.mock('@/lib/store', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/store')>()),
  recordUserActivity: mocks.recordUserActivity,
}));

import { POST } from './route';

const wallet = '11111111111111111111111111111111';
const identity = { userId: 'did:privy:user', walletAddress: wallet };

function heartbeat(body: unknown, token = 'identity-token') {
  return new Request('http://localhost/api/activity/heartbeat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'privy-id-token': token } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/activity/heartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateWallet.mockResolvedValue(identity);
    mocks.enforceApiRateLimit.mockResolvedValue({ allowed: true, remaining: 11, retryAfterSeconds: 60 });
    mocks.recordUserActivity.mockResolvedValue(new Date('2026-09-07T08:00:00Z'));
  });

  it('records only the server-authenticated wallet identity', async () => {
    const response = await POST(heartbeat({ wallet }));

    expect(response.status).toBe(200);
    expect(mocks.authenticateWallet).toHaveBeenCalledWith(expect.any(Request), wallet);
    expect(mocks.enforceApiRateLimit).toHaveBeenCalledWith(expect.objectContaining({
      userId: identity.userId,
      networkProfile: 'devnet',
    }));
    expect(mocks.recordUserActivity).toHaveBeenCalledWith(identity.userId, wallet, 'devnet');
    expect(await response.json()).toMatchObject({ networkProfile: 'devnet', status: 'active' });
  });

  it('rejects malformed or extra fields before authentication', async () => {
    const response = await POST(heartbeat({ wallet: 'bad', userId: 'forged' }));

    expect(response.status).toBe(400);
    expect(mocks.authenticateWallet).not.toHaveBeenCalled();
    expect(mocks.recordUserActivity).not.toHaveBeenCalled();
  });

  it('does not write activity for an unauthenticated wallet', async () => {
    mocks.authenticateWallet.mockRejectedValue(new AuthenticationError('expired'));
    const response = await POST(heartbeat({ wallet }, ''));

    expect(response.status).toBe(401);
    expect(mocks.recordUserActivity).not.toHaveBeenCalled();
  });
});
