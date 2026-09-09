'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIdentityToken } from '@privy-io/react-auth';
import type { BadgeArtworkCode } from '@/lib/badgeArtwork';

export interface BadgeProfileData {
  networkProfile: 'mainnet' | 'devnet';
  badges: Array<{ badgeCode: BadgeArtworkCode; displayLabel: string; awardCount: number;
    firstEarnedAt: string; lastEarnedAt: string }>;
  recentHistory: Array<{ spinId: string; badgeCode: BadgeArtworkCode; displayLabel: string; awardedAt: string }>;
  availableSpinEntitlements: Array<{ entitlementId: string; source: 'welcome_demo' | 'streak'; createdAt: string }>;
}

export function useBadgeProfile(walletAddress: string | undefined, refreshKey = 0) {
  const { identityToken } = useIdentityToken();
  const [data, setData] = useState<BadgeProfileData | null>(null);
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
      const response = await fetch(`/api/profile/badges?wallet=${encodeURIComponent(walletAddress)}`, {
        headers: { 'privy-id-token': token },
      });
      if (!response.ok) throw new Error('Badge profile is temporarily unavailable');
      const nextData = await response.json() as BadgeProfileData;
      if (version !== requestVersion.current) return;
      setData(nextData);
      setError(null);
    } catch (cause) {
      if (version !== requestVersion.current) return;
      setError(cause instanceof Error ? cause.message : 'Badge profile is temporarily unavailable');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [hasIdentityToken, walletAddress]);
  useEffect(() => {
    setData(null);
    setError(null);
    void refresh();
    return () => { requestVersion.current += 1; };
  }, [refresh, refreshKey]);
  return { data, loading, error, refresh };
}
