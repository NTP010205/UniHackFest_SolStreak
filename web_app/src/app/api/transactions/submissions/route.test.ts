import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticationError } from '@/lib/auth';

const mocks = vi.hoisted(() => ({
  authenticateWallet: vi.fn(), trackSubmission: vi.fn(), unresolvedSubmissions: vi.fn(),
  enforceApiRateLimit: vi.fn(),
}));
vi.mock('@/lib/auth', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()), authenticateWallet: mocks.authenticateWallet,
}));
vi.mock('@/lib/store', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/store')>()),
  trackSubmission: mocks.trackSubmission, unresolvedSubmissions: mocks.unresolvedSubmissions,
}));
vi.mock('@/lib/rateLimit', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/rateLimit')>()),
  enforceApiRateLimit: mocks.enforceApiRateLimit,
}));

import { GET, POST } from './route';

const wallet = '11111111111111111111111111111111';
const signature = '5t4thX21v4tthY9FodXBuL51m8Vmxd3NpoS63d1Z1VMyuwXZ1YjPEBb6vbkgkd9dsQpGCciUZYxdP2pQbvcSpkz3';
const blockhash = '13mYwjoHEGqX4CtMDhFqQGQVUHWGyVq3rzNZ1P6dCPYf';
const body = { wallet, signature, blockhash, lastValidBlockHeight: 100, kind: 'deposit', networkProfile: 'mainnet' };
const record = {
  networkProfile: 'mainnet', signature, userId: 'user', walletAddress: wallet, kind: 'deposit', blockhash,
  lastValidBlockHeight: 100, status: 'submitted', submittedAt: new Date(), confirmedAt: null,
  reportedAt: null, attemptCount: 0, nextAttemptAt: new Date(), lastErrorCode: null,
  createdAt: new Date(), updatedAt: new Date(),
};
const request = (value: unknown = body, token = 'token') => new Request('http://localhost/api/transactions/submissions', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'privy-id-token': token } : {}) },
  body: JSON.stringify(value),
});

describe('transaction submission tracking API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateWallet.mockResolvedValue({ userId: 'user', walletAddress: wallet });
    mocks.trackSubmission.mockResolvedValue(record);
    mocks.unresolvedSubmissions.mockResolvedValue([record]);
    mocks.enforceApiRateLimit.mockResolvedValue({ allowed: true, remaining: 1, retryAfterSeconds: 60 });
  });

  it('rejects missing authentication', async () => {
    mocks.authenticateWallet.mockRejectedValue(new AuthenticationError('Sign in again to continue'));
    expect((await POST(request(body, ''))).status).toBe(401);
    expect(mocks.trackSubmission).not.toHaveBeenCalled();
  });

  it('rejects wallet not linked to the identity token', async () => {
    mocks.authenticateWallet.mockRejectedValue(new AuthenticationError('Wallet is not linked to this Privy user'));
    expect((await POST(request())).status).toBe(401);
    expect(mocks.trackSubmission).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...body, signature: 'bad' }],
    [{ ...body, blockhash: 'bad' }],
    [{ ...body, networkProfile: 'testnet' }],
    [{ ...body, kind: 'swap' }],
    [{ ...body, lastValidBlockHeight: -1 }],
  ])('rejects invalid signature/blockhash/profile/kind/lifetime', async (invalid) => {
    expect((await POST(request(invalid))).status).toBe(400);
    expect(mocks.authenticateWallet).not.toHaveBeenCalled();
  });

  it('upserts replayed cluster/signature idempotently', async () => {
    const first = await POST(request());
    const replay = await POST(request());
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect((await first.json()).signature).toBe(signature);
    expect((await replay.json()).signature).toBe(signature);
    expect(mocks.trackSubmission).toHaveBeenCalledTimes(2);
  });

  it('lists unresolved records only after wallet authentication', async () => {
    const response = await GET(new Request(`http://localhost/api/transactions/submissions?wallet=${wallet}`, {
      headers: { 'privy-id-token': 'token' },
    }));
    expect(response.status).toBe(200);
    expect(mocks.unresolvedSubmissions).toHaveBeenCalledWith('user', wallet, 'mainnet');
  });
});
