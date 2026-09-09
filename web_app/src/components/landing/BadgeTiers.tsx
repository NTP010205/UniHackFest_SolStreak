import Image from 'next/image';
import { BADGE_ARTWORK, BADGE_ARTWORK_CODES, BADGE_LABELS } from '@/lib/badgeArtwork';

const tierCopy = {
  BRONZE: {
    kicker: 'COSMETIC TIER 01',
    title: 'Foundation',
    body: 'The first collectible in a badge inventory built around visible progress.',
  },
  SILVER: {
    kicker: 'COSMETIC TIER 02',
    title: 'Momentum',
    body: 'A polished reminder that a small daily action can become a repeatable ritual.',
  },
  GOLD: {
    kicker: 'COSMETIC TIER 03',
    title: 'Discipline',
    body: 'A brighter tier for savers who keep showing up and continue their streak.',
  },
  DIAMOND: {
    kicker: 'RARE WHEEL TIER',
    title: 'Precision',
    body: 'A rare cosmetic pull with a distinctive cyan and violet finish.',
  },
  JACKPOT: {
    kicker: 'LEGENDARY WHEEL DROP',
    title: 'Jackpot',
    body: 'The most theatrical collectible on the wheel—still cosmetic and non-redeemable.',
  },
} as const;

export function BadgeTiers() {
  return (
    <section id="badges" aria-labelledby="badges-title" className="landing-anchor badge-showcase">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="max-w-3xl">
          <p className="eyebrow text-amber-300">Prestige collection</p>
          <h2 id="badges-title" className="section-title mt-3">
            Collected through progress, <span className="gradient-text">kept for the story.</span>
          </h2>
          <p className="section-description mt-5">
            A verified spin awards one of five non-transferable cosmetic badges. They carry no
            monetary value and never replace the on-chain checks behind your streak.
          </p>
        </div>

        <div className="badge-tier-grid">
          {BADGE_ARTWORK_CODES.map((code, index) => {
            const copy = tierCopy[code];
            return (
              <article key={code} className={`badge-tier-card badge-tier-${code.toLowerCase()}`}>
                <div className="badge-tier-number" aria-hidden="true">0{index + 1}</div>
                <div className="badge-tier-artwork">
                  <Image
                    src={BADGE_ARTWORK[code]}
                    alt={`${BADGE_LABELS[code]} cosmetic badge`}
                    fill
                    sizes="(max-width: 639px) 70vw, (max-width: 1023px) 38vw, 220px"
                    className="h-full w-full object-contain"
                  />
                </div>
                <p className="badge-tier-kicker">{copy.kicker}</p>
                <h3>{BADGE_LABELS[code]}</h3>
                <p className="badge-tier-subtitle">{copy.title}</p>
                <p className="badge-tier-body">{copy.body}</p>
              </article>
            );
          })}
        </div>

        <p className="mt-6 text-xs leading-5 text-slate-500">
          Wheel eligibility and outcomes are issued by the backend. Artwork does not represent a token or financial reward.
        </p>
      </div>
    </section>
  );
}
