'use client';

import { useCallback, useEffect, useState } from 'react';
import { useIdentityToken } from '@privy-io/react-auth';
import { GlassCard } from '@/components/ui/GlassCard';

type Badge = { badgeCode: string; displayLabel: string; awardCount: number; firstEarnedAt: string; lastEarnedAt: string };
type Profile = { badges: Badge[]; availableSpinEntitlements: unknown[] };

export default function Leaderboard({ walletAddress }: { walletAddress: string }) {
  const { identityToken } = useIdentityToken();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!identityToken || !walletAddress) return;
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/profile/badges?wallet=${encodeURIComponent(walletAddress)}`, { headers: { 'privy-id-token': identityToken } });
      const body = await response.json().catch(() => null) as (Profile & { error?: string }) | null;
      if (!response.ok) throw new Error(body?.error ?? 'Badge collection is temporarily unavailable.');
      setProfile(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load badges.'); }
    finally { setLoading(false); }
  }, [identityToken, walletAddress]);
  useEffect(() => { void load(); }, [load]);
  const glyph: Record<string, string> = { BRONZE: '🥉', SILVER: '🥈', GOLD: '🥇', DIAMOND: '💎', JACKPOT: '✨' };
  return (
    <section aria-labelledby="badges-title">
      <div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">Cosmetic collection</p><h2 id="badges-title" className="mt-1 font-display text-xl font-semibold text-white">Badges & achievements</h2></div>{profile && <span className="text-xs text-slate-500">{profile.availableSpinEntitlements.length} spin available</span>}</div>
      {loading ? <div className="grid animate-pulse gap-3 sm:grid-cols-3">{[1,2,3].map(i => <div key={i} className="h-32 rounded-3xl bg-white/[.05]" />)}</div> : error ? <GlassCard tilt={false} className="p-5"><p className="text-sm text-amber-200">⚠ {error}</p><button onClick={() => void load()} className="mt-3 text-xs font-semibold text-violet-300 underline">Retry</button></GlassCard> : !profile?.badges.length ? <GlassCard tilt={false} className="p-6 text-center text-sm text-slate-400">No badges yet. Use a backend-issued wheel entitlement to earn your first cosmetic badge.</GlassCard> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{profile.badges.map(badge => <GlassCard key={badge.badgeCode} className="p-5"><div className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[.07] text-2xl">{glyph[badge.badgeCode] ?? '◆'}</span><div><h3 className="font-semibold text-white">{badge.displayLabel}</h3><p className="mt-1 text-xs text-slate-500">Awarded {badge.awardCount}×</p></div></div></GlassCard>)}</div>}
      <p className="mt-3 text-[11px] text-slate-500">Cosmetic only · no financial value · not transferable or redeemable.</p>
    </section>
  );
}
