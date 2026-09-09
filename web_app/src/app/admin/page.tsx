'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import AdminLab from '@/components/AdminLab';
import { InteractiveBackground } from '@/components/background/InteractiveBackground';
import Spinner from '@/components/Spinner';
import { useSolStreakWallet } from '@/hooks/useSolStreakWallet';

export default function AdminPage() {
  const router = useRouter();
  const { ready, authenticated, wallet, sessionKey } = useSolStreakWallet();
  const noOpRefresh = useCallback(() => undefined, []);

  useEffect(() => {
    if (ready && !authenticated) router.replace('/');
  }, [ready, authenticated, router]);

  if (!ready || !authenticated || !wallet || !sessionKey) {
    return <div className="mx-auto flex min-h-[55vh] max-w-4xl items-center justify-center gap-3 px-4 text-sm text-slate-400">
      <Spinner className="h-6 w-6 text-cyan-300" />
      {!ready ? 'Initializing secure wallet…' : 'Loading admin access…'}
    </div>;
  }

  return <div className="relative min-h-[calc(100vh-72px)]">
    <InteractiveBackground />
    <main className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <AdminLab key={`admin-page:${sessionKey}`} walletAddress={wallet.address} standalone onChanged={noOpRefresh} />
    </main>
  </div>;
}
