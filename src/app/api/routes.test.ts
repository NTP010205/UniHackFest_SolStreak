import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticationError } from '@/lib/auth';
import { DatabaseConfigurationError } from '@/lib/db';
import { RateLimitExceededError, RateLimitUnavailableError } from '@/lib/rateLimit';
import { AlreadySpunError } from '@/lib/store';
import { setOperationalEventSinkForTests, type OperationalEvent } from '@/lib/observability';

import { POST as reportDeposit } from './streak/report/route';
import { GET as getStatus } from './streak/status/route';
import { POST as spinWheel } from './wheel/spin/route';
import { GET as getBadges } from './profile/badges/route';

const mocks = vi.hoisted(() => ({
  authenticateWallet: vi.fn(),
  dashboardFor: vi.fn(),
  getJupiterPositionUsdc: vi.fn(),
  recordSpin: vi.fn(),
  recordVerifiedDeposit: vi.fn(),
  spinWeighted: vi.fn(),
  verifyDepositOnChain: vi.fn(),
  enforceApiRateLimit: vi.fn(),
  badgeProfileFor: vi.fn(),
}));

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  authenticateWallet: mocks.authenticateWallet,
}));

vi.mock('@/lib/jupiter', () => ({
  getJupiterPositionUsdc: mocks.getJupiterPositionUsdc,
}));

vi.mock('@/lib/onchain', () => ({
  verifyDepositOnChain: mocks.verifyDepositOnChain,
}));

vi.mock('@/lib/store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/store')>()),
  dashboardFor: mocks.dashboardFor,
  recordSpin: mocks.recordSpin,
  recordVerifiedDeposit: mocks.recordVerifiedDeposit,
  badgeProfileFor: mocks.badgeProfileFor,
}));

vi.mock('@/lib/wheel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/wheel')>()),
  spinWeighted: mocks.spinWeighted,
}));
vi.mock('@/lib/rateLimit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rateLimit')>()),
  enforceApiRateLimit: mocks.enforceApiRateLimit,
}));

const WALLET = '11111111111111111111111111111111';
const OTHER_WALLET = 'So11111111111111111111111111111111111111112';
const SIGNATURE = '1'.repeat(88);
const DEPOSIT = {
  signature: SIGNATURE,
  walletAddress: WALLET,
  amountBaseUnits: 1_000_000n,
  blockTime: new Date('2026-08-27T12:00:00Z'),
  networkProfile: 'mainnet',
};
const DASHBOARD = {
  wallet: WALLET,
  totalDepositedUsdc: 1,
  currentStreak: 1,
  longestStreak: 1,
  last7Days: [],
  canSpin: true,
};
const operationalEvents: OperationalEvent[] = [];

function post(url: string, body: unknown, token = 'identity-token') {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'privy-id-token': token } : {}),
      'idempotency-key': '123e4567-e89b-42d3-a456-426614174000',
    },
    body: JSON.stringify(body),
  });
}

