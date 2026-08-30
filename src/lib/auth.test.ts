import { beforeEach, describe, expect, it, vi } from 'vitest';

const joseMocks = vi.hoisted(() => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: vi.fn(),
}));

vi.mock('jose', () => joseMocks);

import { authenticateWallet, AuthenticationError } from './auth';

const APP_ID = 'privy-test-app';
const SOLANA_WALLET = '9xQeWvG816bUx9EPfEZmQoJGtVTE6zW7XQzMbYfk5GW5';

function linkedAccounts(address = SOLANA_WALLET): string {
  return JSON.stringify([
    { type: 'wallet', chain_type: 'ethereum', address: '0x1234' },
    { type: 'wallet', chain_type: 'solana', address },
  ]);
}

function identityRequest(token?: string): Request {
  return new Request('http://localhost/api/streak/status', {
    headers: token ? { 'privy-id-token': token } : undefined,
  });
}

function validPayload() {
  return {
    sub: 'did:privy:test-user',
    exp: Math.floor(Date.now() / 1000) + 300,
    linked_accounts: linkedAccounts(),
  };
}

describe('authenticateWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_PRIVY_APP_ID', APP_ID);
    joseMocks.jwtVerify.mockResolvedValue({ payload: validPayload() });
  });

  it('rejects a request without an identity token', async () => {
    await expect(authenticateWallet(identityRequest(), SOLANA_WALLET)).rejects.toThrow(
      AuthenticationError,
    );
    expect(joseMocks.jwtVerify).not.toHaveBeenCalled();
  });

  it('rejects an expired identity token', async () => {
    joseMocks.jwtVerify.mockResolvedValue({
      payload: { ...validPayload(), exp: Math.floor(Date.now() / 1000) - 1 },
    });

    await expect(
      authenticateWallet(identityRequest('expired-token'), SOLANA_WALLET),
    ).rejects.toThrow('Invalid or expired Privy identity token');
  });

  it('rejects a token with the wrong audience', async () => {
    joseMocks.jwtVerify.mockRejectedValue(new Error('unexpected audience'));

    await expect(
      authenticateWallet(identityRequest('wrong-audience-token'), SOLANA_WALLET),
    ).rejects.toThrow('Invalid or expired Privy identity token');
  });

  it('rejects a request wallet absent from Solana linked_accounts', async () => {
    await expect(
      authenticateWallet(identityRequest('valid-token'), 'different-wallet'),
    ).rejects.toThrow('Wallet is not linked to this Privy user');
  });

  it('verifies Privy issuer and App ID audience before accepting a linked Solana wallet', async () => {
    await expect(
      authenticateWallet(identityRequest('valid-token'), SOLANA_WALLET),
    ).resolves.toEqual({
      userId: 'did:privy:test-user',
      walletAddress: SOLANA_WALLET,
    });
    expect(joseMocks.jwtVerify).toHaveBeenCalledWith(
      'valid-token',
      expect.anything(),
      { issuer: 'privy.io', audience: APP_ID },
    );
  });
});
