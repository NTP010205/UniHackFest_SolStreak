import Image from 'next/image';
import { GlassCard } from '@/components/ui/GlassCard';

const features = [
  { number: '01', image: '/assets/images/Deposit.png', title: 'Approve every action', body: 'A visible transaction lifecycle keeps preparation, wallet approval, submission, and confirmation separate.' },
  { number: '02', image: '/assets/images/NormalStreak.png', title: 'Build a verified streak', body: 'Only backend-verified deposits become daily momentum. A browser animation is never treated as proof.' },
  { number: '03', image: '/assets/images/Coin.png', title: 'Earn a wheel spin', body: 'Eligible activity unlocks a backend-issued cosmetic spin instead of a client-generated reward.' },
  { number: '04', image: '/assets/images/Chest.png', title: 'Grow your collection', body: 'Every persisted result updates your five-tier badge inventory and recent reward history.' },
] as const;

export function ProductFeatures() {
  return (
    <section aria-labelledby="features-title" className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <div className="grid gap-7 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
        <div>
          <p className="eyebrow">Product loop</p>
          <h2 id="features-title" className="section-title mt-3">A saving ritual you can see.</h2>
        </div>
        <p className="section-description lg:max-w-2xl lg:justify-self-end">
          SolStreak turns a wallet-approved action into a clear sequence: verify progress,
          protect the streak, unlock a spin, and keep the cosmetic memory.
        </p>
      </div>

      <div className="feature-grid">
        {features.map(feature => (
          <GlassCard key={feature.title} className="feature-card" tilt={false}>
            <span className="feature-number" aria-hidden="true">{feature.number}</span>
            <div className="feature-artwork">
              <Image
                src={feature.image}
                alt=""
                fill
                sizes="96px"
                className="h-full w-full object-contain"
              />
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
