import { describe, expect, it, vi } from 'vitest';
import { copyEmbeddedWalletAddress } from './walletClipboard';

describe('embedded wallet clipboard', () => {
  it('copies the full embedded Privy Solana wallet address', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const wallet = {
      address: 'FullEmbeddedSolanaAddress123456789',
      standardWallet: { isPrivyWallet: true },
    };
    await expect(copyEmbeddedWalletAddress(wallet, writeText)).resolves.toBe(wallet.address);
    expect(writeText).toHaveBeenCalledWith(wallet.address);
  });

  it('refuses to copy an extension wallet address', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const extension = {
      address: 'PhantomExtensionAddress',
      standardWallet: { isPrivyWallet: false },
    };
    await expect(copyEmbeddedWalletAddress(extension, writeText)).rejects.toThrow(/embedded Privy/);
    expect(writeText).not.toHaveBeenCalled();
  });
});
