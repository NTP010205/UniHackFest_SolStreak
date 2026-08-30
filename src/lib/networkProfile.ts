import { CLIENT_PUBLIC_CONFIG, type ClientPublicConfig } from './clientPublicConfig';

export type SolanaNetworkProfileName = 'mainnet' | 'devnet';

export interface SolanaNetworkProfile {
  name: SolanaNetworkProfileName;
  label: string;
  cluster: 'mainnet-beta' | 'devnet';
  chain: 'solana:mainnet' | 'solana:devnet';
  explorerCluster: 'mainnet-beta' | 'devnet';
  genesisHash: string;
  rpcUrl: string;
  rpcSubscriptionsUrl: string;
  transactionsEnabled: boolean;
  usdcMint: string;
  usdcDecimals: 6;
  lendingProgram: string;
  liquidityProgram: string;
  earnVault: string;
  fTokenMint: string;
}

const COMMON = { usdcDecimals: 6 as const };

export function resolveNetworkProfile(
  env: Partial<ClientPublicConfig>,
): { profile: SolanaNetworkProfile; error: string | null } {
  const requested = env.NEXT_PUBLIC_SOLANA_NETWORK_PROFILE?.trim() || 'mainnet';
  const mainnetEnabled = env.NEXT_PUBLIC_ENABLE_MAINNET_TRANSACTIONS === 'true';
  const devnetEnabled = env.NEXT_PUBLIC_ENABLE_DEVNET_TRANSACTIONS === 'true';
  const conflict = mainnetEnabled && devnetEnabled;
  const invalidName = requested !== 'mainnet' && requested !== 'devnet';
  const name: SolanaNetworkProfileName = requested === 'devnet' ? 'devnet' : 'mainnet';

  const profile: SolanaNetworkProfile = name === 'devnet'
    ? {
        ...COMMON,
        name,
        label: 'DEVNET — TEST ASSETS',
        cluster: 'devnet',
        chain: 'solana:devnet',
        explorerCluster: 'devnet',
        genesisHash: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
        rpcUrl: env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL?.trim() ?? '',
        rpcSubscriptionsUrl: env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_SUBSCRIPTIONS_URL?.trim() ?? '',
        transactionsEnabled: devnetEnabled && !mainnetEnabled,
        usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        lendingProgram: '7tjE28izRUjzmxC1QNXnNwcc4N82CNYCexf3k8mw67s3',
        liquidityProgram: '5uDkCoM96pwGYhAUucvCzLfm5UcjVRuxz6gH81RnRBmL',
        earnVault: 'CWFPa1gcDqGyeTHTmdbhGjCnQv7eRfdhnBpZKFzNr1R2',
        fTokenMint: '2Wx1tTo8PkTP95NyKoFNPTtcLnYaSowDkExwbHDKAZQu',
      }
    : {
        ...COMMON,
        name,
        label: 'Solana Mainnet',
        cluster: 'mainnet-beta',
        chain: 'solana:mainnet',
        explorerCluster: 'mainnet-beta',
        genesisHash: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        rpcUrl: env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ?? '',
        rpcSubscriptionsUrl: env.NEXT_PUBLIC_SOLANA_RPC_SUBSCRIPTIONS_URL?.trim() ?? '',
        transactionsEnabled: mainnetEnabled && !devnetEnabled,
        usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        lendingProgram: 'jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9',
        liquidityProgram: 'jupeiUmn818Jg1ekPURTpr4mFo29p46vygyykFJ3wZC',
        earnVault: '4XxvuSodkxx4vjRxJsHBzHM6u43wozCEWpzRbeJpCDMq',
        fTokenMint: '9BEcn9aPEmhSPbPQeFGjidRiEKki46fVQDyPpSQXPA2D',
      };

  const error = conflict
    ? 'Mainnet and Devnet transaction flags cannot both be enabled.'
    : invalidName
      ? 'Unknown Solana network profile.'
      : null;
  if (error) profile.transactionsEnabled = false;
  return { profile, error };
}

export const { profile: ACTIVE_NETWORK, error: NETWORK_CONFIGURATION_ERROR } =
  resolveNetworkProfile(CLIENT_PUBLIC_CONFIG);
export const ACTIVE_RPC_CONFIGURED =
  ACTIVE_NETWORK.rpcUrl.length > 0 && ACTIVE_NETWORK.rpcSubscriptionsUrl.length > 0;

export async function assertRpcCluster(
  rpc: { getGenesisHash(): Promise<string> },
  profile: Pick<SolanaNetworkProfile, 'name' | 'genesisHash'> = ACTIVE_NETWORK,
) {
  const actual = await rpc.getGenesisHash();
  if (actual !== profile.genesisHash) {
    throw new Error(`RPC cluster mismatch: expected Solana ${profile.name}.`);
  }
}

export function transactionExplorerUrl(signature: string, profile = ACTIVE_NETWORK) {
  const query = profile.explorerCluster === 'mainnet-beta' ? '' : `?cluster=${profile.explorerCluster}`;
  return `https://explorer.solana.com/tx/${signature}${query}`;
}
