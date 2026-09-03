import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminAccessError, isAdminPrivyUserId, parseAdminPrivyUserIds, requireDevnetAdmin } from './admin';

describe('Devnet admin identity boundary', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('parses trimmed IDs and requires an exact whole-ID match', () => {
    expect([...parseAdminPrivyUserIds(' did:privy:a, did:privy:b ,,')]).toEqual(['did:privy:a', 'did:privy:b']);
    expect(isAdminPrivyUserId('did:privy:a', 'did:privy:a,did:privy:b')).toBe(true);
    expect(isAdminPrivyUserId('privy:a', 'did:privy:a,did:privy:b')).toBe(false);
  });

  it('fails closed for a missing or empty allowlist', () => {
    expect(isAdminPrivyUserId('did:privy:a', undefined)).toBe(false);
    expect(isAdminPrivyUserId('did:privy:a', ' , ')).toBe(false);
  });

  it('authenticates before authorization and rejects Mainnet even for an allowlisted user', async () => {
    vi.stubEnv('SOLSTREAK_ADMIN_PRIVY_USER_IDS', 'did:privy:admin');
    const authenticate = vi.fn().mockResolvedValue({ userId: 'did:privy:admin', walletAddress: 'wallet' });
    await expect(requireDevnetAdmin(new Request('http://local'), 'mainnet', authenticate))
      .rejects.toBeInstanceOf(AdminAccessError);
    expect(authenticate).toHaveBeenCalledOnce();
  });

  it('keeps admin implementation free of destructive SQL', () => {
    const sources = [
      new URL('./admin.ts', import.meta.url), new URL('./badges.ts', import.meta.url),
      new URL('./store.ts', import.meta.url), new URL('../app/api/admin/spin/route.ts', import.meta.url),
      new URL('../app/api/admin/streak/route.ts', import.meta.url),
    ].map(url => readFileSync(url, 'utf8')).join('\n');
    expect(sources).not.toMatch(/\bDELETE\s+FROM\b|\bTRUNCATE\b/i);
  });
});
