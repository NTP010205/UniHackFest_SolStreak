'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useSolStreakWallet } from '@/hooks/useSolStreakWallet';
import { truncateAddress } from '@/lib/format';

function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 text-lg shadow-glow-violet transition group-hover:scale-105">
        🔥
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-white">
        Sol
        <span className="bg-gradient-to-r from-amber-300 to-fuchsia-400 bg-clip-text text-transparent">
          Streak
        </span>
      </span>
    </Link>
  );
}

/**
 * Connection status chip. Gracefully covers every Privy state:
 * initializing (ready === false), signed out, wallet provisioning,
 * and fully connected with a truncated Solana address.
 */
function WalletChip() {
  const { ready, authenticated, wallet } = useSolStreakWallet();

  if (!ready) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        Initializing…
      </span>
    );
  }

  if (!authenticated) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400">
        <span className="h-2 w-2 rounded-full bg-slate-500" />
        Not connected
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300"
      title={wallet ? wallet.address : 'Creating your Solana wallet…'}
    >
      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
      {wallet ? (
        <code className="font-mono tracking-tight">{truncateAddress(wallet.address)}</code>
      ) : (
        'Creating wallet…'
      )}
    </span>
  );
}

export default function Navbar() {
  const { ready, authenticated, login, logout } = useSolStreakWallet();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    router.push('/');
  }

  function handleConnect() {
    // Never call login() before Privy reports ready — the modal would
    // mount against an uninitialized provider.
    if (!ready) return;
    login();
  }

  const dashboardLink = authenticated ? (
    <Link
      href="/dashboard"
      onClick={() => setMenuOpen(false)}
      className="block rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
    >
      Dashboard
    </Link>
  ) : null;

  const authAction = !ready ? (
    <span className="block rounded-lg px-3 py-2 text-sm text-slate-600" aria-live="polite">
      Loading…
    </span>
  ) : authenticated ? (
    <button
      type="button"
      onClick={handleLogout}
      className="block rounded-lg border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
    >
      Logout
    </button>
  ) : (
    <button
      type="button"
      onClick={handleConnect}
      className="block rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-glow-violet transition hover:brightness-110"
    >
      Connect
    </button>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-night-950/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        {/* Desktop */}
        <div className="hidden items-center gap-3 md:flex">
          {dashboardLink}
          <WalletChip />
          {authAction}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-300 md:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            {menuOpen ? (
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </nav>

      {menuOpen && (
        <div className="space-y-3 border-t border-white/5 px-4 pb-4 pt-3 md:hidden">
          {dashboardLink}
          <WalletChip />
          {authAction}
        </div>
      )}
    </header>
  );
}
