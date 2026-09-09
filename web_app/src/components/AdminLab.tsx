'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

interface AdminUserSummary {
  walletLabel: string;
  currentStreak: number;
  longestStreak: number;
  totalDepositedUsdc: number;
  lastActiveAt: string;
  isOnline: boolean;
}

const ADMIN_AUTO_REFRESH_MS = 15_000;

function activityLabel(user: AdminUserSummary) {
  if (user.isOnline) return 'Online now';
  const timestamp = new Date(user.lastActiveAt).getTime();
  if (!Number.isFinite(timestamp)) return 'Activity unavailable';
  const elapsedMinutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60_000));
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hr ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function AdminLab({ walletAddress, onChanged, onAdminStatusChange, refreshKey = 0, standalone = false }: {
  walletAddress: string;
  onChanged: () => void;
  onAdminStatusChange?: (isAdmin: boolean) => void;
  refreshKey?: number;
  standalone?: boolean;
}) {
  const { identityToken } = useIdentityToken();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [usersState, setUsersState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [usersError, setUsersError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [streak, setStreak] = useState('15');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessState, setAccessState] = useState<'checking' | 'authorized' | 'forbidden' | 'unavailable'>('checking');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const requestVersion = useRef(0);
  const identityTokenRef = useRef(identityToken);
  identityTokenRef.current = identityToken;
  const hasIdentityToken = Boolean(identityToken);

  const loadAdminData = useCallback(async (background = false) => {
    const version = ++requestVersion.current;
    const token = identityTokenRef.current;
    if (!token) {
      setMetrics(null);
      setUsers([]);
      setUsersState('loading');
      setUsersError(null);
      setLastRefreshedAt(null);
      setAccessState('checking');
      onAdminStatusChange?.(false);
      return;
    }
    try {
      if (!background) {
        setUsersState('loading');
        setUsersError(null);
      }
      const headers = { 'privy-id-token': token };
      const walletQuery = `?wallet=${encodeURIComponent(walletAddress)}`;
      const [metricsResponse, usersResponse] = await Promise.all([
        fetch(`/api/admin/metrics${walletQuery}`, { headers }),
        fetch(`/api/admin/users${walletQuery}`, { headers }),
      ]);
      if (version !== requestVersion.current) return;
      if ([metricsResponse.status, usersResponse.status].some(status => status === 401 || status === 403)) {
        setMetrics(null);
        setUsers([]);
        setUsersState('unavailable');
        setUsersError('Admin authorization was rejected.');
        setAccessState('forbidden');
        onAdminStatusChange?.(false);
        return;
      }
      if (!metricsResponse.ok) throw new Error('Admin access is temporarily unavailable');
      const nextMetrics = await metricsResponse.json() as AdminMetrics;
      const nextUsers = usersResponse.ok
        ? await usersResponse.json() as { users: AdminUserSummary[] }
        : { users: [] };
      const nextUsersError = usersResponse.ok
        ? null
        : `The read-only user table is temporarily unavailable (HTTP ${usersResponse.status}).`;
      if (version !== requestVersion.current) return;
      setMetrics(nextMetrics);
      setUsers(nextUsers.users);
      setUsersState(usersResponse.ok ? 'ready' : 'unavailable');
      setUsersError(nextUsersError);
      setAccessState('authorized');
      setLastRefreshedAt(new Date());
      onAdminStatusChange?.(true);
      setError(nextUsersError);
    } catch (cause) {
      if (version === requestVersion.current) {
        setAccessState('unavailable');
        setError(cause instanceof Error ? cause.message : 'Admin Lab unavailable');
      }
    }
  }, [hasIdentityToken, onAdminStatusChange, walletAddress]);
  useEffect(() => {
    setMetrics(null);
    setUsers([]);
    setUsersState('loading');
    setUsersError(null);
    onAdminStatusChange?.(false);
    void loadAdminData();
    return () => { requestVersion.current += 1; };
  }, [loadAdminData, onAdminStatusChange, refreshKey]);

  useEffect(() => {
    if (accessState !== 'authorized') return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadAdminData(true);
    }, ADMIN_AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [accessState, loadAdminData]);

  async function request(path: string, body: object, idempotencyKey?: string) {
    const token = identityTokenRef.current;
    const response = await fetch(path, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'privy-id-token': token ?? '',
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
    try { await request('/api/admin/streak', { wallet: walletAddress, currentStreak: value }); onChanged(); await loadAdminData(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Streak update failed'); }
    finally { setBusy(false); }
  }

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? users.filter(user => user.walletLabel.toLowerCase().includes(query)) : users;
  }, [search, users]);

  if (!metrics) {
    if (!standalone) return null;
    const message = accessState === 'forbidden'
      ? 'This signed-in wallet is not on the server-side Devnet admin allowlist.'
      : accessState === 'unavailable'
        ? 'Admin data are temporarily unavailable. Try again shortly.'
        : 'Checking Devnet admin access…';
    return <section className="rounded-3xl border border-cyan-300/20 bg-cyan-400/[0.06] p-6 backdrop-blur-xl">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Devnet admin</p>
      <h1 className="mt-2 font-display text-2xl font-bold text-white">Admin workspace</h1>
      <p className="mt-3 text-sm text-slate-400" role="status">{message}</p>
      {accessState === 'unavailable' && <button type="button" onClick={() => void loadAdminData()} className="mt-4 rounded-lg border border-cyan-300/20 px-3 py-2 text-xs text-cyan-100">Retry</button>}
    </section>;
  }
  const cards = [
    ['Devnet users', metrics.totalUsers], ['Profiles', metrics.devnetProfiles],
    ['Active 7d', metrics.activeProfiles7d], ['Active streaks', metrics.activeStreaks],
    ['Spins', metrics.totalSpins], ['Awards', metrics.totalBadgeAwards],
    ['Badge owners', metrics.uniqueBadgeOwnerships],
  ];
  return <section id="admin-lab" className={`${standalone ? '' : 'mt-10 scroll-mt-24'} rounded-3xl border border-cyan-300/20 bg-cyan-400/[0.06] p-5 shadow-[0_20px_70px_-30px_rgba(34,211,238,0.45)] backdrop-blur-xl sm:p-6`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Devnet only</p>
      <h2 className="mt-1 font-display text-xl font-bold text-white">Admin Lab</h2>
      <p className="mt-1 text-xs text-slate-400">Self-test controls and read-only Devnet user metrics. No financial value.</p>
    </div><div className="flex flex-wrap gap-2">
      {!standalone && <a href="/admin" className="rounded-lg border border-violet-300/20 px-3 py-2 text-xs text-violet-100">Open admin workspace</a>}
      <button type="button" onClick={() => void loadAdminData()} className="rounded-lg border border-cyan-300/20 px-3 py-2 text-xs text-cyan-100">Refresh admin data</button>
    </div></div>
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
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-black/15">
      <div className="flex flex-col gap-3 border-b border-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-white">Devnet users</h3><span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200">Read only</span></div>
          <p className="mt-1 text-xs text-slate-500">Read-only activity overview. Online users and recent activity appear first; email and full identifiers are never returned.</p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-cyan-300/70">
            Live · refreshes every 15s{lastRefreshedAt ? ` · updated ${lastRefreshedAt.toLocaleTimeString()}` : ''}
          </p>
        </div>
        <input
          type="search"
          aria-label="Search Devnet users"
          placeholder="Search wallet…"
          value={search}
          onChange={event => setSearch(event.target.value)}
          className="rounded-lg border border-white/10 bg-night-950/70 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-cyan-300/50 focus:outline-none"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-white/[0.025] uppercase tracking-wider text-slate-500">
            <tr><th className="px-4 py-3 font-medium">User wallet</th><th className="px-4 py-3 font-medium">Current</th><th className="px-4 py-3 font-medium">Longest</th><th className="px-4 py-3 font-medium">Deposited</th><th className="px-4 py-3 font-medium">Last active</th></tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {visibleUsers.map(user => <tr key={user.walletLabel} className="transition hover:bg-white/[0.025]">
              <td className="whitespace-nowrap px-4 py-3 font-mono text-cyan-200">{user.walletLabel}</td>
              <td className="px-4 py-3 font-semibold text-white">{user.currentStreak} days</td>
              <td className="px-4 py-3">{user.longestStreak} days</td>
              <td className="px-4 py-3">{user.totalDepositedUsdc.toLocaleString()} USDC</td>
              <td className={`whitespace-nowrap px-4 py-3 ${user.isOnline ? 'font-semibold text-emerald-300' : 'text-slate-500'}`}>
                <span className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${user.isOnline ? 'bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.9)]' : 'bg-slate-600'}`} aria-hidden="true" />
                {activityLabel(user)}
              </td>
            </tr>)}
            {visibleUsers.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">
              {usersState === 'loading'
                ? 'Loading Devnet users…'
                : usersState === 'unavailable'
                  ? <><span>{usersError ?? 'The read-only user table is temporarily unavailable.'}</span>{' '}<button type="button" onClick={() => void loadAdminData()} className="font-semibold text-cyan-200 underline underline-offset-2">Retry</button></>
                  : search.trim()
                    ? 'No users match this wallet search.'
                    : 'No Devnet user activity has been recorded yet.'}
            </td></tr>}
          </tbody>
        </table>
      </div>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
  </section>;
}
