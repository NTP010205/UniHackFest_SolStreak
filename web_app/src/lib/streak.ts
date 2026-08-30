const TZ = 'Asia/Ho_Chi_Minh';
export const GRACE_HOURS = 3;

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface StreakState {
  current: number;
  longest: number;
  lastDay: string | null;
}

/** A confirmation before 03:00 Vietnam time belongs to the previous streak day. */
export function streakDayOf(blockTime: Date): string {
  return dayFormatter.format(new Date(blockTime.getTime() - GRACE_HOURS * 3_600_000));
}

export function calendarDayVN(at: Date): string {
  return dayFormatter.format(at);
}

export function previousDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date - 1)).toISOString().slice(0, 10);
}

export function updateStreak(previous: StreakState, newDay: string): StreakState {
  if (previous.lastDay === newDay) return previous;

  const current = previous.lastDay === previousDay(newDay) ? previous.current + 1 : 1;
  return {
    current,
    longest: Math.max(previous.longest, current),
    lastDay: newDay,
  };
}

export function lastCalendarDays(count: number, now = new Date()): string[] {
  const current = calendarDayVN(now);
  const days = [current];
  while (days.length < count) days.unshift(previousDay(days[0]));
  return days;
}