function status(wallet = WALLET, token = 'identity-token') {
  return new Request(`http://localhost/api/streak/status?wallet=${encodeURIComponent(wallet)}`, {
    headers: token ? { 'privy-id-token': token } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateWallet.mockResolvedValue({ userId: 'privy-user', walletAddress: WALLET });
  mocks.verifyDepositOnChain.mockResolvedValue(DEPOSIT);
  mocks.recordVerifiedDeposit.mockResolvedValue({ inserted: true, currentStreak: 1 });
  mocks.dashboardFor.mockResolvedValue(DASHBOARD);
  mocks.getJupiterPositionUsdc.mockResolvedValue(1.25);
  mocks.spinWeighted.mockReturnValue('badge_bronze');
  mocks.recordSpin.mockResolvedValue(undefined);
  mocks.badgeProfileFor.mockResolvedValue({ networkProfile: 'mainnet', badges: [], recentHistory: [], availableSpinEntitlements: [] });
  mocks.enforceApiRateLimit.mockResolvedValue({ allowed: true, remaining: 1, retryAfterSeconds: 60 });
  operationalEvents.length = 0;
  setOperationalEventSinkForTests(event => operationalEvents.push(event));
});

describe('GET /api/profile/badges', () => {
  it('authenticates the wallet and returns a network-isolated cosmetic profile', async () => {
    const response = await getBadges(new Request(
      `http://localhost/api/profile/badges?wallet=${encodeURIComponent(WALLET)}`,
      { headers: { 'privy-id-token': 'identity-token' } },
    ));
    expect(response.status).toBe(200);
    expect(mocks.badgeProfileFor).toHaveBeenCalledWith('privy-user', WALLET, 'mainnet');
    expect(JSON.stringify(await response.json())).not.toMatch(/points|price|redeem|value/i);
  });

  it('rejects an unauthenticated or wrong wallet before profile access', async () => {
    mocks.authenticateWallet.mockRejectedValue(new AuthenticationError('Wallet mismatch'));
    const response = await getBadges(new Request(
      `http://localhost/api/profile/badges?wallet=${encodeURIComponent(OTHER_WALLET)}`,
    ));
    expect(response.status).toBe(401);
    expect(mocks.badgeProfileFor).not.toHaveBeenCalled();
  });
});
afterEach(() => setOperationalEventSinkForTests());

describe('route validation and authentication', () => {
  it('rejects malformed payloads before calling auth or persistence', async () => {
    const [reportResponse, statusResponse, spinResponse] = await Promise.all([
      reportDeposit(post('http://localhost/api/streak/report', { wallet: 'bad', signature: 'bad', networkProfile: 'mainnet' })),
      getStatus(status('bad')),
      spinWheel(post('http://localhost/api/wheel/spin', { wallet: 'bad' })),
    ]);

    expect([reportResponse.status, statusResponse.status, spinResponse.status]).toEqual([
      400, 400, 400,
    ]);
    expect(mocks.authenticateWallet).not.toHaveBeenCalled();
    expect(mocks.recordVerifiedDeposit).not.toHaveBeenCalled();
    expect(mocks.recordSpin).not.toHaveBeenCalled();
  });

  it('rejects invalid content type, JSON, unknown fields, and oversized bodies', async () => {
    const noType = new Request('http://localhost/api/wheel/spin', { method: 'POST', body: '{}' });
    const invalidJson = new Request('http://localhost/api/wheel/spin', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
    });
    const unknown = post('http://localhost/api/wheel/spin', { wallet: WALLET, extra: true });
    const oversized = post('http://localhost/api/wheel/spin', { wallet: WALLET, padding: 'x'.repeat(5_000) });
    const responses = await Promise.all([noType, invalidJson, unknown, oversized].map(spinWheel));
    expect(responses.map((response) => response.status)).toEqual([415, 400, 400, 413]);
    expect(mocks.authenticateWallet).not.toHaveBeenCalled();
    expect(mocks.recordSpin).not.toHaveBeenCalled();
  });

  it('returns 429 with Retry-After and fails closed when the limiter database fails', async () => {
    mocks.enforceApiRateLimit.mockRejectedValueOnce(new RateLimitExceededError(42));
    let response = await spinWheel(post('http://localhost/api/wheel/spin', { wallet: WALLET }));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('42');
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(operationalEvents.at(-1)?.event).toBe('api.rate_limit.denied');
    expect(mocks.recordSpin).not.toHaveBeenCalled();

    mocks.enforceApiRateLimit.mockRejectedValueOnce(new RateLimitUnavailableError('secret db detail'));
    response = await spinWheel(post('http://localhost/api/wheel/spin', { wallet: WALLET }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Service unavailable', code: 'RATE_LIMIT_UNAVAILABLE' });
    expect(operationalEvents.at(-1)?.event).toBe('api.rate_limit.unavailable');
    expect(JSON.stringify(operationalEvents)).not.toContain('secret db detail');
    expect(mocks.recordSpin).not.toHaveBeenCalled();
  });

  it('returns 401 when the Privy identity does not authenticate the requested wallet', async () => {
    mocks.authenticateWallet.mockRejectedValue(
      new AuthenticationError('Wallet is not linked to this Privy user'),
    );

    const response = await spinWheel(
      post('http://localhost/api/wheel/spin', { wallet: OTHER_WALLET }),
    );

    expect(response.status).toBe(401);
    expect(mocks.authenticateWallet).toHaveBeenCalledWith(expect.any(Request), OTHER_WALLET);
    expect(mocks.recordSpin).not.toHaveBeenCalled();
  });
});

describe('POST /api/streak/report', () => {
  it('rejects a report for a different cluster before on-chain verification', async () => {
    const response = await reportDeposit(
      post('http://localhost/api/streak/report', { wallet: WALLET, signature: SIGNATURE, networkProfile: 'devnet' }),
    );
    expect(response.status).toBe(409);
    expect(mocks.verifyDepositOnChain).not.toHaveBeenCalled();
    expect(mocks.recordVerifiedDeposit).not.toHaveBeenCalled();
  });

  it('re-verifies the transaction for the authenticated wallet before writing', async () => {
    const response = await reportDeposit(
      post('http://localhost/api/streak/report', { wallet: WALLET, signature: SIGNATURE, networkProfile: 'mainnet' }),
    );

    expect(response.status).toBe(200);
    expect(mocks.verifyDepositOnChain).toHaveBeenCalledWith(SIGNATURE, WALLET);
    expect(mocks.recordVerifiedDeposit).toHaveBeenCalledWith('privy-user', DEPOSIT);
  });

  it('rejects an invalid on-chain transaction without writing', async () => {
    mocks.verifyDepositOnChain.mockResolvedValue(null);

    const response = await reportDeposit(
      post('http://localhost/api/streak/report', { wallet: WALLET, signature: SIGNATURE, networkProfile: 'mainnet' }),
    );

    expect(response.status).toBe(422);
    expect(mocks.recordVerifiedDeposit).not.toHaveBeenCalled();
  });

  it('returns 200 and inserted=false when a signature is replayed', async () => {
    mocks.recordVerifiedDeposit
      .mockResolvedValueOnce({ inserted: true, currentStreak: 1 })
      .mockResolvedValueOnce({ inserted: false, currentStreak: 1 });
    const request = () =>
      post('http://localhost/api/streak/report', { wallet: WALLET, signature: SIGNATURE, networkProfile: 'mainnet' });

    const first = await reportDeposit(request());
    const replay = await reportDeposit(request());

    expect(first.status).toBe(200);
    expect(await replay.json()).toEqual({ inserted: false, currentStreak: 1 });
    expect(mocks.recordVerifiedDeposit).toHaveBeenCalledTimes(2);
  });

  it('maps a missing database configuration to 503', async () => {
    mocks.recordVerifiedDeposit.mockRejectedValue(
      new DatabaseConfigurationError('DATABASE_URL is not configured'),
    );

    const response = await reportDeposit(
      post('http://localhost/api/streak/report', { wallet: WALLET, signature: SIGNATURE, networkProfile: 'mainnet' }),
    );

    expect(response.status).toBe(503);
  });
});

describe('GET /api/streak/status', () => {
  it('keeps streak data available when the Jupiter position read fails', async () => {
    mocks.getJupiterPositionUsdc.mockRejectedValue(new Error('Jupiter unavailable'));

    const response = await getStatus(status());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ...DASHBOARD,
      currentPositionUsdc: null,
      positionUnavailable: true,
    });
  });
});

