export const BADGE_ARTWORK = {
  BRONZE: '/assets/images/BronzeMedal.png',
  SILVER: '/assets/images/SilverMedal.png',
  GOLD: '/assets/images/GoldMedal.png',
  DIAMOND: '/assets/images/Diamond.png',
  JACKPOT: '/assets/images/Jackpot.png',
} as const;

export type BadgeArtworkCode = keyof typeof BADGE_ARTWORK;

export const BADGE_ARTWORK_CODES = (
  ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'JACKPOT'] as const
) satisfies readonly BadgeArtworkCode[];

export const BADGE_LABELS: Record<BadgeArtworkCode, string> = {
  BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold', DIAMOND: 'Diamond', JACKPOT: 'Jackpot',
};

export const BADGE_GLOW_CLASSES: Record<BadgeArtworkCode, string> = {
  BRONZE: 'shadow-[0_0_24px_rgba(180,83,9,0.28)]',
  SILVER: 'shadow-[0_0_24px_rgba(203,213,225,0.24)]',
  GOLD: 'shadow-[0_0_28px_rgba(251,191,36,0.30)]',
  DIAMOND: 'shadow-[0_0_30px_rgba(34,211,238,0.32)]',
  JACKPOT: 'shadow-[0_0_34px_rgba(217,70,239,0.38)]',
};
