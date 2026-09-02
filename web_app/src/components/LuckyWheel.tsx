'use client';

import { useEffect, useRef, useState } from 'react';
import type { TransitionEvent } from 'react';
import { useIdentityToken } from '@privy-io/react-auth';
import Image from 'next/image';

import Spinner from './Spinner';
import { VideoOverlay } from './ui/VideoOverlay';

/**
 * Display-only wheel metadata. Keep the ids in sync with lib/wheel.ts —
 * but note the WEIGHTS deliberately live only on the server: the client
 * never sees the probabilities and never decides outcomes.
 */
const SEGMENTS = [
  { id: 'badge_bronze', label: 'Bronze', image: '/assets/images/BronzeMedal.png', color: '#8C5A2B' },
  { id: 'discount_fee', label: 'Bronze', image: '/assets/images/BronzeMedal.png', color: '#2563EB' },
  { id: 'badge_silver', label: 'Silver', image: '/assets/images/SilverMedal.png', color: '#475569' },
  { id: 'streak_boost', label: 'Silver', image: '/assets/images/SilverMedal.png', color: '#7C3AED' },
  { id: 'badge_flame', label: 'Gold', image: '/assets/images/GoldMedal.png', color: '#EA580C' },
  { id: 'badge_gold', label: 'Gold', image: '/assets/images/GoldMedal.png', color: '#D97706' },
  { id: 'badge_diamond', label: 'Diamond', image: '/assets/images/Diamond.png', color: '#0891B2' },
  { id: 'jackpot_usdc', label: 'Jackpot', image: '/assets/images/Chest.png', color: '#DB2777' },
] as const;

type Segment = (typeof SEGMENTS)[number];

const SEG_COUNT = SEGMENTS.length; // 8
const SEG_DEG = 360 / SEG_COUNT; // 45°

type Phase = 'idle' | 'requesting' | 'spinning' | 'revealed';

const mod = (n: number, m: number) => ((n % m) + m) % m;

function shuffledSegments(): Segment[] {
  for (;;) {
    const shuffled = [...SEGMENTS];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const diamond = shuffled.findIndex((segment) => segment.label === 'Diamond');
    const jackpot = shuffled.findIndex((segment) => segment.label === 'Jackpot');
    const circularDistance = Math.min(Math.abs(diamond - jackpot), SEG_COUNT - Math.abs(diamond - jackpot));
    if (circularDistance >= 3) return shuffled;
  }
}

