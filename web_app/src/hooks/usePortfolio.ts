'use client';

import { useCallback, useEffect, useState } from 'react';
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

  const refresh = useCallback(async () => {
    if (!walletAddress || !identityToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/streak/status?wallet=${encodeURIComponent(walletAddress)}`, {
        headers: { 'privy-id-token': identityToken },
      });
      if (!res.ok) throw new Error(`Failed to load portfolio (HTTP ${res.status})`);
      setData((await res.json()) as DashboardData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }, [walletAddress, identityToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
