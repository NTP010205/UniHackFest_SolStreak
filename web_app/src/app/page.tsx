'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import Spinner from '@/components/Spinner';
import { useSolStreakWallet } from '@/hooks/useSolStreakWallet';

const FEATURES = [
  {
    icon: '🔥',
    title: 'Daily Streak Engine',
    body: 'Every confirmed deposit extends your streak. One deposit per day counts — climb from Bronze to Diamond and never break the chain.',
  },
  {
    icon: '📈',
    title: 'Set-and-Forget Yield',
    body: 'Deposits are deployed into Jupiter Earn lending strategies, so interest accrues around the clock while your streak keeps you motivated.',
  },
  {
    icon: '🎡',
    title: 'Backend-Controlled Lucky Wheel',
    body: 'Streaks earn wheel spins for badges and demo rewards. Every outcome is drawn by our backend — the browser only replays the result.',
  },
  {
    icon: '🔒',
    title: 'You Hold the Keys',
    body: 'Privy embedded wallets keep your private keys in a secure enclave you control. SolStreak can never move your funds.',
  },
  {
    icon: '⏰',
    title: '3 AM Grace Window',
    body: 'A deposit confirmed before 3:00 AM (GMT+7) still counts for yesterday — network congestion never unfairly breaks your streak.',
  },
  {
    icon: '📱',
    title: 'Email & SMS Onboarding',
    body: 'No seed phrases. No extensions. Sign in with an email or phone number and your Solana wallet is created automatically.',
  },
];

const STEPS = [
  {
    n: 1,
    title: 'Create your wallet',
    body: 'Sign up with email or SMS. Privy provisions a non-custodial Solana wallet for you instantly.',
  },
  {
    n: 2,
    title: 'Deposit USDC daily',
    body: 'Choose any amount. Your deposit is signed by your own wallet and verified on-chain by our backend.',
  },
  {
    n: 3,
    title: 'Streak, earn, repeat',
    body: 'Yield accrues via Jupiter Earn, your streak grows, and milestone spins unlock lucky wheel rewards.',
  },
];

