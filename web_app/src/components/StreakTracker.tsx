'use client';

import Image from 'next/image';

import type { StreakDay } from '@/hooks/usePortfolio';

interface Props {
  days: StreakDay[];
  currentStreak: number;
  loading: boolean;
}

const STREAK_TIERS = [
  { minimum: 0, label: 'Spark', next: 7 },
  { minimum: 7, label: 'Steady', next: 15 },
  { minimum: 15, label: 'Momentum', next: 30 },
  { minimum: 30, label: 'Unbreakable', next: null },
] as const;

function streakTier(currentStreak: number) {
  return [...STREAK_TIERS].reverse().find(tier => currentStreak >= tier.minimum) ?? STREAK_TIERS[0];
}

/** A compact seven-day command center for the current saving ritual. */
export default function StreakTracker({ days, currentStreak, loading }: Props) {
  const today = days.length > 0 ? days[days.length - 1] : null;
  const perfectWeek = days.length === 7 && days.every(day => day.deposited);
  const depositedThisWeek = days.filter(day => day.deposited).length;
  const tier = streakTier(currentStreak);
  const nextTarget = tier.next;
  const progressStart = tier.minimum;
  const progress = nextTarget === null
    ? 100
    : Math.min(100, Math.max(0, ((currentStreak - progressStart) / (nextTarget - progressStart)) * 100));
  const remaining = nextTarget === null ? 0 : Math.max(0, nextTarget - currentStreak);
  const tierKey = currentStreak >= 30 ? 'diamond' : currentStreak >= 15 ? 'gold' : currentStreak >= 7 ? 'silver' : 'bronze';

  return (
    <section className="streak-console" data-tier={tierKey} aria-labelledby="streak-tracker-title">
      <div className="streak-console-grid" aria-hidden="true" />
      <div className="streak-console-glow" aria-hidden="true" />

      <header className="relative z-10 grid gap-5 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <p className="eyebrow text-amber-300">Seven-day signal</p>
          <h2 id="streak-tracker-title" className="mt-2 font-display text-2xl font-bold text-white sm:text-3xl">
            Your ritual is <span className="streak-gradient-text">{currentStreak} {currentStreak === 1 ? 'day' : 'days'} strong.</span>
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Each verified Devnet deposit lights another day. Deposits confirmed before 3:00 AM (GMT+7) still count for the previous day.
          </p>
        </div>
        <div className="streak-orb" aria-label={`${tier.label} streak tier`}>
          <span className="streak-orb-ring" aria-hidden="true" />
          <Image
            src={currentStreak >= 15 ? '/assets/images/SolStreak.png' : '/assets/images/NormalStreak.png'}
            alt=""
            width={86}
            height={86}
            className="relative z-10 h-16 w-16 object-contain sm:h-20 sm:w-20"
          />
          <span className="relative z-10 text-center">
            <small className="block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Current tier</small>
            <strong className="mt-1 block font-display text-sm text-white">{tier.label}</strong>
          </span>
        </div>
      </header>

      <div className="streak-week-panel relative z-10 mt-6 rounded-2xl border border-white/[0.07] bg-black/20 p-4 backdrop-blur-md sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-300">{depositedThisWeek}/7 days secured this week</span>
          <span className="text-slate-500">
            {nextTarget === null ? 'Highest streak tier reached' : `${remaining} ${remaining === 1 ? 'day' : 'days'} to ${nextTarget}`}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-label={`${Math.round(progress)} percent to next streak tier`}>
          <span className="streak-progress block h-full rounded-full" style={{ width: `${progress}%` }} />
        </div>

        {loading && days.length === 0 ? (
          <div className="mt-5 grid animate-pulse grid-cols-7 gap-1.5 sm:gap-3">
            {Array.from({ length: 7 }).map((_, index) => <div key={index} className="h-20 rounded-2xl bg-white/[0.06]" />)}
          </div>
        ) : days.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
            Your seven-day activity will appear after the first verified deposit.
          </div>
        ) : (
          <ol className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-3" aria-label="Last seven saving days">
            {days.map((day) => {
              const date = new Date(`${day.date}T00:00:00`);
              const isToday = day.date === today?.date;
              return (
                <li
                  key={day.date}
                  className="streak-day-card"
                  data-deposited={day.deposited ? 'true' : 'false'}
                  data-today={isToday ? 'true' : 'false'}
                  title={`${day.date}${day.deposited ? ' — deposit confirmed' : ' — no confirmed deposit'}`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 sm:text-[10px]">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className="streak-day-symbol">
                    {day.deposited
                      ? <Image src="/assets/images/NormalStreak.png" alt="Deposit confirmed" width={34} height={34} className="h-7 w-7 object-contain sm:h-8 sm:w-8" />
                      : <span>{date.getDate()}</span>}
                  </span>
                  <span className="hidden text-[9px] font-medium text-slate-500 sm:block">
                    {isToday ? 'Today' : day.deposited ? 'Secured' : 'Rest'}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {days.length > 0 && (
        <div className={`relative z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${today?.deposited ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100' : 'border-amber-300/20 bg-amber-300/[0.07] text-amber-100'}`}>
          <span className="font-medium">
            {today?.deposited ? '✓ Today is secured — your streak is protected.' : '○ Today is still open — make one verified deposit to keep the flame alive.'}
          </span>
          {perfectWeek && <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 font-bold uppercase tracking-wider text-amber-200">Perfect week</span>}
        </div>
      )}
    </section>
  );
}
