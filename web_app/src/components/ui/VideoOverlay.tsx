'use client';

import { useEffect } from 'react';

interface Props {
  src: string;
  label: string;
  onEnded: () => void;
  fallbackMs?: number;
}

export function VideoOverlay({ src, label, onEnded, fallbackMs = 10_000 }: Props) {
  useEffect(() => {
    const timeout = window.setTimeout(onEnded, fallbackMs);
    return () => window.clearTimeout(timeout);
  }, [fallbackMs, onEnded]);

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-night-950/90 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <video
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={onEnded}
        onError={onEnded}
        className="max-h-[85dvh] w-full max-w-2xl rounded-3xl object-contain shadow-[0_30px_100px_rgba(0,0,0,.75)]"
      >
        <source src={src} type="video/webm" />
      </video>
    </div>
  );
}
