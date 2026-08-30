'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';

import {
  canUsePrivyEmbeddedWallet,
  selectPrivyEmbeddedSolanaWallet,
} from '@/lib/privyWallet';

/**
 * Single source of truth for auth + embedded Solana wallet state.
 *
 * Gotcha (roadmap Phase 1): always gate on `canSign` — all three of
 * ready / authenticated / embedded wallet — before ANY wallet operation.
 * Calling signTransaction while Privy is still initializing throws.
 */
export function useSolStreakWallet() {
  const { ready: authReady, authenticated, login, logout, user } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const ready = authReady && walletsReady;
  const embedded = selectPrivyEmbeddedSolanaWallet(wallets);

  const canSign = canUsePrivyEmbeddedWallet(ready, authenticated, embedded);

  return { ready, authenticated, login, logout, user, wallet: embedded, canSign };
}
