'use client';

import BadgeArtworkImage from './BadgeArtworkImage';
import { BADGE_ARTWORK_CODES, BADGE_GLOW_CLASSES, BADGE_LABELS } from '@/lib/badgeArtwork';
import { useBadgeProfile } from '@/hooks/useBadgeProfile';

export default function BadgeCollection({ walletAddress, refreshKey = 0 }: {
  walletAddress: string; refreshKey?: number;
}) {
  const { data, loading, error, refresh } = useBadgeProfile(walletAddress, refreshKey);
  return (
    <section id="badges" className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="font-display text-lg font-semibold text-white">Cosmetic Badges</h2>
          <p className="mt-1 text-xs text-slate-500">Cosmetic only · no financial value · not transferable or redeemable.</p></div>
        <button type="button" onClick={() => void refresh()} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5">Refresh</button>
      </div>
      {loading && !data && <p className="mt-5 text-sm text-slate-400">Loading badge collection…</p>}
      {error && <p role="alert" className="mt-4 text-sm text-amber-200">{error}</p>}
      {data && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {BADGE_ARTWORK_CODES.map(code => {
              const owned = data.badges.find(badge => badge.badgeCode === code);
              return <div key={code} data-owned={owned ? 'true' : 'false'} className={`relative overflow-hidden rounded-xl border p-3 text-center ${owned ? `border-violet-400/30 bg-violet-500/10 ${BADGE_GLOW_CLASSES[code]}` : 'border-white/5 bg-black/10'}`}>
                <BadgeArtworkImage code={code} locked={!owned} size={96} className="mx-auto h-20 w-20 max-w-full object-contain" />
                <p className={`mt-2 text-xs font-semibold ${owned ? 'text-white' : 'text-slate-500'}`}>{BADGE_LABELS[code]}</p>
                {owned ? <p className="text-[11px] text-slate-300">Awarded {owned.awardCount}×</p> :
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500"><span aria-hidden="true">🔒</span> Locked</p>}
              </div>;
            })}
          </div>
          <div className="mt-5 border-t border-white/5 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Recent history</h3>
            {data.recentHistory.length === 0 ? <p className="mt-2 text-sm text-slate-500">No badges awarded yet.</p> :
              <ul className="mt-2 space-y-2">{data.recentHistory.slice(0, 5).map(item =>
                <li key={item.spinId} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.025] px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-3 text-slate-200"><BadgeArtworkImage code={item.badgeCode} size={40} className="h-10 w-10 shrink-0 object-contain" /><span className="truncate">{item.displayLabel}</span></span>
                  <time className="text-xs text-slate-500">{new Date(item.awardedAt).toLocaleDateString()}</time>
                </li>)}</ul>}
          </div>
        </>
      )}
    </section>
  );
}
