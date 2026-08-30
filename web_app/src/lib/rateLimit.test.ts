import type { Sql } from 'postgres';
import { describe, expect, it } from 'vitest';

import {
  consumeRateLimit,
  enforceRateLimitWithClient,
  normalizeRateLimitWindow,
  RateLimitExceededError,
  RateLimitUnavailableError,
  rateLimitRetentionCutoff,
} from './rateLimit';

const policy = { route: 'test.route', limit: 3, windowSeconds: 60 };
const now = new Date('2026-08-30T12:00:30.500Z');

describe('rate-limit time and failure semantics', () => {
  it('normalizes fixed windows and computes the retention boundary', () => {
    expect(normalizeRateLimitWindow(now, 60)).toEqual({
      windowStart: new Date('2026-08-30T12:00:00.000Z'),
      windowEnd: new Date('2026-08-30T12:01:00.000Z'),
    });
    expect(rateLimitRetentionCutoff(now)).toEqual(new Date('2026-08-29T12:00:30.500Z'));
    const cutoff = rateLimitRetentionCutoff(now);
    expect(new Date(cutoff.getTime() - 1).getTime()).toBeLessThan(cutoff.getTime());
    expect(new Date(cutoff.getTime()).getTime()).not.toBeLessThan(cutoff.getTime());
  });

  it('maps connection exhaustion and other SQL failures to RateLimitUnavailableError', async () => {
    const failing = (() => Promise.reject(Object.assign(new Error('max clients reached'), {
      code: 'EMAXCONNSESSION',
    }))) as unknown as Sql;
    await expect(enforceRateLimitWithClient(failing, {
      policy, userId: 'user', networkProfile: 'devnet', now,
    })).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });

  it('does not allow concurrent callers beyond the atomic threshold', async () => {
    let count = 0;
    const atomic = (() => {
      if (count >= policy.limit) return Promise.resolve([]);
      count += 1;
      return Promise.resolve([{ request_count: count }]);
    }) as unknown as Sql;
    const outcomes = await Promise.allSettled(Array.from({ length: 12 }, () =>
      enforceRateLimitWithClient(atomic, {
        policy, userId: 'user', networkProfile: 'devnet', now,
      }),
    ));
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(policy.limit);
    const rejected = outcomes.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected).toHaveLength(9);
    expect(rejected.every((result) => result.reason instanceof RateLimitExceededError)).toBe(true);
    expect(count).toBe(policy.limit);
  });

  it('returns stable retry metadata from the normalized window', async () => {
    const sql = (() => Promise.resolve([{ request_count: 1 }])) as unknown as Sql;
    const thirtySeconds = { ...policy, windowSeconds: 30 };
    const cases = [
      ['window start', new Date('2026-08-30T12:00:00.000Z'), 30],
      ['window middle', new Date('2026-08-30T12:00:15.001Z'), 15],
      ['window end', new Date('2026-08-30T12:00:29.999Z'), 1],
      ['next window', new Date('2026-08-30T12:00:30.000Z'), 30],
    ] as const;
    for (const [, timestamp, expected] of cases) {
      const result = await consumeRateLimit(sql, {
        policy: thirtySeconds, userId: 'user', networkProfile: 'devnet', now: timestamp,
      });
      expect(result).toMatchObject({ allowed: true, retryAfterSeconds: expected });
      expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(thirtySeconds.windowSeconds);
    }
  });
});
