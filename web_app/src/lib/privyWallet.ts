export interface PrivySolanaWalletLike {
  standardWallet: unknown;
}

/** Select Privy's embedded Solana wallet, never an extension wallet. */
export function selectPrivyEmbeddedSolanaWallet<T extends PrivySolanaWalletLike>(
  wallets: readonly T[],
): T | undefined {
  return wallets.find(
    (wallet) =>
      (wallet.standardWallet as { isPrivyWallet?: boolean }).isPrivyWallet === true,
  );
}

export function canUsePrivyEmbeddedWallet<T extends PrivySolanaWalletLike>(
  ready: boolean,
  authenticated: boolean,
  wallet: T | undefined,
): boolean {
  return ready && authenticated && wallet !== undefined;
}
