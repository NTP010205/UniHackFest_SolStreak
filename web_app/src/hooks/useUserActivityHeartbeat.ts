'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useIdentityToken } from '@privy-io/react-auth';

export const USER_ACTIVITY_HEARTBEAT_MS = 30_000;

/** Keeps the authenticated dashboard session visible to the read-only Admin table. */
export function useUserActivityHeartbeat(walletAddress: string | undefined) {
  const { identityToken } = useIdentityToken();
  const identityTokenRef = useRef(identityToken);
  identityTokenRef.current = identityToken;
  const hasIdentityToken = Boolean(identityToken);

  const sendHeartbeat = useCallback(async () => {
    const token = identityTokenRef.current;
    if (!walletAddress || !token || document.visibilityState !== 'visible') return;
    try {
      await fetch('/api/activity/heartbeat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'privy-id-token': token,
        },
        body: JSON.stringify({ wallet: walletAddress }),
      });
    } catch {
      // Presence is best-effort and must never block dashboard transactions.
    }
  }, [walletAddress, hasIdentityToken]);

  useEffect(() => {
    if (!walletAddress || !hasIdentityToken) return;
    void sendHeartbeat();
    const interval = window.setInterval(() => void sendHeartbeat(), USER_ACTIVITY_HEARTBEAT_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void sendHeartbeat();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [hasIdentityToken, sendHeartbeat, walletAddress]);
}
