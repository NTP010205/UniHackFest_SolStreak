'use client';

import { useCallback, useRef, useState } from 'react';

export interface TiltState {
  rotateX: number;
  rotateY: number;
  glareX: number;
  glareY: number;
  scale: number;
}

const NEUTRAL_TILT: TiltState = { rotateX: 0, rotateY: 0, glareX: 50, glareY: 50, scale: 1 };

export function isNeutralTilt(tilt: TiltState): boolean {
  return tilt.rotateX === 0
    && tilt.rotateY === 0
    && tilt.glareX === 50
    && tilt.glareY === 50
    && tilt.scale === 1;
}

export function useTilt(maxTilt = 5) {
  const ref = useRef<HTMLElement | null>(null);
  const [tilt, setTilt] = useState<TiltState>(NEUTRAL_TILT);
  const [isActive, setIsActive] = useState(false);

  const onMouseMove = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const node = ref.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setTilt({ rotateX: (0.5 - y) * maxTilt, rotateY: (x - 0.5) * maxTilt, glareX: x * 100, glareY: y * 100, scale: 1.015 });
    setIsActive(true);
  }, [maxTilt]);

  const reset = useCallback(() => {
    setTilt(current => isNeutralTilt(current) ? current : NEUTRAL_TILT);
    setIsActive(current => current ? false : current);
  }, []);

  return { ref, tilt, isActive, onMouseMove, onMouseLeave: reset };
}
