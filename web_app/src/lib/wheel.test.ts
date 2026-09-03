import { afterEach, describe, expect, it, vi } from 'vitest';

import { badgeCodeFor, spinAdminWeighted, spinWeighted, WHEEL_PRIZES } from './wheel';

describe('server-side weighted wheel', () => {
  afterEach(() => vi.restoreAllMocks());

  it('maps the start and end of the random range to valid prizes', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(spinWeighted()).toBe('badge_bronze');

    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    expect(spinWeighted()).toBe('jackpot_usdc');
  });

  it('has positive weights totaling 100', () => {
    const weights = Object.values(WHEEL_PRIZES).map((prize) => prize.weight);
    expect(weights.every((weight) => weight > 0)).toBe(true);
    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBe(100);
  });
});

describe('Devnet Admin Lab wheel distribution', () => {
  afterEach(() => vi.restoreAllMocks());
  it.each([
    [0, 'badge_bronze'], [0.399999, 'badge_bronze'], [0.4, 'badge_silver'],
    [0.669999, 'badge_silver'], [0.67, 'badge_gold'], [0.899999, 'badge_gold'],
    [0.9, 'badge_diamond'], [0.949999, 'badge_diamond'], [0.95, 'jackpot_usdc'],
  ] as const)('maps random value %s to %s', (random, expected) => {
    vi.spyOn(Math, 'random').mockReturnValue(random);
    expect(spinAdminWeighted()).toBe(expected);
  });
});

describe('cosmetic badge catalog', () => {
  it('keeps the established weights while mapping every outcome to a stable badge code', () => {
    expect(Object.fromEntries(Object.entries(WHEEL_PRIZES).map(([id, prize]) => [id, prize.weight]))).toEqual({
      badge_bronze: 30, badge_silver: 20, badge_flame: 15, discount_fee: 10,
      badge_gold: 8, streak_boost: 7, badge_diamond: 5, jackpot_usdc: 5,
    });
    expect(Object.keys(WHEEL_PRIZES).map(id => badgeCodeFor(id as keyof typeof WHEEL_PRIZES))).toEqual([
      'BRONZE', 'SILVER', 'GOLD', 'BRONZE', 'GOLD', 'SILVER', 'DIAMOND', 'JACKPOT',
    ]);
  });
});