/** Floating dashboard mock shown next to the hero copy. */
function HeroMock() {
  const days = [true, true, false, true, true, true, true];
  return (
    <div className="relative mx-auto w-full max-w-md animate-float">
      <div
        aria-hidden="true"
        className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-violet-600/30 via-fuchsia-500/20 to-amber-400/20 blur-2xl"
      />
      <div className="relative rounded-3xl border border-white/10 bg-night-800/80 p-6 shadow-card backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Current streak</p>
            <p className="text-glow-amber mt-1 font-display text-4xl font-bold text-amber-300">🔥 12 days</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/10 text-2xl">
            🏆
          </div>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1.5">
          {days.map((lit, i) => (
            <div
              key={i}
              className={[
                'flex h-8 items-center justify-center rounded-lg border text-xs',
                lit
                  ? 'border-amber-400/40 bg-amber-400/15 text-amber-300 shadow-glow-amber'
                  : 'border-white/5 bg-white/[0.02] text-slate-600',
              ].join(' ')}
            >
              {lit ? '🔥' : '·'}
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
          <div>
            <p className="text-[11px] text-slate-500">Total saved</p>
            <p className="font-mono text-lg text-white">$1,284.50</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-500">Est. APY*</p>
            <p className="font-mono text-lg text-emerald-300">6.4%</p>
          </div>
        </div>
        <p className="mt-4 text-center text-[11px] text-slate-600">
          *Estimated, market-variable — powered by Jupiter Earn
        </p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { ready, authenticated, login } = useSolStreakWallet();
  const router = useRouter();

  // Auto-redirect: once Privy is ready AND the user is authenticated,
  // push them straight into the dashboard.
  useEffect(() => {
    if (ready && authenticated) router.push('/dashboard');
  }, [ready, authenticated, router]);

  function handleGetStarted() {
    // Never fire while Privy is initializing — prevents premature calls
    // against an uninitialized provider.
    if (!ready) return;
    if (authenticated) router.push('/dashboard');
    else login();
  }

  const redirecting = ready && authenticated;

  return (
    <div className="relative overflow-hidden">
      {/* Ambient background orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-[-10%] h-[480px] w-[480px] rounded-full bg-violet-600/20 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-64 left-[-12%] h-[420px] w-[420px] rounded-full bg-blue-600/15 blur-[120px]"
      />

      {/* ============================= HERO ============================= */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3.5 py-1.5 text-xs font-medium text-violet-200">
            🔥 Built on Solana · Yield powered by Jupiter Earn
          </span>

          <h1 className="mt-5 font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Save a little every day.{' '}
            <span className="text-glow-violet bg-gradient-to-r from-amber-300 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
              Watch your streak pay off.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            SolStreak turns saving into a habit you can see. Deposit USDC daily to grow your streak,
            earn DeFi yield, and spin the lucky wheel — no seed phrase, no browser extension, just
            your email or phone number.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {redirecting ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-6 py-3.5 text-sm font-semibold text-violet-200">
                <Spinner className="h-4 w-4" />
                Wallet connected — opening your dashboard…
              </span>
            ) : (
              <button
                type="button"
                onClick={handleGetStarted}
                disabled={!ready}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-7 py-3.5 text-base font-semibold text-white shadow-glow-violet transition hover:brightness-110 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
              >
                {ready ? (
                  <>
                    <span aria-hidden="true">🚀</span> Get Started — it&apos;s free
                  </>
                ) : (
                  <>
                    <Spinner className="h-4 w-4" /> Initializing…
                  </>
                )}
              </button>
            )}
            <a
              href="#how-it-works"
              className="rounded-xl border border-white/10 px-6 py-3.5 text-center text-sm font-medium text-slate-300 transition hover:bg-white/5"
            >
              How it works
            </a>
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
            <li>✓ Non-custodial embedded wallet</li>
            <li>✓ Withdraw anytime</li>
            <li>✓ Deposits verified on-chain</li>
          </ul>
        </div>

        <HeroMock />
      </section>

      {/* ========================== STATS BAND ========================== */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-white/5 px-4 py-10 text-center sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
          <div className="px-6 py-4 sm:py-0">
            <p className="font-display text-3xl font-bold text-white">Variable</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">Market-driven USDC yield*</p>
          </div>
          <div className="px-6 py-4 sm:py-0">
            <p className="font-display text-3xl font-bold text-white">24/7</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">On-chain verification</p>
          </div>
          <div className="px-6 py-4 sm:py-0">
            <p className="font-display text-3xl font-bold text-white">0</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">Seed phrases required</p>
          </div>
        </div>
        <p className="pb-6 text-center text-[11px] text-slate-600">
          *Estimated, market-variable rates — not a guaranteed return.
        </p>
      </section>

      {/* ========================== FEATURES ========================== */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <h2 className="text-center font-display text-3xl font-bold text-white sm:text-4xl">
          Why savers love SolStreak
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
          A savings account that behaves like a game — backed by real DeFi yield and real
          non-custodial security.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-white/5 bg-white/[0.03] p-6 shadow-card transition hover:border-violet-400/25 hover:bg-white/[0.05]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl transition group-hover:scale-110">
                {f.icon}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ======================== HOW IT WORKS ======================== */}
      <section id="how-it-works" className="border-t border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="text-center font-display text-3xl font-bold text-white sm:text-4xl">
            Three steps to your first streak
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="relative text-center md:text-left">
                <span className="text-glow-violet font-display text-5xl font-bold text-violet-400/80">
                  {step.n}
                </span>
                <h3 className="mt-3 font-display text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================= FINAL CTA ========================= */}
      <section className="relative border-t border-white/5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-600/10 blur-[100px]"
        />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Your future self says thanks.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            Start with $1. Keep the streak alive. Watch it compound — in your wallet and in your
            habits.
          </p>
          <button
            type="button"
            onClick={handleGetStarted}
            disabled={!ready || redirecting}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 py-4 text-base font-semibold text-white shadow-glow-violet transition hover:brightness-110 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
          >
            {redirecting ? (
              <>
                <Spinner className="h-4 w-4" /> Redirecting…
              </>
            ) : (
              'Start saving today'
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
