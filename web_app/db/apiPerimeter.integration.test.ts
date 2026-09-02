import { randomUUID } from 'node:crypto';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  consumeRateLimit,
  enforceRateLimitWithClient,
  normalizeRateLimitWindow,
  RateLimitExceededError,
  rateLimitRetentionCutoff,
} from '../src/lib/rateLimit';
import { cleanupExpiredRateLimitBuckets } from '../src/lib/rateLimitMaintenance';

const rehearsalUrl = process.env.SOLSTREAK_REHEARSAL_DATABASE_URL;
const PROJECT_REF = 'ugijqdapnsuefnbldlpt';
const APP_TABLES = ['users', 'deposits', 'streaks', 'spins', 'transaction_submissions'] as const;
const namespace = `perimeter_${Date.now()}_${randomUUID().slice(0, 8)}`;
const policy = { route: `${namespace}.route`, limit: 5, windowSeconds: 30 };
const REHEARSAL_POOL_MAX_CONNECTIONS = 5;
let databaseNow: Date;
let sql: Sql | undefined;
let applicationTablesReady = false;

function validProject(raw: string) {
  try {
    const parsed = new URL(raw);
    return parsed.hostname.split(/[.-]/).includes(PROJECT_REF) ||
      decodeURIComponent(parsed.username).split(/[.:_-]/).includes(PROJECT_REF);
  } catch {
    return false;
  }
}

async function appCounts(client: Sql) {
  const counts: Record<string, number> = {};
  for (const table of APP_TABLES) {
    const [row] = await client.unsafe<{ count: string }[]>(`SELECT COUNT(*)::text AS count FROM ${table}`);
    counts[table] = Number(row.count);
  }
  return counts;
}

async function cleanup() {
  if (!sql) return;
  const [table] = await sql<{ present: boolean }[]>`
    SELECT to_regclass('public.api_rate_limit_buckets') IS NOT NULL AS present
  `;
  if (!table.present) return;
  await sql`DELETE FROM api_rate_limit_buckets WHERE route_key LIKE ${`${namespace}%`}`;
}

