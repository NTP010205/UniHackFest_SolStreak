'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useIdentityToken } from '@privy-io/react-auth';
import { GlassButton } from '@/components/ui/GlassButton';
import { useSolStreakWallet } from '@/hooks/useSolStreakWallet';
import { useUserActivityHeartbeat } from '@/hooks/useUserActivityHeartbeat';
import { truncateAddress } from '@/lib/format';

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [isDevnetAdmin, setIsDevnetAdmin] = useState(false);
  const router = useRouter();
  const { ready, authenticated, wallet, sessionKey, login, logout } = useSolStreakWallet();
  const { identityToken } = useIdentityToken();
  const identityTokenRef = useRef(identityToken);
  identityTokenRef.current = identityToken;
  const hasIdentityToken = Boolean(identityToken);
  const walletAddress = wallet?.address;
  useUserActivityHeartbeat(walletAddress);

  useEffect(() => {
    let cancelled = false;
    setIsDevnetAdmin(false);
    const token = identityTokenRef.current;
    if (!authenticated || !walletAddress || !token) return;
    void fetch(`/api/admin/access?wallet=${encodeURIComponent(walletAddress)}`, {
      headers: { 'privy-id-token': token },
    }).then(response => {
      if (!cancelled) setIsDevnetAdmin(response.ok);
    }).catch(() => {
      if (!cancelled) setIsDevnetAdmin(false);
    });
    return () => { cancelled = true; };
  }, [authenticated, hasIdentityToken, sessionKey, walletAddress]);
  const closeMenu = () => setOpen(false);
  const signOut = async () => { closeMenu(); await logout(); router.push('/'); };
  const connect = () => { closeMenu(); if (ready) login(); };
  return (
    <header className="site-header">
      <nav aria-label="Primary navigation" className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" onClick={closeMenu} className="flex items-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400">
          <Image src="/Logo_SolStreak_Dark.png" width={176} height={70} priority alt="SolStreak home" className="theme-logo theme-logo-dark h-10 w-auto sm:h-11" />
          <Image src="/Logo_SolStreak_Light.png" width={176} height={70} alt="" aria-hidden="true" className="theme-logo theme-logo-light h-10 w-auto sm:h-11" />
        </Link>
        <div className="hidden items-center gap-1 lg:flex">
          <Link href="/" className="nav-link">Home</Link>
          <Link href="/dashboard" className="nav-link">Dashboard</Link>
          <Link href="/#badges" className="nav-link">Badges</Link>
          <Link href="/#wiki" className="nav-link">Wiki</Link>
          <Link href="/#about" className="nav-link">About Us</Link>
          {isDevnetAdmin && <Link href="/admin" className="nav-link">Admin</Link>}
          <span className="devnet-pill ml-2">DEVNET</span>
          {wallet && <code className="ml-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">{truncateAddress(wallet.address)}</code>}
          {ready && authenticated
            ? <GlassButton variant="secondary" onClick={() => void signOut()} className="ml-1 px-4 py-2 text-xs">Logout</GlassButton>
            : <GlassButton onClick={() => ready && login()} disabled={!ready} className="ml-1 px-4 py-2 text-xs">{ready ? 'Connect Wallet' : 'Loading…'}</GlassButton>}
        </div>
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          className="nav-menu-button lg:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          <span aria-hidden="true">{open ? '×' : '☰'}</span>
        </button>
      </nav>
      {open && (
        <div id="mobile-navigation" className="mobile-navigation lg:hidden">
          <Link href="/" onClick={closeMenu} className="nav-link block">Home</Link>
          <Link href="/dashboard" onClick={closeMenu} className="nav-link block">Dashboard</Link>
          <Link href="/#badges" onClick={closeMenu} className="nav-link block">Badges</Link>
          <Link href="/#wiki" onClick={closeMenu} className="nav-link block">Wiki</Link>
          <Link href="/#about" onClick={closeMenu} className="nav-link block">About Us</Link>
          {isDevnetAdmin && <Link href="/admin" onClick={closeMenu} className="nav-link block">Admin</Link>}
          <div className="pt-2">
            {ready && authenticated
              ? <GlassButton variant="secondary" onClick={() => void signOut()} className="w-full px-4 py-2">Logout</GlassButton>
              : <GlassButton onClick={connect} disabled={!ready} className="w-full px-4 py-2">{ready ? 'Connect Wallet' : 'Loading…'}</GlassButton>}
          </div>
        </div>
      )}
    </header>
  );
}
