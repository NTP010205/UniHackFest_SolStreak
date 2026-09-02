'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { GlassButton } from '@/components/ui/GlassButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { useSolStreakWallet } from '@/hooks/useSolStreakWallet';

export function Hero() {
  const router = useRouter();
  const { ready, authenticated, login } = useSolStreakWallet();
  const launch = () => {
    if (!ready) return;
    if (authenticated) router.push('/dashboard'); else login();
  };
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:pt-24">
      <div className="animate-rise">
        <span className="devnet-pill">DEVNET — TEST ASSETS · NO FINANCIAL VALUE</span>
        <h1 className="mt-6 max-w-4xl font-display text-5xl font-bold leading-[1.02] tracking-[-.04em] text-white sm:text-7xl">
          Build wealth through <span className="gradient-text">daily momentum.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
          Save Devnet USDC every day, grow a verified on-chain streak, and earn cosmetic badges. Your Privy embedded wallet signs every transaction—SolStreak never bypasses your approval.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <GlassButton onClick={launch} disabled={!ready} className="px-7 py-3.5 text-sm font-semibold">
            {ready ? (authenticated ? 'Open dashboard →' : 'Connect wallet →') : 'Initializing Privy…'}
          </GlassButton>
          <GlassButton variant="secondary" onClick={() => document.querySelector('#how-it-works')?.scrollIntoView()} className="px-7 py-3.5 text-sm font-semibold">How it works</GlassButton>
        </div>
        <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500"><span>✓ Privy embedded wallet</span><span>✓ Circle Devnet USDC</span><span>✓ Verified on-chain</span></div>
      </div>
      <GlassCard className="p-6 sm:p-8">
        <div className="flex items-center justify-between"><div><p className="eyebrow">Current streak</p><p className="mt-2 flex items-center gap-2 font-display text-4xl font-bold text-white"><Image src="/assets/images/NormalStreak.png" alt="" width={42} height={42} className="h-11 w-11 object-contain" />12 days</p></div><span className="grid h-14 w-14 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10"><Image src="/assets/images/Trophie.png" alt="Longest streak trophy" width={42} height={42} className="h-11 w-11 object-contain" /></span></div>
        <div className="mt-7 grid grid-cols-7 gap-2">{[1,1,1,1,1,1,0].map((active, i) => <span key={i} className={`grid aspect-square place-items-center rounded-xl border text-sm ${active ? 'border-amber-300/30 bg-amber-400/10' : 'border-white/10 bg-white/[.03] text-slate-600'}`}>{active ? <Image src="/assets/images/NormalStreak.png" alt="Active streak day" width={28} height={28} className="h-7 w-7 object-contain" /> : '·'}</span>)}</div>
        <div className="mt-6 grid grid-cols-2 gap-3"><div className="inner-panel"><p className="eyebrow">Test USDC saved</p><p className="mt-2 font-mono text-xl text-white">1,284.50</p></div><div className="inner-panel"><p className="eyebrow">Network</p><p className="mt-2 font-mono text-xl text-cyan-300">Devnet</p></div></div>
        <p className="mt-5 text-center text-[11px] text-slate-500">Demo values shown for preview. Dashboard data comes from verified APIs.</p>
      </GlassCard>
    </section>
  );
}
