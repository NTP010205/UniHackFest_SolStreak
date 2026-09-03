'use client';

import { useCallback, useEffect, useState } from 'react';
import { useIdentityToken } from '@privy-io/react-auth';

interface AdminMetrics {
  isAdmin: true;
  networkProfile: 'devnet';
  totalUsers: number;
  devnetProfiles: number;
  activeProfiles7d: number;
  activeStreaks: number;
  streakDistribution: { days1to6: number; days7to14: number; days15to29: number; days30Plus: number };
  totalSpins: number;
  totalBadgeAwards: number;
  uniqueBadgeOwnerships: number;
}

export default function AdminLab({ onChanged, onAdminStatusChange, refreshKey = 0 }: {
  onChanged: () => void;
  onAdminStatusChange?: (isAdmin: boolean) => void;
  refreshKey?: number;
}) {
  const { identityToken } = useIdentityToken();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [streak, setStreak] = useState('15');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    if (!identityToken) return;
    try {
      const response = await fetch('/api/admin/metrics', { headers: { 'privy-id-token': identityToken } });
      if (response.status === 403 || response.status === 401) {
        setMetrics(null); onAdminStatusChange?.(false); return;
      }
      if (!response.ok) throw new Error('Admin metrics are temporarily unavailable');
      setMetrics(await response.json() as AdminMetrics);
      onAdminStatusChange?.(true);
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Admin Lab unavailable'); }
  }, [identityToken, onAdminStatusChange]);
  useEffect(() => { void loadMetrics(); }, [loadMetrics, refreshKey]);

  async function request(path: string, body: object, idempotencyKey?: string) {
    const response = await fetch(path, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'privy-id-token': identityToken ?? '',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? 'Admin operation failed');
    return payload;
  }

  async function updateStreak() {
    const value = Number(streak);
    if (!Number.isInteger(value) || value < 0 || value > 365 || busy) return;
    setBusy(true); setError(null);
    try { await request('/api/admin/streak', { currentStreak: value }); onChanged(); await loadMetrics(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Streak update failed'); }
    finally { setBusy(false); }
  }

  if (!metrics) return null;
  const cards = [
    ['Devnet users', metrics.totalUsers], ['Profiles', metrics.devnetProfiles],
    ['Active 7d', metrics.activeProfiles7d], ['Active streaks', metrics.activeStreaks],
    ['Spins', metrics.totalSpins], ['Awards', metrics.totalBadgeAwards],
    ['Badge owners', metrics.uniqueBadgeOwnerships],
  ];
  return <section className="rounded-3xl border border-cyan-300/20 bg-cyan-400/[0.06] p-5 shadow-[0_20px_70px_-30px_rgba(34,211,238,0.45)] backdrop-blur-xl sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Devnet only</p>
      <h2 className="mt-1 font-display text-xl font-bold text-white">Admin Lab</h2>
      <p className="mt-1 text-xs text-slate-400">Demo controls and aggregate test metrics. No financial value.</p>
    </div><button type="button" onClick={() => void loadMetrics()} className="rounded-lg border border-cyan-300/20 px-3 py-2 text-xs text-cyan-100">Refresh metrics</button></div>
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{cards.map(([label, value]) =>
      <div key={label} className="rounded-xl border border-white/5 bg-black/15 p-3"><p className="text-[10px] uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-white">{value}</p></div>)}</div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-white/5 bg-black/15 p-4"><p className="text-sm font-semibold text-white">Demo streak</p>
        <div className="mt-3 flex gap-2"><input aria-label="Demo streak days" type="number" min="0" max="365" value={streak} onChange={event => setStreak(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-night-950 px-3 py-2 text-white" />
          <button type="button" disabled={busy} onClick={() => void updateStreak()} className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-night-950 disabled:opacity-50">Apply</button></div></div>
      <div className="rounded-xl border border-white/5 bg-black/15 p-4"><p className="text-sm font-semibold text-white">Admin test mode enabled</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">∞ cosmetic test spins. Every award starts only when you manually click the wheel.</p>
        <a href="#lucky-wheel" className="mt-3 block w-full rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-2 text-center text-sm font-bold text-white">Focus the Lucky Wheel</a></div>
    </div>
    <div className="mt-4 rounded-xl border border-white/5 bg-black/15 p-3 text-xs text-slate-400">Streak groups: 1–6 ({metrics.streakDistribution.days1to6}) · 7–14 ({metrics.streakDistribution.days7to14}) · 15–29 ({metrics.streakDistribution.days15to29}) · 30+ ({metrics.streakDistribution.days30Plus})</div>
    {error && <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
  </section>;
}
