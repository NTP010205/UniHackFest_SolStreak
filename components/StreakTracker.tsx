'use client';

import type { StreakDay } from '@/hooks/usePortfolio';

interface Props {
  days: StreakDay[];
  currentStreak: number;
  loading: boolean;
}

/**
 * Visual tracker for the last 7 days. Deposited days glow amber with a
 * flame; the current day carries a violet ring so users always know
 * whether today is already secured.
 */
export default function StreakTracker({ days, currentStreak, loading }: Props) {
  const today = days.length > 0 ? days[days.length - 1].date : null;
  const perfectWeek = days.length > 0 && days.every((d) => d.deposited);

  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 shadow-card sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-white">Streak Tracker</h2>
        <div className="flex items-center gap-2">
          {perfectWeek && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
              ✨ Perfect week
            </span>
          )}
          <span className="text-glow-amber font-display text-lg font-bold text-amber-300">
            🔥 {currentStreak} {currentStreak === 1 ? 'day' : 'days'}
          </span>
        </div>
      </header>

      {/* Roadmap Phase 3: deposits before 3:00 AM (GMT+7) count for the previous day. */}
      <p className="mt-1 text-xs text-slate-500">
        Deposits confirmed before 3:00 AM (GMT+7) still count for the previous day.
      </p>

      {loading && days.length === 0 ? (
        <div className="mt-5 grid animate-pulse grid-cols-7 gap-1.5 sm:gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-white/10 sm:h-14" />
          ))}
        </div>
      ) : days.length === 0 ? (
        <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex h-9 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-slate-600 sm:h-12"
            >
              ?
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-3">
          {days.map((day) => {
            const d = new Date(`${day.date}T00:00:00`);
            const isToday = day.date === today;
            return (
              <div key={day.date} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <div
                  className={[
                    'flex h-9 w-full items-center justify-center rounded-xl border text-sm transition-all sm:h-12',
                    day.deposited
                      ? 'border-amber-400/30 bg-gradient-to-b from-amber-400/25 to-orange-500/10 text-amber-300 shadow-glow-amber'
                      : 'border-white/5 bg-white/[0.02] text-slate-600',
                    isToday ? 'ring-2 ring-violet-400/60 ring-offset-2 ring-offset-night-950' : '',
                  ].join(' ')}
                  title={`${day.date}${day.deposited ? ' — deposit confirmed' : ''}`}
                >
                  {day.deposited ? '🔥' : d.getDate()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {days.length > 0 && !days[days.length - 1].deposited && (
        <p className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2.5 text-xs text-violet-200">
          ⏳ Today isn&apos;t secured yet — make a deposit to keep your streak alive.
        </p>
      )}
    </section>
  );
}
