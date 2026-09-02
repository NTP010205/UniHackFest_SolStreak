'use client';

import { useEffect } from 'react';

export function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, 3200);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);
  return message ? <div className="glass-card fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-5 py-3 text-sm text-white" role="status">{message}</div> : null;
}
