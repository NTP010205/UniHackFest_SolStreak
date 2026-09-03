'use client';

import { useCallback, useEffect, useState } from 'react';
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
  const refresh = useCallback(async () => {
    if (!walletAddress || !identityToken) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/profile/badges?wallet=${encodeURIComponent(walletAddress)}`, {
        headers: { 'privy-id-token': identityToken },
      });
      if (!response.ok) throw new Error('Badge profile is temporarily unavailable');
      setData(await response.json() as BadgeProfileData);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Badge profile is temporarily unavailable');
    } finally { setLoading(false); }
  }, [identityToken, walletAddress]);
  useEffect(() => { void refresh(); }, [refresh, refreshKey]);
  return { data, loading, error, refresh };
}
