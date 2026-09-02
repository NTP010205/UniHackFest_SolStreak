'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { InteractiveBackground } from '@/components/background/InteractiveBackground';
import { Hero } from '@/components/hero/Hero';
import { DocsView } from '@/components/views/DocsView';
import { useSolStreakWallet } from '@/hooks/useSolStreakWallet';

export default function LandingPage() {
  const { ready, authenticated } = useSolStreakWallet();
  const router = useRouter();
  useEffect(() => { if (ready && authenticated) router.push('/dashboard'); }, [ready, authenticated, router]);
  return <div className="relative"><InteractiveBackground /><div className="relative z-10"><Hero /><section className="border-y border-white/[.07] bg-white/[.025]"><div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-center sm:grid-cols-3 sm:px-6"><div><strong className="font-display text-3xl text-white">24/7</strong><p className="eyebrow mt-2">On-chain verification</p></div><div><strong className="font-display text-3xl text-white">3 AM</strong><p className="eyebrow mt-2">GMT+7 grace window</p></div><div><strong className="font-display text-3xl text-white">0</strong><p className="eyebrow mt-2">Seed phrases required</p></div></div></section><DocsView /></div></div>;
}
