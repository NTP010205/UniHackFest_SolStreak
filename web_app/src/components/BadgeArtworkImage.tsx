'use client';

import { useState } from 'react';
import Image from 'next/image';
import { BADGE_ARTWORK, BADGE_LABELS, type BadgeArtworkCode } from '@/lib/badgeArtwork';

export default function BadgeArtworkImage({ code, className = '', locked = false, size = 96 }: {
  code: BadgeArtworkCode; className?: string; locked?: boolean; size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div role="img" aria-label={`${BADGE_LABELS[code]} artwork unavailable`}
      className={`grid place-items-center rounded-xl bg-white/5 text-xs text-slate-500 ${className}`}>Artwork unavailable</div>;
  }
  return <Image src={BADGE_ARTWORK[code]} alt={`${BADGE_LABELS[code]} badge`} width={size} height={size}
    onError={() => setFailed(true)} className={`${locked ? 'grayscale opacity-30' : ''} ${className}`} />;
}
