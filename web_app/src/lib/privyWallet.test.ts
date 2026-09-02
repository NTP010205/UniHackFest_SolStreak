import { describe, expect, it } from 'vitest';

import {
  canUsePrivyEmbeddedWallet,
  selectPrivyEmbeddedSolanaWallet,
  type PrivySolanaWalletLike,
} from './privyWallet';

interface TestWallet extends PrivySolanaWalletLike {
  address: string;
  standardWallet: {
    isPrivyWallet?: boolean;
    name: string;
  };
}

function wallet(address: string, name: string, isPrivyWallet = false): TestWallet {
  return { address, standardWallet: { name, isPrivyWallet } };
}

describe('Privy embedded Solana wallet gate', () => {
  const embeddedWallet = wallet('privy-solana', 'Privy', true);

  it('blocks signing while Privy is not ready', () => {
    expect(canUsePrivyEmbeddedWallet(false, true, embeddedWallet)).toBe(false);
  });

  it('blocks signing while the user is not authenticated', () => {
    expect(canUsePrivyEmbeddedWallet(true, false, embeddedWallet)).toBe(false);
  });

  it('blocks signing when an authenticated user has no embedded wallet', () => {
    expect(canUsePrivyEmbeddedWallet(true, true, undefined)).toBe(false);
  });

  it('selects the Privy embedded Solana wallet when multiple wallets exist', () => {
    const extension = wallet('extension-solana', 'Phantom');
    const evmLikeWallet = wallet('0xabc', 'Browser wallet');

    expect(
      selectPrivyEmbeddedSolanaWallet([extension, evmLikeWallet, embeddedWallet]),
    ).toBe(embeddedWallet);
    expect(canUsePrivyEmbeddedWallet(true, true, embeddedWallet)).toBe(true);
  });
});
