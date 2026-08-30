import { describe, expect, it, vi } from 'vitest';
import { loadFundingBalances, readFundingBalances, type FundingRpc } from './fundingReadiness';

const WALLET = 'embedded-wallet';
const USDC_MINT = 'canonical-usdc-mint';

function rpc(overrides: Partial<FundingRpc> = {}): FundingRpc {
  return {
    getBalance: vi.fn().mockResolvedValue(1_234_567_890),
    getTokenAccountsByOwner: vi.fn().mockResolvedValue([{ amount: '1234567', decimals: 6 }]),
    ...overrides,
  };
}

describe('funding readiness balance reader', () => {
  it('reads and formats SOL balance from getBalance', async () => {
    const client = rpc();
    await expect(readFundingBalances(client, WALLET, USDC_MINT)).resolves.toMatchObject({
      sol: '1.23456789',
    });
    expect(client.getBalance).toHaveBeenCalledWith(WALLET);
  });

  it('formats canonical USDC with exactly 6 base-unit decimals', async () => {
    const client = rpc();
    await expect(readFundingBalances(client, WALLET, USDC_MINT)).resolves.toMatchObject({
      usdc: '1.234567',
    });
    expect(client.getTokenAccountsByOwner).toHaveBeenCalledWith(WALLET, USDC_MINT);
  });

  it('reads Circle Devnet USDC through the same read-only balance path', async () => {
    const client = rpc();
    const mint = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
    await readFundingBalances(client, WALLET, mint);
    expect(client.getTokenAccountsByOwner).toHaveBeenCalledWith(WALLET, mint);
  });

  it('returns zero USDC when no associated token account exists', async () => {
    const client = rpc({ getTokenAccountsByOwner: vi.fn().mockResolvedValue([]) });
    await expect(readFundingBalances(client, WALLET, USDC_MINT)).resolves.toMatchObject({ usdc: '0' });
  });

  it('returns a safe read-only error without crashing or exposing RPC credentials', async () => {
    const client = rpc({ getBalance: vi.fn().mockRejectedValue(new Error('429 private-rpc-url')) });
    const result = await loadFundingBalances(client, WALLET, USDC_MINT);
    expect(result).toEqual({
      balances: null,
      error: 'Unable to read balances from Solana RPC. Please refresh and try again.',
    });
    expect(result.error).not.toContain('private-rpc-url');
  });
});
