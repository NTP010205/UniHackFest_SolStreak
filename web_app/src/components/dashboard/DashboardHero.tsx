'use client';

import Image from 'next/image';

import { truncateAddress } from '@/lib/format';

export default function DashboardHero({
  walletAddress,
  currentStreak,
  walletVerified,
  isDevnetAdmin,
}: {
  walletAddress: string;
  currentStreak: number;
  walletVerified: boolean;
  isDevnetAdmin: boolean;
}) {
  return (
    <section className="dashboard-hero-panel animate-rise" aria-labelledby="dashboard-title">
      <div className="dashboard-hero-grid" aria-hidden="true" />
      <div className="dashboard-hero-glow" aria-hidden="true" />
      <div className="relative z-10 max-w-2xl">
        <p className="eyebrow text-amber-300">Your Devnet vault</p>
        <h1 id="dashboard-title" className="dashboard-title">
          Keep today&apos;s <span>saving streak</span> alive.
        </h1>
        <p className="dashboard-description">
          Verify your active wallet, make one intentional test deposit, then watch your on-chain progress and cosmetic collection grow.
        </p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <span className="dashboard-status-chip">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.9)]" />
            {truncateAddress(walletAddress, 6, 6)}
          </span>
          <span className={`dashboard-status-chip ${walletVerified ? 'is-verified' : 'is-pending'}`}>
            {walletVerified ? '✓ Wallet verified' : '○ Verification required'}
          </span>
          <span className="dashboard-status-chip is-devnet">Devnet test assets</span>
        </div>

        <nav className="mt-6 flex flex-wrap gap-2" aria-label="Dashboard shortcuts">
          <a className="dashboard-shortcut dashboard-shortcut-primary" href="#transactions">Save today</a>
          <a className="dashboard-shortcut" href="#wallet-readiness">Wallet readiness</a>
          <a className="dashboard-shortcut" href="#lucky-wheel">Lucky Wheel</a>
          <a className="dashboard-shortcut" href="#badges">Badges</a>
          {isDevnetAdmin && <a className="dashboard-shortcut" href="/admin">Admin workspace</a>}
        </nav>
      </div>

      <div className="dashboard-art-scene" aria-hidden="true">
        <span className="dashboard-art-ring dashboard-art-ring-outer" />
        <span className="dashboard-art-ring dashboard-art-ring-inner" />
        <Image
          src="/assets/images/Deposit.png"
          alt=""
          width={512}
          height={512}
          priority
          className="dashboard-piggy"
        />
        <Image src="/assets/images/Coin.png" alt="" width={160} height={160} className="dashboard-floating-coin" />
        <Image src="/assets/images/NormalStreak.png" alt="" width={150} height={150} className="dashboard-floating-flame" />
        <div className="dashboard-streak-chip">
          <span className="text-amber-300">Current ritual</span>
          <strong>{currentStreak} {currentStreak === 1 ? 'day' : 'days'}</strong>
        </div>
      </div>
    </section>
  );
}
