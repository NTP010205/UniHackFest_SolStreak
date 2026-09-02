'use client';

import Image from 'next/image';

import type { DashboardData } from '@/hooks/usePortfolio';
import { formatUsdc } from '@/lib/format';
import { ACTIVE_NETWORK } from '@/lib/networkProfile';

interface Props {
  data: DashboardData | null;
  loading: boolean;
}

function StatCard({
  iconSrc,
  label,
  value,
  hint,
  accent,
}: {
  iconSrc: string;
  label: string;
  value: string;
  hint: string;
  accent: 'violet' | 'amber' | 'gold';
}) {
  const accents = {
    violet: 'border-violet-400/20 bg-violet-500/[0.07] text-violet-300',
    amber: 'border-amber-400/25 bg-amber-400/[0.07] text-amber-300',
    gold: 'border-yellow-400/20 bg-yellow-400/[0.06] text-yellow-300',
  } as const;

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg ${accents[accent]}`}>
          <Image src={iconSrc} alt="" width={40} height={40} className="h-9 w-9 object-contain" />
        </span>
        <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      </div>
      {accent === 'amber' ? (
        <p className="text-glow-amber mt-3 font-display text-3xl font-bold text-amber-300 sm:text-4xl">
          {value}
        </p>
      ) : (
        <p className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">{value}</p>
      )}
      <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/5 bg-white/[0.03] p-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-white/10" />
        <div className="h-3 w-24 rounded bg-white/10" />
      </div>
      <div className="mt-4 h-9 w-28 rounded bg-white/10" />
      <div className="mt-3 h-3 w-36 rounded bg-white/5" />
    </div>
  );
}

export default function PortfolioStats({ data, loading }: Props) {
  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        iconSrc="/assets/images/Coin.png"
        label="Jupiter Position"
        value={data?.currentPositionUsdc != null ? `${ACTIVE_NETWORK.name === 'mainnet' ? '$' : ''}${formatUsdc(data.currentPositionUsdc)}${ACTIVE_NETWORK.name === 'devnet' ? ' Devnet USDC' : ''}` : '—'}
        hint={
          data
            ? `All-time deposits: ${ACTIVE_NETWORK.name === 'mainnet' ? '$' : ''}${formatUsdc(data.totalDepositedUsdc)}${ACTIVE_NETWORK.name === 'devnet' ? ' test USDC — no financial value' : ''}`
            : 'Current redeemable USDC'
        }
        accent="violet"
      />
      <StatCard
        iconSrc={data && data.currentStreak >= 15 ? '/assets/images/SolStreak.png' : '/assets/images/NormalStreak.png'}
        label="Current Streak"
        value={data ? `${data.currentStreak} ${data.currentStreak === 1 ? 'day' : 'days'}` : '—'}
        hint="consecutive days with a deposit"
        accent="amber"
      />
      <StatCard
        iconSrc="/assets/images/Trophie.png"
        label="Longest Streak"
        value={data ? `${data.longestStreak} ${data.longestStreak === 1 ? 'day' : 'days'}` : '—'}
        hint="your personal record"
        accent="gold"
      />
    </div>
  );
}
