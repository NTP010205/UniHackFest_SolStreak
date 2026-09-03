import { describe, expect, it } from 'vitest';
import { BADGE_ARTWORK, BADGE_ARTWORK_CODES, BADGE_GLOW_CLASSES, BADGE_LABELS } from './badgeArtwork';
import { BADGE_CODES } from './wheel';

describe('client-safe badge artwork catalog', () => {
  it('maps every stable badge code to the approved artwork', () => {
    expect(Object.keys(BADGE_ARTWORK)).toEqual([...BADGE_CODES]);
    expect(BADGE_ARTWORK).toEqual({
      BRONZE: '/assets/images/BronzeMedal.png', SILVER: '/assets/images/SilverMedal.png',
      GOLD: '/assets/images/GoldMedal.png', DIAMOND: '/assets/images/Diamond.png',
      JACKPOT: '/assets/images/Jackpot.png',
    });
    expect(JSON.stringify(BADGE_ARTWORK)).not.toMatch(/weight|probability|random/i);
    expect(BADGE_ARTWORK_CODES).toEqual(['BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'JACKPOT']);
    expect(Object.keys(BADGE_LABELS)).toEqual([...BADGE_CODES]);
    expect(Object.keys(BADGE_GLOW_CLASSES)).toEqual([...BADGE_CODES]);
  });
});
