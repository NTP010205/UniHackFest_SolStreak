'use client';

import { useEffect, useState } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { CLIENT_PUBLIC_CONFIG } from '@/lib/clientPublicConfig';


// Falls back to a placeholder so `next build` stays green without env vars
// configured. Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local for real login flows.
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? 'solstreak-demo-app-id';

export function Providers({ children }: { children: React.ReactNode }) {
  // Privy cannot initialize during SSR/static prerendering (it validates the
  // app ID from the browser), so the provider mounts client-side only. Until
  // then a branded splash renders — never a blank screen, never a crash.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-night-950">
        <span className="text-glow-violet animate-pulse font-display text-2xl font-bold tracking-tight text-white">
          🔥 SolStreak
        </span>
      </div>
    );
  }

  const mainnetRpc = CLIENT_PUBLIC_CONFIG.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  const mainnetWss = CLIENT_PUBLIC_CONFIG.NEXT_PUBLIC_SOLANA_RPC_SUBSCRIPTIONS_URL?.trim();
  const devnetRpc = CLIENT_PUBLIC_CONFIG.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL?.trim();
  const devnetWss = CLIENT_PUBLIC_CONFIG.NEXT_PUBLIC_SOLANA_DEVNET_RPC_SUBSCRIPTIONS_URL?.trim();
  const rpcs = {
    ...(mainnetRpc && mainnetWss ? {
      'solana:mainnet': { rpc: createSolanaRpc(mainnetRpc), rpcSubscriptions: createSolanaRpcSubscriptions(mainnetWss) },
    } : {}),
    ...(devnetRpc && devnetWss ? {
      'solana:devnet': { rpc: createSolanaRpc(devnetRpc), rpcSubscriptions: createSolanaRpcSubscriptions(devnetWss) },
    } : {}),
  };

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Email + SMS only — the roadmap targets non-crypto-native savers,
        // so no wallet extensions or seed phrases in the primary flow.
        loginMethods: ['email', 'sms'],
        embeddedWallets: {
          solana: { createOnLogin: 'users-without-wallets' },
        },
        appearance: { theme: 'dark', walletChainType: 'solana-only' },
        solana: Object.keys(rpcs).length > 0
          ? { rpcs }
          : undefined,
      }}
    >
      {children}
    </PrivyProvider>
  );
}
