import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAccessError } from '@/lib/admin';

const mocks = vi.hoisted(() => ({
  requireDevnetAdmin: vi.fn(), enforceApiRateLimit: vi.fn(), recordAdminSpin: vi.fn(),
  setAdminDemoStreak: vi.fn(), devnetAdminMetrics: vi.fn(), devnetAdminUsers: vi.fn(),
}));
vi.mock('@/lib/networkProfile', () => ({ ACTIVE_NETWORK: { name: 'devnet' } }));
vi.mock('@/lib/admin', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/admin')>()), requireDevnetAdmin: mocks.requireDevnetAdmin,
}));
vi.mock('@/lib/rateLimit', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/rateLimit')>()), enforceApiRateLimit: mocks.enforceApiRateLimit,
}));
vi.mock('@/lib/store', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/store')>()), recordAdminSpin: mocks.recordAdminSpin,
  setAdminDemoStreak: mocks.setAdminDemoStreak, devnetAdminMetrics: mocks.devnetAdminMetrics,
  devnetAdminUsers: mocks.devnetAdminUsers,
}));

import { POST as spin } from './spin/route';
import { POST as streak } from './streak/route';
import { GET as metrics } from './metrics/route';
import { GET as users } from './users/route';
import { GET as access } from './access/route';

const identity = { userId: 'did:privy:admin', walletAddress: '11111111111111111111111111111111' };
const key = '123e4567-e89b-42d3-a456-426614174000';
function post(path: string, body: unknown, withKey = false) {
  return new Request(`http://localhost${path}`, { method: 'POST', headers: {
    'content-type': 'application/json', 'privy-id-token': 'token', ...(withKey ? { 'idempotency-key': key } : {}),
  }, body: JSON.stringify(body) });
}

describe('Devnet Admin Lab routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDevnetAdmin.mockResolvedValue(identity);
    mocks.enforceApiRateLimit.mockResolvedValue({ allowed: true, remaining: 1, retryAfterSeconds: 60 });
    mocks.recordAdminSpin.mockResolvedValue({ spinId: '1', result: 'badge_bronze', badgeCode: 'BRONZE',
      label: 'Bronze Badge', isNewBadge: true, awardCount: 1, source: 'admin_test', remainingSpins: 1, replayed: false });
    mocks.setAdminDemoStreak.mockResolvedValue({ currentStreak: 15, longestStreak: 15 });
    mocks.devnetAdminMetrics.mockResolvedValue({ totalUsers: 0, devnetProfiles: 0, activeProfiles7d: 0,
      activeStreaks: 0, streakDistribution: { days1to6: 0, days7to14: 0, days15to29: 0, days30Plus: 0 },
      totalSpins: 0, totalBadgeAwards: 0, uniqueBadgeOwnerships: 0 });
    mocks.devnetAdminUsers.mockResolvedValue([{ walletLabel: '111111…111111', currentStreak: 4,
      longestStreak: 7, totalDepositedUsdc: 3, lastActiveAt: new Date('2026-09-06T00:00:00Z'), isOnline: true }]);
  });

  it('rejects a non-admin before limiter or database mutation', async () => {
    mocks.requireDevnetAdmin.mockRejectedValue(new AdminAccessError('denied'));
    const response = await spin(post('/api/admin/spin', { wallet: identity.walletAddress }, true));
    expect(response.status).toBe(403);
    expect(mocks.enforceApiRateLimit).not.toHaveBeenCalled();
    expect(mocks.recordAdminSpin).not.toHaveBeenCalled();
  });

  it('strictly validates payloads and idempotency keys', async () => {
    expect((await spin(post('/api/admin/spin', { wallet: identity.walletAddress, badgeCode: 'JACKPOT' }, true))).status).toBe(400);
    expect((await spin(post('/api/admin/spin', { wallet: identity.walletAddress }))).status).toBe(400);
    expect((await streak(post('/api/admin/streak', { currentStreak: 15 }))).status).toBe(400);
    expect((await streak(post('/api/admin/streak', { wallet: identity.walletAddress, currentStreak: 366 }))).status).toBe(400);
    expect(mocks.recordAdminSpin).not.toHaveBeenCalled();
    expect(mocks.setAdminDemoStreak).not.toHaveBeenCalled();
  });

  it('uses only the authenticated admin identity for spin and streak mutation', async () => {
    expect((await spin(post('/api/admin/spin', { wallet: identity.walletAddress }, true))).status).toBe(200);
    expect(mocks.requireDevnetAdmin).toHaveBeenLastCalledWith(expect.any(Request), 'devnet', identity.walletAddress);
    expect(mocks.recordAdminSpin).toHaveBeenCalledWith(identity.userId, identity.walletAddress, 'devnet', key);
    expect((await streak(post('/api/admin/streak', { wallet: identity.walletAddress, currentStreak: 15 }))).status).toBe(200);
    expect(mocks.requireDevnetAdmin).toHaveBeenLastCalledWith(expect.any(Request), 'devnet', identity.walletAddress);
    expect(mocks.setAdminDemoStreak).toHaveBeenCalledWith(identity.userId, identity.walletAddress, 'devnet', 15);
  });

  it('returns only aggregate Devnet metrics after backend admin confirmation', async () => {
    const response = await metrics(new Request(`http://localhost/api/admin/metrics?wallet=${identity.walletAddress}`, {
      headers: { 'privy-id-token': 'token' },
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ isAdmin: true, networkProfile: 'devnet', totalUsers: 0 });
    expect(mocks.requireDevnetAdmin).toHaveBeenCalledWith(expect.any(Request), 'devnet', identity.walletAddress);
    expect(JSON.stringify(body)).not.toMatch(/wallet|privy|secret|database/i);
  });

  it('returns read-only, masked Devnet user streak rows to an authenticated admin', async () => {
    const response = await users(new Request(`http://localhost/api/admin/users?wallet=${identity.walletAddress}`, {
      headers: { 'privy-id-token': 'token' },
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ isAdmin: true, networkProfile: 'devnet', users: [
      { walletLabel: '111111…111111', currentStreak: 4, longestStreak: 7 },
    ] });
    expect(body.users[0].isOnline).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/did:privy|email|database/i);
    expect(mocks.requireDevnetAdmin).toHaveBeenCalledWith(expect.any(Request), 'devnet', identity.walletAddress);
  });

  it('requires an explicit active wallet on read-only admin routes', async () => {
    expect((await metrics(new Request('http://localhost/api/admin/metrics', {
      headers: { 'privy-id-token': 'token' },
    }))).status).toBe(400);
    expect((await users(new Request('http://localhost/api/admin/users', {
      headers: { 'privy-id-token': 'token' },
    }))).status).toBe(400);
    expect(mocks.devnetAdminMetrics).not.toHaveBeenCalled();
    expect(mocks.devnetAdminUsers).not.toHaveBeenCalled();
  });

  it('checks navigation access without reading admin database data', async () => {
    const response = await access(new Request(`http://localhost/api/admin/access?wallet=${identity.walletAddress}`, {
      headers: { 'privy-id-token': 'token' },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ isAdmin: true, networkProfile: 'devnet' });
    expect(mocks.requireDevnetAdmin).toHaveBeenCalledWith(expect.any(Request), 'devnet', identity.walletAddress);
    expect(mocks.devnetAdminMetrics).not.toHaveBeenCalled();
    expect(mocks.devnetAdminUsers).not.toHaveBeenCalled();
  });
});
