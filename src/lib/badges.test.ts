import { describe, expect, it } from 'vitest';

import { publicBadgeSpinResult, type BadgeSpinResult } from './badges';

const result: BadgeSpinResult = {
  spinId: '7', result: 'badge_bronze', badgeCode: 'BRONZE', label: 'Bronze Badge',
  isNewBadge: true, awardCount: 1, source: 'welcome_demo', remainingSpins: 0, replayed: false,
};

describe('canonical cosmetic badge response', () => {
  it('uses structural equality regardless of property insertion order', () => {
    const first = { badgeCode: 'BRONZE', awardCount: 1, source: 'welcome_demo' };
    const sameDataDifferentOrder = { source: 'welcome_demo', awardCount: 1, badgeCode: 'BRONZE' };
    expect(sameDataDifferentOrder).toStrictEqual(first);
  });

  it('keeps internal replay state out of the public response contract', () => {
    expect(publicBadgeSpinResult(result)).toStrictEqual({
      spinId: '7', result: 'badge_bronze', badgeCode: 'BRONZE', label: 'Bronze Badge',
      isNewBadge: true, awardCount: 1, source: 'welcome_demo', remainingSpins: 0,
    });
    expect(publicBadgeSpinResult({ ...result, replayed: true })).toStrictEqual(publicBadgeSpinResult(result));
  });
});
