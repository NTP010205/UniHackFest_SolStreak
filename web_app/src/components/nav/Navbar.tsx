'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GlassButton } from '@/components/ui/GlassButton';
import { useSolStreakWallet } from '@/hooks/useSolStreakWallet';
import { truncateAddress } from '@/lib/format';

export function Navbar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { ready, authenticated, wallet, login, logout } = useSolStreakWallet();
  const signOut = async () => { await logout(); router.push('/'); };
  return (
    <header className="sticky top-0 z-40 border-b border-white/[.07] bg-[#080812]/70 backdrop-blur-2xl">
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center">
          <Image src="/Logo_SolStreak_Dark.png" width={176} height={70} priority alt="SolStreak" className="theme-logo theme-logo-dark h-11 w-auto" />
          <Image src="/Logo_SolStreak_Light.png" width={176} height={70} alt="" aria-hidden="true" className="theme-logo theme-logo-light h-11 w-auto" />
        </Link>
        <div className="hidden items-center gap-2 md:flex"><Link href="/" className="nav-link">Home</Link>{authenticated && <Link href="/dashboard" className="nav-link">Dashboard</Link>}<span className="devnet-pill">DEVNET</span>{wallet && <code className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">{truncateAddress(wallet.address)}</code>}{ready && authenticated ? <GlassButton variant="secondary" onClick={() => void signOut()} className="px-4 py-2 text-xs">Logout</GlassButton> : <GlassButton onClick={() => ready && login()} disabled={!ready} className="px-4 py-2 text-xs">{ready ? 'Connect Wallet' : 'Loading…'}</GlassButton>}</div>
        <button type="button" onClick={() => setOpen(v => !v)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white md:hidden" aria-label="Toggle navigation">{open ? '×' : '☰'}</button>
      </nav>
      {open && <div className="space-y-2 border-t border-white/10 p-4 md:hidden"><Link href="/" className="nav-link block">Home</Link>{authenticated && <Link href="/dashboard" className="nav-link block">Dashboard</Link>}<div className="pt-2">{ready && authenticated ? <GlassButton variant="secondary" onClick={() => void signOut()} className="w-full px-4 py-2">Logout</GlassButton> : <GlassButton onClick={() => ready && login()} disabled={!ready} className="w-full px-4 py-2">Connect Wallet</GlassButton>}</div></div>}
    </header>
  );
}
