'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';

import {
  canUsePrivyEmbeddedWallet,
  linkedSolanaWalletAddresses,
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
  const linkedAddresses = linkedSolanaWalletAddresses(user?.linkedAccounts ?? []);
  const embedded = authenticated && user
    ? selectPrivyEmbeddedSolanaWallet(wallets, linkedAddresses)
    : undefined;

  const canSign = canUsePrivyEmbeddedWallet(ready, authenticated, embedded);
  const sessionKey = canSign && user && embedded ? `${user.id}:${embedded.address}` : null;

  return { ready, authenticated, login, logout, user, wallet: embedded, canSign, sessionKey };
}
