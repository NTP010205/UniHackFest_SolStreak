import type { Sql, TransactionSql } from 'postgres';

import { db } from './db';
import type { SolanaNetworkProfileName } from './networkProfile';

export interface RateLimitPolicy {
  route: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class RateLimitUnavailableError extends Error {}
export class RateLimitExceededError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Rate limit exceeded');
  }
}

export const API_RATE_LIMITS = {
  status: { route: 'streak.status', limit: 60, windowSeconds: 60 },
  report: { route: 'streak.report', limit: 10, windowSeconds: 300 },
  spin: { route: 'wheel.spin', limit: 5, windowSeconds: 300 },
  badges: { route: 'profile.badges', limit: 30, windowSeconds: 60 },
  submissionTrack: { route: 'submissions.track', limit: 20, windowSeconds: 300 },
  submissionRecovery: { route: 'submissions.recovery', limit: 30, windowSeconds: 60 },
  scheduler: { route: 'internal.reconcile', limit: 6, windowSeconds: 60 },
  adminSpin: { route: 'admin.spin', limit: 20, windowSeconds: 300 },
  adminStreak: { route: 'admin.streak', limit: 12, windowSeconds: 300 },
  adminMetrics: { route: 'admin.metrics', limit: 30, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitPolicy>;

export const RATE_LIMIT_RETENTION_HOURS = 24;

export function normalizeRateLimitWindow(now: Date, windowSeconds: number) {
  const windowMs = windowSeconds * 1_000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  return { windowStart, windowEnd: new Date(windowStart.getTime() + windowMs) };
}

export function rateLimitRetentionCutoff(now: Date, retentionHours = RATE_LIMIT_RETENTION_HOURS) {
  return new Date(now.getTime() - retentionHours * 60 * 60 * 1_000);
}

export async function consumeRateLimit(
  sql: Sql | TransactionSql,
  input: {
    policy: RateLimitPolicy;
    userId: string;
    networkProfile: SolanaNetworkProfileName;
    now?: Date;
  },
): Promise<RateLimitResult> {
  const now = input.now ?? new Date();
  const { windowStart, windowEnd } = normalizeRateLimitWindow(now, input.policy.windowSeconds);
  const rows = await sql<{ request_count: number }[]>`
    INSERT INTO api_rate_limit_buckets (
      route_key, privy_user_id, network_profile, window_start, request_count
    ) VALUES (
      ${input.policy.route}, ${input.userId}, ${input.networkProfile}, ${windowStart}, 1
    )
    ON CONFLICT (route_key, privy_user_id, network_profile, window_start)
    DO UPDATE SET request_count = api_rate_limit_buckets.request_count + 1,
                  updated_at = now()
    WHERE api_rate_limit_buckets.request_count < ${input.policy.limit}
    RETURNING request_count
  `;
  const count = rows[0]?.request_count;
  return {
    allowed: count !== undefined,
    remaining: count === undefined ? 0 : Math.max(0, input.policy.limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((windowEnd.getTime() - now.getTime()) / 1_000)),
  };
}

export async function enforceRateLimitWithClient(
  sql: Sql | TransactionSql,
  input: {
    policy: RateLimitPolicy;
    userId: string;
    networkProfile: SolanaNetworkProfileName;
    now?: Date;
  },
) {
  try {
    const result = await consumeRateLimit(sql, input);
    if (!result.allowed) throw new RateLimitExceededError(result.retryAfterSeconds);
    return result;
  } catch (error) {
    if (error instanceof RateLimitExceededError) throw error;
    throw new RateLimitUnavailableError('Rate limiter unavailable');
  }
}

export async function enforceApiRateLimit(input: {
  policy: RateLimitPolicy;
  userId: string;
  networkProfile: SolanaNetworkProfileName;
}) {
  return enforceRateLimitWithClient(db(), input);
}
