import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { isNeutralTilt } from './useTilt';

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

describe('authenticated dashboard runtime stability', () => {
  it('does not reset transaction state when Privy returns a new function reference', () => {
    const transactionHook = source('./useVaultTransaction.ts');
    expect(transactionHook).toContain('}, [kind, sessionKey]);');
    expect(transactionHook).not.toMatch(/\[kind, sessionKey, identityToken, signTransaction/);
    expect(transactionHook).toContain('signTransactionRef.current');
  });

  it('clears stale terminal feedback when the active wallet loses message verification', () => {
    const transactionHook = source('./useVaultTransaction.ts');
    const transactionCard = source('../components/TransactionCard.tsx');
    expect(transactionHook).toContain("['confirmed', 'failed', 'expired'].includes(current.phase)");
    expect(transactionHook).toContain('}, [walletVerified]);');
    expect(transactionCard).toContain('const showSuccess = walletVerified');
    expect(transactionCard).toContain('href="#wallet-readiness"');
  });

  it('uses the latest identity token without coupling fetch effects to token identity', () => {
    for (const file of ['./usePortfolio.ts', './useBadgeProfile.ts', './useUserActivityHeartbeat.ts', '../components/AdminLab.tsx']) {
      const contents = source(file);
      expect(contents).toContain('identityTokenRef.current = identityToken');
      expect(contents).toContain('const hasIdentityToken = Boolean(identityToken)');
    }
  });

  it('keeps presence lightweight, visible-tab only, and independent from transactions', () => {
    const heartbeat = source('./useUserActivityHeartbeat.ts');
    const navbar = source('../components/nav/Navbar.tsx');
    const adminLab = source('../components/AdminLab.tsx');
    expect(navbar).toContain('useUserActivityHeartbeat(walletAddress)');
    expect(heartbeat).toContain('USER_ACTIVITY_HEARTBEAT_MS = 30_000');
    expect(heartbeat).toContain("document.visibilityState !== 'visible'");
    expect(heartbeat).toContain("fetch('/api/activity/heartbeat'");
    expect(heartbeat).not.toMatch(/signTransaction|sendRawTransaction|sendTransaction/);
    expect(adminLab).toContain('ADMIN_AUTO_REFRESH_MS = 15_000');
    expect(adminLab).toContain("accessState !== 'authorized'");
    expect(adminLab).toContain('void loadAdminData(true)');
  });

  it('recognizes neutral tilt state so repeated pointer leave events are no-ops', () => {
    expect(isNeutralTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50, scale: 1 })).toBe(true);
    expect(isNeutralTilt({ rotateX: 0, rotateY: 1, glareX: 50, glareY: 50, scale: 1 })).toBe(false);
  });

  it('keeps every primary menu destination navigable from the dashboard', () => {
    const navbar = source('../components/nav/Navbar.tsx');
    for (const destination of ['/', '/dashboard', '/#badges', '/#wiki', '/#about', '/admin']) {
      expect(navbar).toContain(`href="${destination}"`);
    }
    expect(navbar).toContain('isDevnetAdmin && <Link href="/admin"');
    expect(navbar).toContain('/api/admin/access?wallet=');
    expect(navbar).toContain('setIsDevnetAdmin(false)');
    expect(navbar).not.toContain('preventDefault');
  });
});
