'use client';

import { useTilt } from '@/hooks/useTilt';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' };

export function GlassButton({ children, className = '', variant = 'primary', ...props }: Props) {
  const effect = useTilt(5);
  return (
    <button
      {...props}
      ref={effect.ref as React.RefObject<HTMLButtonElement>}
      onMouseMove={effect.onMouseMove}
      onMouseLeave={effect.onMouseLeave}
      className={`glass-btn glass-btn-${variant} ${className}`}
      style={{ transform: `perspective(900px) rotateX(${effect.tilt.rotateX}deg) rotateY(${effect.tilt.rotateY}deg) scale(${effect.tilt.scale})`, ...props.style }}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}
