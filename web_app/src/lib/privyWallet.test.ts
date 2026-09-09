import { describe, expect, it } from 'vitest';

import {
  canUsePrivyEmbeddedWallet,
  linkedSolanaWalletAddresses,
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

  it('selects only an embedded wallet linked to the active Privy user', () => {
    const stale = wallet('stale-user-wallet', 'Privy', true);
    const current = wallet('current-user-wallet', 'Privy', true);
    const linked = linkedSolanaWalletAddresses([
      { type: 'email', address: 'not-a-wallet' },
      { type: 'wallet', chainType: 'ethereum', address: '0xabc' },
      { type: 'wallet', chainType: 'solana', address: current.address },
    ]);

    expect(selectPrivyEmbeddedSolanaWallet([stale, current], linked)).toBe(current);
    expect(selectPrivyEmbeddedSolanaWallet([stale], linked)).toBeUndefined();
  });
});
