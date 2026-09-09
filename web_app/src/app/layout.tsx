import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import Navbar from '@/components/Navbar';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'SolStreak — Build a saving streak on Solana',
    template: '%s · SolStreak',
  },
  description:
    'Build a visible saving habit on Solana Devnet with wallet-approved actions, verified streaks, and cosmetic badge rewards.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark antialiased" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('solstreak-theme');if(t!=='light'&&t!=='dark')t='dark';var r=document.documentElement;r.dataset.theme=t;r.classList.toggle('dark',t==='dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-night-950 font-sans text-slate-100"
      >
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="site-footer">
              <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <Link href="/" className="inline-flex rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400">
                    <Image src="/Logo_SolStreak_Dark.png" alt="SolStreak home" width={176} height={70} className="theme-logo-dark h-10 w-auto" />
                    <Image src="/Logo_SolStreak_Light.png" alt="" aria-hidden="true" width={176} height={70} className="theme-logo-light h-10 w-auto" />
                  </Link>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500">
                    An independent UniHackFest project exploring visible saving habits on Solana Devnet.
                    Test assets and cosmetic rewards have no financial value.
                  </p>
                </div>
                <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400 lg:justify-end">
                  <Link href="/">Home</Link>
                  <Link href="/dashboard">Dashboard</Link>
                  <Link href="/#badges">Badges</Link>
                  <Link href="/#wiki">Wiki</Link>
                  <Link href="/#about">About Us</Link>
                  <a href="https://github.com/NTP010205/UniHackFest_SolStreak" target="_blank" rel="noreferrer">GitHub ↗</a>
                </nav>
              </div>
              <div className="border-t border-white/[.06] px-4 py-5 text-center text-[11px] text-slate-600">
                SolStreak · Solana Devnet · Cosmetic rewards are non-transferable and non-redeemable.
              </div>
            </footer>
            <ThemeToggle />
          </div>
        </Providers>
      </body>
    </html>
  );
}
