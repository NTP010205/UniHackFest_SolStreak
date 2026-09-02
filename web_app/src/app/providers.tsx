'use client';

import { useEffect, useState } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { CLIENT_PUBLIC_CONFIG } from '@/lib/clientPublicConfig';


const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();
const PRIVY_CONFIGURED = Boolean(
  PRIVY_APP_ID && PRIVY_APP_ID !== 'your-privy-app-id' && PRIVY_APP_ID !== 'solstreak-demo-app-id',
);

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

  // Privy validates the app ID during provider initialization. Rendering an
  // actionable setup state here keeps local development usable without ever
  // falling back to a fake identity provider configuration.
  if (!PRIVY_CONFIGURED || !PRIVY_APP_ID) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-night-950 px-4 text-slate-100">
        <section className="glass-card w-full max-w-xl p-7 sm:p-9" role="alert">
          <span className="devnet-pill">LOCAL SETUP REQUIRED</span>
          <h1 className="mt-5 font-display text-2xl font-bold text-white">
            Connect a Privy application
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Create or open your app in the Privy dashboard, then add its real app ID to
            <code className="mx-1 rounded bg-white/[0.07] px-1.5 py-0.5 text-violet-200">web_app/.env.local</code>.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-cyan-200">
            NEXT_PUBLIC_PRIVY_APP_ID=your_real_privy_app_id
          </pre>
          <p className="mt-4 text-xs text-slate-500">Restart <code>npm run dev</code> after changing environment variables.</p>
        </section>
      </main>
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
