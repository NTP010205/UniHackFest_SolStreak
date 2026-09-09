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
import { InteractiveBackground } from '@/components/background/InteractiveBackground';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useSolStreakWallet } from '@/hooks/useSolStreakWallet';
import { ACTIVE_NETWORK } from '@/lib/networkProfile';
import { VideoOverlay } from '@/components/ui/VideoOverlay';
import AdminLab from '@/components/AdminLab';
import BadgeCollection from '@/components/BadgeCollection';
import DashboardHero from '@/components/dashboard/DashboardHero';

export default function DashboardPage() {
  const { ready, authenticated, wallet, sessionKey } = useSolStreakWallet();
  const showPrivyVerification = ACTIVE_NETWORK.name === 'devnet';
  const router = useRouter();
  const { data, loading, error, refresh } = usePortfolio(wallet?.address);
  const previousStreak = useRef<number | null>(null);
  const [showStreakAnimation, setShowStreakAnimation] = useState(false);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [isDevnetAdmin, setIsDevnetAdmin] = useState(false);
  const [verifiedSessionKey, setVerifiedSessionKey] = useState<string | null>(null);
  const refreshDashboard = useCallback(() => {
    setProfileRefreshKey(value => value + 1);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!data) return;
    if (previousStreak.current !== null && previousStreak.current < 15 && data.currentStreak >= 15) {
      setShowStreakAnimation(true);
    }
    previousStreak.current = data.currentStreak;
  }, [data]);

  const finishStreakAnimation = useCallback(() => setShowStreakAnimation(false), []);
  const walletVerified = sessionKey !== null && verifiedSessionKey === sessionKey;
  const updateWalletVerification = useCallback((verified: boolean) => {
    setVerifiedSessionKey(verified && sessionKey ? sessionKey : null);
  }, [sessionKey]);

  useEffect(() => {
    setVerifiedSessionKey(null);
    setIsDevnetAdmin(false);
    previousStreak.current = null;
    setShowStreakAnimation(false);
  }, [sessionKey]);

  // Auth guard: once Privy reports ready, signed-out users go back to the
  // landing page. Until then we render a loader below — never a blank screen
  // and never wallet operations against an uninitialized provider.
  useEffect(() => {
    if (ready && !authenticated) router.replace('/');
  }, [ready, authenticated, router]);

  if (!ready || !authenticated || !wallet || !sessionKey) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-slate-400">
          <Spinner className="h-8 w-8 text-violet-400" />
          <p className="text-sm" aria-live="polite">
            {!ready ? 'Initializing secure wallet…' : 'Loading your dashboard…'}
          </p>
        </div>
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
      <DashboardHero
        walletAddress={wallet.address}
        currentStreak={data?.currentStreak ?? 0}
        walletVerified={walletVerified}
        isDevnetAdmin={isDevnetAdmin}
      />

      <div className="mt-6 animate-rise [animation-delay:90ms]">
        <PortfolioStats data={data} loading={loading && !data} />
      </div>

      <AdminLab
        key={`admin:${sessionKey}`}
        walletAddress={wallet.address}
        onChanged={refreshDashboard}
        onAdminStatusChange={setIsDevnetAdmin}
        refreshKey={profileRefreshKey}
      />

      <section id="wallet-readiness" className="mt-10 scroll-mt-24" aria-labelledby="wallet-readiness-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow text-cyan-300">01 · Prove control</p>
            <h2 id="wallet-readiness-heading" className="mt-2 font-display text-2xl font-bold text-white">Ready your active wallet.</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-slate-500">Balances are read-only. Message verification unlocks the transaction controls for this signed-in wallet session.</p>
        </div>
        <div className={`grid gap-6 ${showPrivyVerification ? 'lg:grid-cols-[1.3fr_.7fr]' : ''}`}>
          <FundingReadiness wallet={wallet} className="h-full" />
          {showPrivyVerification && (
            <PrivyVerification
              key={`verification:${sessionKey}`}
              ready={ready}
              authenticated={authenticated}
              wallet={wallet}
              sessionKey={sessionKey}
              onVerificationChange={updateWalletVerification}
              className="h-full"
            />
          )}
        </div>
      </section>

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

      <section className="mt-10" aria-labelledby="daily-loop-heading">
        <div className="mb-4">
          <p className="eyebrow text-amber-300">02 · Daily ritual</p>
          <h2 id="daily-loop-heading" className="mt-2 font-display text-2xl font-bold text-white">Save, verify, keep the flame.</h2>
        </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TransactionCard
            key={`transactions:${sessionKey}`}
            walletVerified={walletVerified}
            onTransactionComplete={refreshDashboard}
          />
          <StreakTracker
            days={data?.last7Days ?? []}
            currentStreak={data?.currentStreak ?? 0}
            loading={loading && !data}
          />
        </div>
        <LuckyWheel
          key={`wheel:${sessionKey}`}
          walletAddress={wallet.address}
          canSpin={data?.canSpin ?? false}
          isDevnetAdmin={isDevnetAdmin}
          onSpinComplete={refreshDashboard}
        />
      </div>
      </section>
      <section className="mt-10" aria-labelledby="collection-heading">
        <div className="mb-4">
          <p className="eyebrow text-violet-300">03 · Cosmetic proof</p>
          <h2 id="collection-heading" className="mt-2 font-display text-2xl font-bold text-white">Your discipline, made visible.</h2>
        </div>
        <BadgeCollection key={`badges:${sessionKey}`} walletAddress={wallet.address} refreshKey={profileRefreshKey} />
      </section>
      </div>
    </div>
  );
}