describe('PostgreSQL API perimeter rate limiter', () => {
  beforeAll(async () => {
    if (!rehearsalUrl) throw new Error('BLOCKED: SOLSTREAK_REHEARSAL_DATABASE_URL is required');
    if (!validProject(rehearsalUrl)) throw new Error('BLOCKED: rehearsal project ref mismatch');
    sql = postgres(rehearsalUrl, {
      max: REHEARSAL_POOL_MAX_CONNECTIONS,
      ssl: 'require',
      connect_timeout: 10,
    });
    const [identity] = await sql<{ database: string }[]>`SELECT current_database() AS database`;
    if (identity.database !== 'postgres') throw new Error('BLOCKED: current_database mismatch');
    const [clock] = await sql<{ database_now: Date }[]>`
      SELECT clock_timestamp() AS database_now
    `;
    databaseNow = clock.database_now;
    for (const table of APP_TABLES) {
      const [row] = await sql<{ present: boolean }[]>`
        SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS present
      `;
      if (!row.present) throw new Error(`BLOCKED: required table missing: ${table}`);
    }
    applicationTablesReady = true;
    if (Object.values(await appCounts(sql)).some((count) => count !== 0)) {
      throw new Error('BLOCKED: application tables are not initially empty');
    }
    const [rateTable] = await sql<{ present: boolean }[]>`
      SELECT to_regclass('public.api_rate_limit_buckets') IS NOT NULL AS present
    `;
    if (!rateTable.present) throw new Error('BLOCKED: required table missing: api_rate_limit_buckets');
    const [buckets] = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM api_rate_limit_buckets`;
    if (buckets.count !== '0') throw new Error('BLOCKED: rate-limit table is not initially empty');
  }, 20_000);

  afterAll(async () => {
    try {
      await cleanup();
      if (sql) {
        if (applicationTablesReady) {
          expect(await appCounts(sql)).toEqual({
            users: 0, deposits: 0, streaks: 0, spins: 0, transaction_submissions: 0,
          });
        }
        const [table] = await sql<{ present: boolean }[]>`
          SELECT to_regclass('public.api_rate_limit_buckets') IS NOT NULL AS present
        `;
        if (table.present) {
          expect((await sql<{ count: string }[]>`
            SELECT COUNT(*)::text AS count FROM api_rate_limit_buckets
          `)[0].count).toBe('0');
        }
      }
    } finally {
      await sql?.end();
    }
  }, 20_000);

  it('allows requests below the threshold and returns retry metadata above it', async () => {
    const now = databaseNow;
    const { windowEnd } = normalizeRateLimitWindow(now, policy.windowSeconds);
    const expectedRetryAfterSeconds = Math.max(
      1,
      Math.ceil((windowEnd.getTime() - now.getTime()) / 1_000),
    );
    for (let index = 0; index < policy.limit; index += 1) {
      const result = await consumeRateLimit(sql!, { policy, userId: 'user-a', networkProfile: 'devnet', now });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(policy.limit - index - 1);
    }
    const denied = await consumeRateLimit(sql!, { policy, userId: 'user-a', networkProfile: 'devnet', now });
    expect(denied).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: expectedRetryAfterSeconds,
    });
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(policy.windowSeconds);
  });

  it('atomically prevents concurrent requests from exceeding the limit', async () => {
    const now = databaseNow;
    const concurrentPolicy = { ...policy, route: `${namespace}.concurrent`, limit: 7 };
    const results = await Promise.allSettled(Array.from({ length: 30 }, () =>
      enforceRateLimitWithClient(sql!, {
        policy: concurrentPolicy, userId: 'user-a', networkProfile: 'devnet', now,
      }),
    ));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(7);
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected).toHaveLength(23);
    expect(rejected.every((result) => result.reason instanceof RateLimitExceededError)).toBe(true);
    const [bucket] = await sql!<{ request_count: number }[]>`
      SELECT request_count FROM api_rate_limit_buckets
      WHERE route_key = ${concurrentPolicy.route} AND privy_user_id = 'user-a'
    `;
    expect(bucket.request_count).toBe(7);
  });

  it('separates users and network profiles', async () => {
    const now = databaseNow;
    const scoped = { ...policy, route: `${namespace}.scoped`, limit: 1 };
    expect((await consumeRateLimit(sql!, { policy: scoped, userId: 'user-a', networkProfile: 'devnet', now })).allowed).toBe(true);
    expect((await consumeRateLimit(sql!, { policy: scoped, userId: 'user-b', networkProfile: 'devnet', now })).allowed).toBe(true);
    expect((await consumeRateLimit(sql!, { policy: scoped, userId: 'user-a', networkProfile: 'mainnet', now })).allowed).toBe(true);
    expect((await consumeRateLimit(sql!, { policy: scoped, userId: 'user-a', networkProfile: 'devnet', now })).allowed).toBe(false);
  });

  it('resets a fixed window independently from retention cleanup', async () => {
    const resetPolicy = { ...policy, route: `${namespace}.window-reset`, limit: 1 };
    const firstWindow = new Date(databaseNow.getTime() - 5 * 60_000);
    expect((await consumeRateLimit(sql!, {
      policy: resetPolicy, userId: 'user', networkProfile: 'devnet', now: firstWindow,
    })).allowed).toBe(true);
    expect((await consumeRateLimit(sql!, {
      policy: resetPolicy, userId: 'user', networkProfile: 'devnet',
      now: new Date(firstWindow.getTime() + policy.windowSeconds * 1_000),
    })).allowed).toBe(true);
  });

  it('deletes only buckets older than the 24-hour retention cutoff', async () => {
    const retentionPolicy = { ...policy, route: `${namespace}.retention`, limit: 10 };
    const oldTime = new Date(databaseNow.getTime() - 25 * 60 * 60_000);
    const recentTime = new Date(databaseNow.getTime() - 60 * 60_000);
    await consumeRateLimit(sql!, {
      policy: retentionPolicy, userId: 'old', networkProfile: 'devnet', now: oldTime,
    });
    await consumeRateLimit(sql!, {
      policy: retentionPolicy, userId: 'recent', networkProfile: 'devnet', now: recentTime,
    });
    expect(rateLimitRetentionCutoff(databaseNow)).toEqual(new Date(databaseNow.getTime() - 24 * 60 * 60_000));
    const [first, second] = await Promise.all([
      cleanupExpiredRateLimitBuckets(sql!, { now: databaseNow, batch: 1 }),
      cleanupExpiredRateLimitBuckets(sql!, { now: databaseNow, batch: 1 }),
    ]);
    expect(first.deleted + second.deleted).toBe(1);
    const rows = await sql!<{ privy_user_id: string }[]>`
      SELECT privy_user_id FROM api_rate_limit_buckets
      WHERE route_key = ${retentionPolicy.route}
    `;
    expect(rows).toEqual([{ privy_user_id: 'recent' }]);
  });
});