describe('POST /api/wheel/spin', () => {
  it('returns the server ledger result and lets the database reject a concurrent spin', async () => {
    let claimed = false;
    mocks.recordSpin.mockImplementation(async () => {
      if (claimed) throw new AlreadySpunError('You already spun today');
      claimed = true;
      await Promise.resolve();
      return {
        spinId: '1', result: 'badge_bronze', badgeCode: 'BRONZE', label: 'Bronze Badge',
        isNewBadge: true, awardCount: 1, source: 'streak', remainingSpins: 0,
        replayed: false,
      };
    });

    const request = () => post('http://localhost/api/wheel/spin', { wallet: WALLET });
    const responses = await Promise.all([spinWheel(request()), spinWheel(request())]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(mocks.recordSpin).toHaveBeenCalledTimes(2);
    expect(mocks.recordSpin).toHaveBeenCalledWith(
      'privy-user', WALLET, 'mainnet', '123e4567-e89b-42d3-a456-426614174000',
    );
  });

  it('ignores client-selected badge/outcome fields', async () => {
    const response = await spinWheel(post('http://localhost/api/wheel/spin', {
      wallet: WALLET, badgeCode: 'JACKPOT', result: 'jackpot_usdc',
    }));
    expect(response.status).toBe(400);
    expect(mocks.recordSpin).not.toHaveBeenCalled();
  });
});
