import { describe, expect, it } from 'vitest';

import { assertRpcCluster, resolveNetworkProfile, transactionExplorerUrl } from './networkProfile';

describe('network profiles fail closed', () => {
  it('defaults to mainnet without enabling transactions', () => {
    const { profile, error } = resolveNetworkProfile({});
    expect(error).toBeNull();
    expect(profile.name).toBe('mainnet');
    expect(profile.transactionsEnabled).toBe(false);
  });

  it('selects the isolated Devnet RPC and canonical Circle mint', () => {
    const { profile } = resolveNetworkProfile({
      NEXT_PUBLIC_SOLANA_NETWORK_PROFILE: 'devnet',
      NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL: 'https://devnet.invalid',
      NEXT_PUBLIC_SOLANA_DEVNET_RPC_SUBSCRIPTIONS_URL: 'wss://devnet.invalid',
    });
    expect(profile).toMatchObject({
      name: 'devnet',
      chain: 'solana:devnet',
      usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      rpcUrl: 'https://devnet.invalid',
      rpcSubscriptionsUrl: 'wss://devnet.invalid',
      label: 'DEVNET — TEST ASSETS',
      transactionsEnabled: false,
    });
  });

  it('keeps the Mainnet client profile and RPC configuration working', () => {
    const { profile, error } = resolveNetworkProfile({
      NEXT_PUBLIC_SOLANA_NETWORK_PROFILE: 'mainnet',
      NEXT_PUBLIC_SOLANA_RPC_URL: 'https://mainnet.invalid',
      NEXT_PUBLIC_SOLANA_RPC_SUBSCRIPTIONS_URL: 'wss://mainnet.invalid',
    });
    expect(error).toBeNull();
    expect(profile).toMatchObject({
      name: 'mainnet',
      label: 'Solana Mainnet',
      rpcUrl: 'https://mainnet.invalid',
      rpcSubscriptionsUrl: 'wss://mainnet.invalid',
      transactionsEnabled: false,
    });
  });

  it('rejects simultaneous Mainnet and Devnet flags', () => {
    const result = resolveNetworkProfile({
      NEXT_PUBLIC_ENABLE_MAINNET_TRANSACTIONS: 'true',
      NEXT_PUBLIC_ENABLE_DEVNET_TRANSACTIONS: 'true',
    });
    expect(result.error).toMatch(/cannot both/i);
    expect(result.profile.transactionsEnabled).toBe(false);
  });

  it('rejects an unknown profile and a mismatched RPC genesis', async () => {
    const invalid = resolveNetworkProfile({
      NEXT_PUBLIC_SOLANA_NETWORK_PROFILE: 'testnet',
      NEXT_PUBLIC_ENABLE_MAINNET_TRANSACTIONS: 'true',
    });
    expect(invalid.error).toMatch(/unknown/i);
    expect(invalid.profile.transactionsEnabled).toBe(false);
    await expect(assertRpcCluster(
      { getGenesisHash: async () => 'wrong-cluster' },
      resolveNetworkProfile({ NEXT_PUBLIC_SOLANA_NETWORK_PROFILE: 'devnet' }).profile,
    )).rejects.toThrow(/cluster mismatch/i);
  });

  it('uses the full Devnet genesis and rejects cross-wired Mainnet/Devnet endpoints', async () => {
    const mainnet = resolveNetworkProfile({}).profile;
    const devnet = resolveNetworkProfile({ NEXT_PUBLIC_SOLANA_NETWORK_PROFILE: 'devnet' }).profile;
    expect(devnet.genesisHash).toBe('EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG');
    await expect(assertRpcCluster({ getGenesisHash: async () => mainnet.genesisHash }, devnet))
      .rejects.toThrow(/cluster mismatch/i);
    await expect(assertRpcCluster({ getGenesisHash: async () => devnet.genesisHash }, mainnet))
      .rejects.toThrow(/cluster mismatch/i);
  });

  it('fails closed when getGenesisHash fails', async () => {
    const devnet = resolveNetworkProfile({ NEXT_PUBLIC_SOLANA_NETWORK_PROFILE: 'devnet' }).profile;
    await expect(assertRpcCluster({ getGenesisHash: async () => { throw new Error('RPC unavailable'); } }, devnet))
      .rejects.toThrow('RPC unavailable');
  });

  it('uses the Devnet explorer cluster', () => {
    const devnet = resolveNetworkProfile({ NEXT_PUBLIC_SOLANA_NETWORK_PROFILE: 'devnet' }).profile;
    expect(transactionExplorerUrl('signature', devnet)).toBe('https://explorer.solana.com/tx/signature?cluster=devnet');
  });
});
