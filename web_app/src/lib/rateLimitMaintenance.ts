import type { Sql, TransactionSql } from 'postgres';

import { db } from './db';
import { rateLimitRetentionCutoff } from './rateLimit';

export const RATE_LIMIT_CLEANUP_BATCH = 500;
export const RATE_LIMIT_CLEANUP_MAX_BATCH = 1_000;

export async function cleanupExpiredRateLimitBuckets(
  sql: Sql | TransactionSql,
  input: { now?: Date; batch?: number } = {},
) {
  const cutoff = rateLimitRetentionCutoff(input.now ?? new Date());
  const batch = Math.max(1, Math.min(Math.trunc(input.batch ?? RATE_LIMIT_CLEANUP_BATCH), RATE_LIMIT_CLEANUP_MAX_BATCH));
  const deleted = await sql<{ deleted: number }[]>`
    WITH candidates AS (
      SELECT route_key, privy_user_id, network_profile, window_start
      FROM api_rate_limit_buckets
      WHERE window_start < ${cutoff}
      ORDER BY window_start
      FOR UPDATE SKIP LOCKED
      LIMIT ${batch}
    ), removed AS (
      DELETE FROM api_rate_limit_buckets AS bucket
      USING candidates
      WHERE bucket.route_key = candidates.route_key
        AND bucket.privy_user_id = candidates.privy_user_id
        AND bucket.network_profile = candidates.network_profile
        AND bucket.window_start = candidates.window_start
      RETURNING 1
    )
    SELECT count(*)::int AS deleted FROM removed
  `;
  return { deleted: deleted[0]?.deleted ?? 0 };
}

export function cleanupConfiguredRateLimitBuckets(input?: { now?: Date; batch?: number }) {
  return cleanupExpiredRateLimitBuckets(db(), input);
}
