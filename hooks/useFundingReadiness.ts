'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';

import { loadFundingBalances, type FundingBalances, type FundingRpc } from '@/lib/fundingReadiness';
import { SOLANA_RPC_URL } from '@/lib/transactionSafety';
import { ACTIVE_NETWORK } from '@/lib/networkProfile';

const USDC_MINT = ACTIVE_NETWORK.usdcMint;

export function useFundingReadiness(walletAddress: string) {
  const [balances, setBalances] = useState<FundingBalances | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const rpc = useMemo<FundingRpc | null>(() => {
    if (!SOLANA_RPC_URL || !USDC_MINT) return null;
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    return {
      getBalance: (address) => connection.getBalance(new PublicKey(address), 'confirmed'),
      getTokenAccountsByOwner: async (owner, mint) => {
        const response = await connection.getParsedTokenAccountsByOwner(
          new PublicKey(owner),
          { mint: new PublicKey(mint) },
          'confirmed',
        );
        return response.value.map(({ account }) => {
          if (!('parsed' in account.data)) {
            throw new Error('Unexpected token account data returned by RPC');
          }
          const tokenAmount = account.data.parsed?.info?.tokenAmount as
            | { amount?: unknown; decimals?: unknown }
            | undefined;
          if (typeof tokenAmount?.amount !== 'string' || typeof tokenAmount.decimals !== 'number') {
            throw new Error('Invalid token account data returned by RPC');
          }
          return { amount: tokenAmount.amount, decimals: tokenAmount.decimals };
        });
      },
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!rpc) {
      setError('Balance RPC configuration is not ready.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await loadFundingBalances(rpc, walletAddress, USDC_MINT);
      if (result.error) {
        setError(result.error);
        return;
      }
      setBalances(result.balances);
      setUpdatedAt(new Date());
    } finally {
      setLoading(false);
    }
  }, [rpc, walletAddress]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { balances, loading, error, updatedAt, refresh };
}
