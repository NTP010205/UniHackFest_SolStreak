'use client';

import { useRouter } from 'next/navigation';
import { HeroRewardScene } from '@/components/hero/HeroRewardScene';
import { GlassButton } from '@/components/ui/GlassButton';
import { useSolStreakWallet } from '@/hooks/useSolStreakWallet';

export function Hero() {
  const router = useRouter();
  const { ready, authenticated, login } = useSolStreakWallet();
  const launch = () => {
    if (!ready) return;
    if (authenticated) router.push('/dashboard'); else login();
  };
  return (
    <section id="home" className="landing-anchor hero-section">
      <div className="hero-copy animate-rise">
        <span className="devnet-pill"><span className="devnet-live-dot" /> SOLANA DEVNET · UNIHACKFEST</span>
        <h1 className="hero-title">
          Build a consistent <span className="gradient-text">saving habit</span> on Solana.
        </h1>
        <p className="hero-description">
          Turn small Devnet deposits into visible daily momentum. Keep your streak alive,
          unlock wheel spins, and collect cosmetic badges that celebrate discipline—not luck alone.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <GlassButton onClick={launch} disabled={!ready} className="px-7 py-3.5 text-sm font-semibold">
            {ready ? (authenticated ? 'Open dashboard →' : 'Start saving →') : 'Initializing Privy…'}
          </GlassButton>
          <GlassButton
            variant="secondary"
            onClick={() => document.querySelector('#badges')?.scrollIntoView()}
            className="px-7 py-3.5 text-sm font-semibold"
          >
            Explore badges
          </GlassButton>
        </div>

        <dl className="hero-facts" aria-label="SolStreak product facts">
          <div><dt>Environment</dt><dd>Devnet</dd></div>
          <div><dt>Cosmetic tiers</dt><dd>5</dd></div>
          <div><dt>Seed phrases asked</dt><dd>0</dd></div>
        </dl>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Test assets and cosmetic rewards have no financial value.
        </p>
      </div>

      <div className="animate-rise [animation-delay:120ms]">
        <HeroRewardScene />
      </div>
    </section>
  );
}
