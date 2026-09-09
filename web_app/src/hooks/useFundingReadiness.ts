'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const requestVersion = useRef(0);

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
    const version = ++requestVersion.current;
    if (!rpc) {
      setBalances(null);
      setError('Balance RPC configuration is not ready.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await loadFundingBalances(rpc, walletAddress, USDC_MINT);
      if (version !== requestVersion.current) return;
      if (result.error) {
        setBalances(null);
        setError(result.error);
        return;
      }
      setBalances(result.balances);
      setUpdatedAt(new Date());
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [rpc, walletAddress]);

  useEffect(() => {
    setBalances(null);
    setUpdatedAt(null);
    setError(null);
    void refresh();
    return () => { requestVersion.current += 1; };
  }, [refresh]);

  return { balances, loading, error, updatedAt, refresh };
}
