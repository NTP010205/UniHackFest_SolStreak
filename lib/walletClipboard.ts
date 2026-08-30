import type { PrivySolanaWalletLike } from './privyWallet';

interface AddressWallet extends PrivySolanaWalletLike {
  address: string;
}

export async function copyEmbeddedWalletAddress(
  wallet: AddressWallet,
  writeText: (value: string) => Promise<void>,
): Promise<string> {
  if ((wallet.standardWallet as { isPrivyWallet?: boolean }).isPrivyWallet !== true) {
    throw new Error('Only the embedded Privy Solana wallet can be copied');
  }
  await writeText(wallet.address);
  return wallet.address;
}
