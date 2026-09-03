/**
 * SERVER-ONLY lucky wheel configuration (roadmap Phase 4).
 *
 * These weights must never be imported into a client component. The client
 * receives only the winning id AFTER the draw has happened, and renders a
 * pure animation that lands on whatever the backend returned — if the spin
 * happened in the browser, users could tamper and pick outcomes.
 */
export const WHEEL_PRIZES = {
  badge_bronze: { label: 'Bronze Badge', badgeCode: 'BRONZE', weight: 30 },
  badge_silver: { label: 'Silver Badge', badgeCode: 'SILVER', weight: 20 },
  badge_flame: { label: 'Gold Badge', badgeCode: 'GOLD', weight: 15 },
  discount_fee: { label: 'Bronze Badge', badgeCode: 'BRONZE', weight: 10 },
  badge_gold: { label: 'Gold Badge', badgeCode: 'GOLD', weight: 8 },
  streak_boost: { label: 'Silver Badge', badgeCode: 'SILVER', weight: 7 },
  badge_diamond: { label: 'Diamond Badge', badgeCode: 'DIAMOND', weight: 5 },
  jackpot_usdc: { label: 'Jackpot Badge', badgeCode: 'JACKPOT', weight: 5 },
} as const;

export type WheelPrizeId = keyof typeof WHEEL_PRIZES;
export type BadgeCode = typeof WHEEL_PRIZES[WheelPrizeId]['badgeCode'];
export const BADGE_CODES = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'JACKPOT'] as const;
export const BADGE_CATALOG_VERSION = 1;

/** Weighted random draw — the ONLY place an outcome is decided. */
export function spinWeighted(): WheelPrizeId {
  const entries = Object.entries(WHEEL_PRIZES) as [WheelPrizeId, { label: string; weight: number }][];
  const total = entries.reduce((sum, [, prize]) => sum + prize.weight, 0);
  let roll = Math.random() * total;
  for (const [id, prize] of entries) {
    roll -= prize.weight;
    if (roll < 0) return id;
  }
  return entries[entries.length - 1][0];
}

const ADMIN_TEST_PRIZES = [
  ['badge_bronze', 40],
  ['badge_silver', 27],
  ['badge_gold', 23],
  ['badge_diamond', 5],
  ['jackpot_usdc', 5],
] as const satisfies readonly (readonly [WheelPrizeId, number])[];

/** Devnet Admin Lab draw; still server-controlled and cosmetic-only. */
export function spinAdminWeighted(): WheelPrizeId {
  let roll = Math.random() * 100;
  for (const [id, weight] of ADMIN_TEST_PRIZES) {
    roll -= weight;
    if (roll < 0) return id;
  }
  return 'jackpot_usdc';
}

export function prizeLabel(id: WheelPrizeId): string {
  return WHEEL_PRIZES[id].label;
}

export function badgeCodeFor(id: WheelPrizeId): BadgeCode {
  return WHEEL_PRIZES[id].badgeCode;
}
