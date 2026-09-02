'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import LuckyWheel from '@/components/LuckyWheel';
import FundingReadiness from '@/components/FundingReadiness';
import PortfolioStats from '@/components/PortfolioStats';
import PrivyVerification from '@/components/PrivyVerification';
import Spinner from '@/components/Spinner';
import StreakTracker from '@/components/StreakTracker';
import TransactionCard from '@/components/TransactionCard';
import Leaderboard from '@/components/Leaderboard';
import { InteractiveBackground } from '@/components/background/InteractiveBackground';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useSolStreakWallet } from '@/hooks/useSolStreakWallet';
import { truncateAddress } from '@/lib/format';
import { ACTIVE_NETWORK } from '@/lib/networkProfile';
import { VideoOverlay } from '@/components/ui/VideoOverlay';

export default function DashboardPage() {
  const { ready, authenticated, wallet } = useSolStreakWallet();
  const showPrivyVerification = process.env.NODE_ENV === 'development';
  const router = useRouter();
  const { data, loading, error, refresh } = usePortfolio(wallet?.address);
  const previousStreak = useRef<number | null>(null);
  const [showStreakAnimation, setShowStreakAnimation] = useState(false);

  useEffect(() => {
    if (!data) return;
    if (previousStreak.current !== null && previousStreak.current < 15 && data.currentStreak >= 15) {
      setShowStreakAnimation(true);
    }
    previousStreak.current = data.currentStreak;
  }, [data]);

  const finishStreakAnimation = useCallback(() => setShowStreakAnimation(false), []);

  // Auth guard: once Privy reports ready, signed-out users go back to the
  // landing page. Until then we render a loader below — never a blank screen
  // and never wallet operations against an uninitialized provider.
  useEffect(() => {
    if (ready && !authenticated) router.replace('/');
  }, [ready, authenticated, router]);

  if (!ready || !authenticated || !wallet) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-slate-400">
          <Spinner className="h-8 w-8 text-violet-400" />
          <p className="text-sm" aria-live="polite">
            {!ready ? 'Initializing secure wallet…' : 'Loading your dashboard…'}
          </p>
        </div>
        {showPrivyVerification && (
          <PrivyVerification ready={ready} authenticated={authenticated} wallet={wallet} />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {showStreakAnimation && (
        <VideoOverlay
          src="/assets/animations/Streak_Turned.webm"
          label="15-day SolStreak unlocked"
          onEnded={finishStreakAnimation}
        />
      )}
      <InteractiveBackground />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Your Vault</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Saving as{' '}
            <code
              className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-slate-300"
              title={wallet.address}
            >
              {truncateAddress(wallet.address, 6, 6)}
            </code>
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
          Connected to Solana {ACTIVE_NETWORK.name === 'devnet' ? 'Devnet' : 'Mainnet'}
        </span>
        {ACTIVE_NETWORK.name === 'devnet' && <span className="inline-flex w-fit rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-200">DEVNET — TEST ASSETS · No financial value</span>}
      </div>

      <FundingReadiness wallet={wallet} />

      {showPrivyVerification && (
        <div className="mt-6">
          <PrivyVerification ready={ready} authenticated={authenticated} wallet={wallet} />
        </div>
      )}

      {/* Portfolio stats */}
      <div className="mt-6">
        <PortfolioStats data={data} loading={loading && !data} />
      </div>

      {/* Portfolio fetch error — the page still works for transactions */}
      {error && (
        <div
          className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          role="alert"
        >
          ⚠ {error} — showing stale data.{' '}
          <button type="button" onClick={() => void refresh()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      )}

      {/* Main grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TransactionCard onTransactionComplete={() => void refresh()} />
          <StreakTracker
            days={data?.last7Days ?? []}
            currentStreak={data?.currentStreak ?? 0}
            loading={loading && !data}
          />
        </div>
        <LuckyWheel
          walletAddress={wallet.address}
          canSpin={data?.canSpin ?? false}
          onSpinComplete={() => void refresh()}
        />
      </div>
      <div className="mt-8"><Leaderboard walletAddress={wallet.address} /></div>
      </div>
    </div>
  );
}