/** Angle from top (12 o'clock), clockwise → SVG coordinates. */
function polar(cx: number, cy: number, r: number, degFromTop: number) {
  const rad = ((degFromTop - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const p1 = polar(cx, cy, r, startDeg);
  const p2 = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`;
}

/**
 * CRITICAL MATH — this component ONLY renders an animation.
 *
 * Given the winning segment index (already decided by the backend),
 * compute a final rotation that lands the fixed top pointer inside that
 * segment, always spinning forward for suspense. The jitter stays well
 * inside the wedge (±13.5° of a ±22.5° half-wedge) so the pointer can
 * never visually bleed into a neighboring prize.
 */
function landingRotation(current: number, index: number): number {
  const jitter = (Math.random() - 0.5) * (SEG_DEG - 18);
  const desired = mod(-(index * SEG_DEG) + jitter, 360);
  const forward = mod(desired - mod(current, 360), 360);
  return current + 6 * 360 + forward;
}

interface Props {
  walletAddress: string;
  canSpin: boolean;
  onSpinComplete?: () => void;
}

export default function LuckyWheel({ walletAddress, canSpin, onSpinComplete }: Props) {
  const { identityToken } = useIdentityToken();
  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [prize, setPrize] = useState<Segment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [segments, setSegments] = useState<Segment[]>(() => [...SEGMENTS]);
  const [showJackpotVideo, setShowJackpotVideo] = useState(false);
  const pendingPrize = useRef<Segment | null>(null);
  const requestKey = useRef<string | null>(null);

  const busy = phase === 'requesting' || phase === 'spinning';

  useEffect(() => {
    if (expanded && phase === 'idle') setSegments(shuffledSegments());
  }, [expanded, phase]);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [expanded]);

  useEffect(() => {
    if (phase !== 'revealed') return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowJackpotVideo(false);
        setPhase('idle');
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [phase]);

  async function handleSpin() {
    if (busy || !walletAddress || !identityToken) return;
    setError(null);
    setPrize(null);
    setPhase('requesting');
    try {
      requestKey.current ??= crypto.randomUUID();
      const res = await fetch('/api/wheel/spin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'privy-id-token': identityToken,
          'Idempotency-Key': requestKey.current,
        },
        body: JSON.stringify({ wallet: walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'The wheel is unavailable right now.');
      requestKey.current = null;

      const index = segments.findIndex((s) => s.id === data.result);
      if (index === -1) throw new Error('Unknown prize received from the server.');

      // ✅ The outcome is now FIXED by the backend. Everything below is
      // presentation only — the animation MUST land on this segment.
      pendingPrize.current = segments[index];
      setPhase('spinning');
      setRotation((current) => landingRotation(current, index));
    } catch (err) {
      setPhase('idle');
      setError(err instanceof Error ? err.message : 'Spin failed. Please try again.');
    }
  }

  function handleTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== 'transform' || phase !== 'spinning') return;
    setPhase('revealed');
    setPrize(pendingPrize.current);
    setShowJackpotVideo(pendingPrize.current?.label === 'Jackpot');
    onSpinComplete?.();
  }

  return (
    <>
      {expanded && (
        <button
          type="button"
          aria-label="Close expanded lucky wheel"
          onClick={() => setExpanded(false)}
          className="wheel-modal-backdrop fixed inset-0 z-[70] cursor-default bg-night-950/75 backdrop-blur-md"
        />
      )}

      <section
        onClick={() => {
          if (!expanded) setExpanded(true);
        }}
        className={expanded
          ? 'fixed inset-4 z-[80] m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-night-800/95 p-6 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:p-8'
          : 'group relative cursor-zoom-in rounded-2xl border border-white/5 bg-white/[0.03] p-5 shadow-card sm:p-6 lg:sticky lg:top-20'}
        aria-label={expanded ? 'Expanded lucky wheel' : 'Open lucky wheel'}
        role={expanded ? 'dialog' : undefined}
        aria-modal={expanded || undefined}
      >
      {expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Close lucky wheel"
          className="absolute right-4 top-4 z-30 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.07] text-2xl leading-none text-slate-300 transition hover:rotate-90 hover:bg-white/[0.13] hover:text-white"
        >
          ×
        </button>
      )}

      <header className={expanded ? 'px-10 text-center' : ''}>
        <h2 className={expanded
          ? 'font-display text-3xl font-bold tracking-tight text-white sm:text-4xl'
          : 'font-display text-lg font-semibold text-white'}>
          Lucky Wheel
        </h2>
        <p className={`mt-1 text-xs text-slate-500 ${expanded ? 'mx-auto mt-2 max-w-sm sm:text-sm' : ''}`}>
          Cosmetic badges only. No financial value. Not transferable or redeemable.
        </p>
      </header>

      <div className={`relative mx-auto aspect-square w-full ${expanded ? 'mt-7 max-w-[410px]' : 'mt-6 max-w-[320px]'}`}>
        {/* Ambient glow */}
        <div aria-hidden="true" className="absolute -inset-3 rounded-full bg-violet-600/20 blur-2xl" />

        {/* Fixed pointer at 12 o'clock */}
        <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1">
          <div className="h-0 w-0 border-x-[11px] border-t-[20px] border-x-transparent border-t-amber-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
        </div>

        {/* Rotating wheel — transform driven ONLY by the backend result */}
        <div
          className="relative h-full w-full will-change-transform"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 4.75s cubic-bezier(0.12, 0.82, 0.16, 1)',
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          <svg
            viewBox="0 0 400 400"
            className="h-full w-full drop-shadow-[0_10px_40px_rgba(124,58,237,0.35)]"
            aria-hidden="true"
          >
            <circle cx="200" cy="200" r="198" fill="#0B0B1E" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
            {segments.map((seg, i) => {
              const startDeg = i * SEG_DEG - SEG_DEG / 2;
              return (
                <g key={seg.id}>
                  <path
                    d={wedgePath(200, 200, 186, startDeg, startDeg + SEG_DEG)}
                    fill={seg.color}
                    fillOpacity="0.92"
                    stroke="#05050F"
                    strokeWidth="3"
                  />
                  <g transform={`rotate(${i * SEG_DEG} 200 200)`}>
                    <image
                      href={seg.image}
                      x="164"
                      y="38"
                      width="72"
                      height="72"
                      preserveAspectRatio="xMidYMid meet"
                    />
                  </g>
                </g>
              );
            })}
            <circle cx="200" cy="200" r="58" fill="#0A0A1A" stroke="rgba(252,211,77,0.55)" strokeWidth="3" />
          </svg>
        </div>

        {/* Center hub — also spins the wheel */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <button
            type="button"
            onClick={handleSpin}
            disabled={!canSpin || busy || phase === 'revealed'}
            aria-label="Spin the lucky wheel"
            className="wheel-spin-button pointer-events-auto flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full border-4 border-amber-300/80 bg-night-900 text-white shadow-glow-amber transition disabled:cursor-not-allowed disabled:opacity-70"
          >
            {phase === 'requesting' ? (
              <Spinner className="h-5 w-5" />
            ) : (
              <span className="text-xl" aria-hidden="true">
                🎡
              </span>
            )}
            <span className="mt-0.5 font-display text-[10px] font-bold tracking-widest">
              {phase === 'requesting' ? '…' : 'SPIN'}
            </span>
          </button>
        </div>
      </div>

      {!expanded && (
        <p className="mt-4 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-violet-300 opacity-70 transition group-hover:opacity-100">
          Click anywhere to focus the wheel
        </p>
      )}

      <div className="mt-5">
        <button
          type="button"
          onClick={handleSpin}
          disabled={!canSpin || busy || phase === 'revealed'}
          className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-semibold text-night-950 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Spinning…' : canSpin ? '🎡 Spin for a cosmetic badge' : 'No spin available'}
        </button>

        {error && (
          <p
            className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-200"
            role="alert"
          >
            ⚠ {error}
          </p>
        )}

        {!canSpin && !busy && !error && (
          <p className="mt-3 text-center text-xs text-slate-500">
            Make a deposit today to keep your spin streak alive.
          </p>
        )}
      </div>

      {phase === 'revealed' && prize?.label === 'Jackpot' && showJackpotVideo && (
        <VideoOverlay
          src="/assets/animations/Hit_Jackpot.webm"
          label="Jackpot celebration"
          onEnded={() => setShowJackpotVideo(false)}
        />
      )}

      {/* Prize reveal modal */}
      {phase === 'revealed' && prize && !showJackpotVideo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-night-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Prize reveal"
        >
          <div
            className="w-full max-w-sm animate-scale-in rounded-2xl border border-white/10 bg-night-800 p-8 text-center shadow-glow-violet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400/20 to-fuchsia-500/20 p-3 shadow-glow-amber">
              <Image
                src={prize.label === 'Jackpot' ? '/assets/images/Jackpot.png' : prize.image}
                alt={`${prize.label} reward`}
                width={160}
                height={160}
                className="h-full w-full object-contain"
              />
            </div>
            <h3 className="mt-5 font-display text-2xl font-bold text-white">You won {prize.label}!</h3>
            <p className="mt-2 text-sm text-slate-400">
              Cosmetic badge added to your profile. No financial value; not transferable or redeemable.
            </p>
            <button
              type="button"
              onClick={() => setPhase('idle')}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-glow-violet transition hover:brightness-110"
            >
              Xác nhận
            </button>
          </div>
        </div>
      )}
    </section>
    </>
  );
}
