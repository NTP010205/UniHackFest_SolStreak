'use client';

import { useTilt } from '@/hooks/useTilt';

export function GlassCard({ children, className = '', tilt = true }: { children: React.ReactNode; className?: string; tilt?: boolean }) {
  const effect = useTilt(4);
  return (
    <div
      ref={effect.ref as React.RefObject<HTMLDivElement>}
      onMouseMove={tilt ? effect.onMouseMove : undefined}
      onMouseLeave={tilt ? effect.onMouseLeave : undefined}
      className={`glass-card relative overflow-hidden ${className}`}
      style={tilt ? { transform: `perspective(1000px) rotateX(${effect.tilt.rotateX}deg) rotateY(${effect.tilt.rotateY}deg) scale(${effect.tilt.scale})` } : undefined}
    >
      <span className="pointer-events-none absolute inset-0 transition-opacity" style={{ background: `radial-gradient(420px circle at ${effect.tilt.glareX}% ${effect.tilt.glareY}%, rgba(255,255,255,.24), transparent 44%)`, opacity: effect.isActive ? 1 : 0 }} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
