'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIdentityToken } from '@privy-io/react-auth';

export interface StreakDay {
  /** YYYY-MM-DD in Asia/Ho_Chi_Minh. */
  date: string;
  deposited: boolean;
}

export interface DashboardData {
  wallet: string;
  totalDepositedUsdc: number;
  currentPositionUsdc: number | null;
  positionUnavailable: boolean;
  currentStreak: number;
  longestStreak: number;
  last7Days: StreakDay[];
  canSpin: boolean;
  networkProfile: 'mainnet' | 'devnet';
}

/**
 * Loads the dashboard payload from the backend streak engine
 * (GET /api/streak/status?wallet=…). No fetch happens until the embedded
 * wallet has an address, so we never issue premature calls while Privy
 * is initializing.
 */
export function usePortfolio(walletAddress: string | undefined) {
  const { identityToken } = useIdentityToken();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const identityTokenRef = useRef(identityToken);
  identityTokenRef.current = identityToken;
  const hasIdentityToken = Boolean(identityToken);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    const token = identityTokenRef.current;
    if (!walletAddress || !token) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/streak/status?wallet=${encodeURIComponent(walletAddress)}`, {
        headers: { 'privy-id-token': token },
      });
      if (!res.ok) throw new Error(`Failed to load portfolio (HTTP ${res.status})`);
      const nextData = await res.json() as DashboardData;
      if (version !== requestVersion.current) return;
      setData(nextData);
      setError(null);
    } catch (err) {
      if (version !== requestVersion.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load portfolio');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [walletAddress, hasIdentityToken]);

  useEffect(() => {
    setData(null);
    setError(null);
    void refresh();
    return () => { requestVersion.current += 1; };
  }, [refresh]);

  return { data, loading, error, refresh };
}
