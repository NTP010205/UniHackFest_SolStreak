export const SOL_DECIMALS = 9;
export const USDC_DECIMALS = 6;

export interface TokenAmount {
  amount: string;
  decimals: number;
}

export interface FundingRpc {
  getBalance(address: string): Promise<number>;
  getTokenAccountsByOwner(owner: string, mint: string): Promise<TokenAmount[]>;
}

export interface FundingBalances {
  sol: string;
  usdc: string;
}

export type FundingLoadResult =
  | { balances: FundingBalances; error: null }
  | { balances: null; error: string };

export function formatBaseUnits(value: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = (value % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/** Read-only mainnet balance lookup. It never creates an ATA or transaction. */
export async function readFundingBalances(
  rpc: FundingRpc,
  walletAddress: string,
  usdcMint: string,
): Promise<FundingBalances> {
  const [lamports, tokenAccounts] = await Promise.all([
    rpc.getBalance(walletAddress),
    rpc.getTokenAccountsByOwner(walletAddress, usdcMint),
  ]);

  if (!Number.isSafeInteger(lamports) || lamports < 0) {
    throw new Error('Invalid SOL balance returned by RPC');
  }

  const usdcBaseUnits = tokenAccounts.reduce((total, token) => {
    if (token.decimals !== USDC_DECIMALS || !/^\d+$/.test(token.amount)) {
      throw new Error('Invalid USDC balance returned by RPC');
    }
    return total + BigInt(token.amount);
  }, 0n);

  return {
    sol: formatBaseUnits(BigInt(lamports), SOL_DECIMALS),
    // An empty account list is the normal "ATA does not exist" case.
    usdc: formatBaseUnits(usdcBaseUnits, USDC_DECIMALS),
  };
}

export async function loadFundingBalances(
  rpc: FundingRpc,
  walletAddress: string,
  usdcMint: string,
): Promise<FundingLoadResult> {
  try {
    return {
      balances: await readFundingBalances(rpc, walletAddress, usdcMint),
      error: null,
    };
  } catch {
    // RPC errors may contain a credential-bearing URL. Never return the raw message.
    return {
      balances: null,
      error: 'Unable to read balances from Solana RPC. Please refresh and try again.',
    };
  }
}
