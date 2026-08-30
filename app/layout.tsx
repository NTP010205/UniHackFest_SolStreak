import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';

import Navbar from '@/components/Navbar';

import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: {
    default: 'SolStreak — Save daily. Streak up. Earn more.',
    template: '%s · SolStreak',
  },
  description:
    'SolStreak turns saving into a habit. Deposit USDC daily to build your streak, earn DeFi yield through Jupiter Earn, and spin the lucky wheel for rewards — with just an email or phone number.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${display.variable} min-h-screen bg-night-950 font-sans text-slate-100 antialiased`}
      >
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-white/5 px-4 py-8 text-center text-xs text-slate-500">
              <p>
                SolStreak · Built on Solana · Yield powered by{' '}
                <a
                  href="https://earn.jup.ag"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 transition hover:text-slate-300"
                >
                  Jupiter Earn
                </a>
              </p>
              {/* Roadmap Phase 6: interest must be labeled estimated, market-variable, not guaranteed. */}
              <p className="mt-1">Interest rates are market-variable estimates and not guaranteed.</p>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
