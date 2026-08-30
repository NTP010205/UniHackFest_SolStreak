import { describe, expect, it } from 'vitest';

import { lastCalendarDays, streakDayOf, updateStreak } from './streak';

describe('streak day with Vietnam grace window', () => {
  it('counts confirmations before 03:00 Vietnam time for the previous day', () => {
    expect(streakDayOf(new Date('2026-08-27T19:59:59Z'))).toBe('2026-08-27');
    expect(streakDayOf(new Date('2026-08-27T20:00:00Z'))).toBe('2026-08-28');
  });

  it('handles duplicate, consecutive and broken streaks', () => {
    const empty = { current: 0, longest: 0, lastDay: null };
    const first = updateStreak(empty, '2026-08-25');
    expect(first).toEqual({ current: 1, longest: 1, lastDay: '2026-08-25' });
    expect(updateStreak(first, '2026-08-25')).toEqual(first);
    expect(updateStreak(first, '2026-08-26')).toEqual({
      current: 2,
      longest: 2,
      lastDay: '2026-08-26',
    });
    expect(updateStreak({ current: 7, longest: 9, lastDay: '2026-08-20' }, '2026-08-26')).toEqual({
      current: 1,
      longest: 9,
      lastDay: '2026-08-26',
    });
  });

  it('builds seven Vietnam calendar days across a month boundary', () => {
    expect(lastCalendarDays(3, new Date('2026-09-01T04:00:00Z'))).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
    ]);
  });
});
