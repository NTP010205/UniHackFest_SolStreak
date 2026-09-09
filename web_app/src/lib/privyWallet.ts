export interface PrivySolanaWalletLike {
  address: string;
  standardWallet: unknown;
}

export interface PrivyLinkedAccountLike {
  type: string;
  address?: string;
  chainType?: string;
}

/** Return only Solana wallet addresses attached to the active Privy user. */
export function linkedSolanaWalletAddresses(
  linkedAccounts: readonly PrivyLinkedAccountLike[],
): ReadonlySet<string> {
  return new Set(linkedAccounts.flatMap((account) =>
    account.type === 'wallet' && account.chainType === 'solana' && account.address
      ? [account.address]
      : [],
  ));
}

/** Select Privy's embedded Solana wallet, never an extension wallet. */
export function selectPrivyEmbeddedSolanaWallet<T extends PrivySolanaWalletLike>(
  wallets: readonly T[],
  linkedAddresses?: ReadonlySet<string>,
): T | undefined {
  return wallets.find(
    (wallet) =>
      (wallet.standardWallet as { isPrivyWallet?: boolean }).isPrivyWallet === true &&
      (linkedAddresses === undefined || linkedAddresses.has(wallet.address)),
  );
}

export function canUsePrivyEmbeddedWallet<T extends PrivySolanaWalletLike>(
  ready: boolean,
  authenticated: boolean,
  wallet: T | undefined,
): boolean {
  return ready && authenticated && wallet !== undefined;
}
