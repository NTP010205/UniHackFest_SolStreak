import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('client public network configuration', () => {
  it('loads the Devnet profile and HTTP/WSS values from literal public env accesses', async () => {
    vi.stubEnv('NEXT_PUBLIC_SOLANA_NETWORK_PROFILE', 'devnet');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_MAINNET_TRANSACTIONS', 'false');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_DEVNET_TRANSACTIONS', 'false');
    vi.stubEnv('NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL', 'https://devnet.invalid');
    vi.stubEnv('NEXT_PUBLIC_SOLANA_DEVNET_RPC_SUBSCRIPTIONS_URL', 'wss://devnet.invalid');
    vi.resetModules();

    const { CLIENT_PUBLIC_CONFIG } = await import('./clientPublicConfig');
    const { ACTIVE_NETWORK, ACTIVE_RPC_CONFIGURED } = await import('./networkProfile');

    expect(CLIENT_PUBLIC_CONFIG).toMatchObject({
      NEXT_PUBLIC_SOLANA_NETWORK_PROFILE: 'devnet',
      NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL: 'https://devnet.invalid',
      NEXT_PUBLIC_SOLANA_DEVNET_RPC_SUBSCRIPTIONS_URL: 'wss://devnet.invalid',
    });
    expect(ACTIVE_NETWORK).toMatchObject({
      name: 'devnet',
      label: 'DEVNET — TEST ASSETS',
      rpcUrl: 'https://devnet.invalid',
      rpcSubscriptionsUrl: 'wss://devnet.invalid',
      transactionsEnabled: false,
    });
    expect(ACTIVE_RPC_CONFIGURED).toBe(true);
  });
});
