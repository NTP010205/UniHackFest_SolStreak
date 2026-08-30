import { randomUUID } from 'node:crypto';
import postgres, { type Sql } from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createSchedulerHandler } from '../app/api/internal/reconcile/route';
import {
  reconcileSubmissions,
  type ReconciliationChain,
  type ReconciliationStore,
  type ReconciliationSummary,
} from '../lib/reconciliation';
import type { SubmissionRecord, SubmissionStatus } from '../lib/submissions';

const rehearsalUrl = process.env.SOLSTREAK_REHEARSAL_DATABASE_URL;
const rehearsalSecret = process.env.SOLSTREAK_REHEARSAL_CRON_SECRET;
const PROJECT_REF = 'ugijqdapnsuefnbldlpt';
const TABLES = ['users', 'deposits', 'streaks', 'spins', 'transaction_submissions'] as const;
const namespace = `scheduler_${Date.now()}_${randomUUID().slice(0, 8)}`;
const wallet = `${namespace}_wallet`;
const userId = `${namespace}_user`;
const baseNow = new Date('2026-08-30T00:00:00Z');
let sql: Sql | undefined;

function urlHasExpectedProjectRef(raw: string) {
  try {
    const parsed = new URL(raw);
    return parsed.hostname.split(/[.-]/).includes(PROJECT_REF) ||
      decodeURIComponent(parsed.username).split(/[.:_-]/).includes(PROJECT_REF);
  } catch {
    return false;
  }
}

async function counts(client: Sql) {
  const result: Record<string, number> = {};
  for (const table of TABLES) {
    const [row] = await client.unsafe<{ count: string }[]>(`SELECT COUNT(*)::text AS count FROM ${table}`);
    result[table] = Number(row.count);
  }
  return result;
}

function rowToRecord(row: Record<string, unknown>): SubmissionRecord {
  return {
    networkProfile: row.network_profile as 'mainnet' | 'devnet',
    signature: String(row.signature),
    userId: String(row.privy_user_id),
    walletAddress: String(row.wallet_address),
    kind: row.transaction_kind as 'deposit' | 'withdraw',
    blockhash: String(row.blockhash),
    lastValidBlockHeight: Number(row.last_valid_block_height),
    status: row.lifecycle_status as SubmissionStatus,
    submittedAt: row.submitted_at as Date,
    confirmedAt: row.confirmed_at as Date | null,
    reportedAt: row.reported_at as Date | null,
    attemptCount: Number(row.attempt_count),
    nextAttemptAt: row.next_attempt_at as Date,
    lastErrorCode: row.last_error_code as string | null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function signature(label: string) {
  return `${namespace}_${label}`;
}

async function insertSubmission(label: string, options: {
  profile?: 'mainnet' | 'devnet';
  kind?: 'deposit' | 'withdraw';
  status?: SubmissionStatus;
  claimedAt?: Date | null;
  attemptCount?: number;
  nextAttemptAt?: Date;
} = {}) {
  if (!sql) throw new Error('not connected');
  const value = signature(label);
  const blockhashValue = `${namespace}_blockhash`;
  await sql`
    INSERT INTO transaction_submissions (
      network_profile, signature, privy_user_id, wallet_address, transaction_kind,
      blockhash, last_valid_block_height, lifecycle_status, submitted_at,
      attempt_count, next_attempt_at, claim_token, claimed_at
    ) VALUES (
      ${options.profile ?? 'devnet'}, ${value}, ${userId}, ${wallet}, ${options.kind ?? 'deposit'},
      ${blockhashValue}, 100, ${options.status ?? 'submitted'}, ${baseNow},
      ${options.attemptCount ?? 0}, ${options.nextAttemptAt ?? baseNow},
      ${options.status === 'processing' ? randomUUID() : null}, ${options.claimedAt ?? null}
    )
  `;
  return value;
}

async function claim(profile: 'mainnet' | 'devnet', limit: number, token: string, now: Date) {
  if (!sql) throw new Error('not connected');
  const rows = await sql<Record<string, unknown>[]>`
    WITH candidates AS (
      SELECT network_profile, signature
      FROM transaction_submissions
      WHERE network_profile = ${profile}
        AND next_attempt_at <= ${now}
        AND (
          lifecycle_status IN ('submitted', 'pending', 'unknown', 'confirmed_unreported', 'report_pending')
          OR (lifecycle_status = 'processing' AND claimed_at < ${new Date(now.getTime() - 5 * 60_000)})
        )
      ORDER BY submitted_at, signature
      FOR UPDATE SKIP LOCKED
      LIMIT ${Math.max(1, Math.min(limit, 100))}
    )
    UPDATE transaction_submissions AS submission
    SET lifecycle_status = 'processing', claim_token = ${token}, claimed_at = ${now},
        attempt_count = attempt_count + 1, updated_at = ${now}
    FROM candidates
    WHERE submission.network_profile = candidates.network_profile
      AND submission.signature = candidates.signature
    RETURNING submission.*
  `;
  return rows.map(rowToRecord);
}

function runner(outcomes: Map<string, 'confirmed' | 'pending' | 'failed'>, now = baseNow) {
  if (!sql) throw new Error('not connected');
  const store: ReconciliationStore = {
    claimBatch: (profile, limit, token, at) => claim(profile, limit, token, at),
    updateClaimed: async (record, token, update) => {
      const rows = await sql!<{ signature: string }[]>`
        UPDATE transaction_submissions
        SET lifecycle_status = ${update.status}, next_attempt_at = ${update.nextAttemptAt},
            last_error_code = ${update.errorCode ?? null},
            confirmed_at = COALESCE(${update.confirmedAt ?? null}, confirmed_at),
            reported_at = COALESCE(${update.reportedAt ?? null}, reported_at),
            claim_token = NULL, claimed_at = NULL, updated_at = ${now}
        WHERE network_profile = ${record.networkProfile} AND signature = ${record.signature}
          AND claim_token = ${token}
        RETURNING signature
      `;
      return rows.length === 1;
    },
    reportDeposit: async (_reportedUserId, deposit) => {
      await sql!.begin(async (tx) => {
        const inserted = await tx<{ signature: string }[]>`
          INSERT INTO deposits (
            network_profile, signature, wallet_address, amount_base_units, block_time, streak_day, verified
          ) VALUES (
            ${deposit.networkProfile}, ${deposit.signature}, ${deposit.walletAddress},
            ${deposit.amountBaseUnits.toString()}, ${deposit.blockTime}, '2026-08-30', true
          )
          ON CONFLICT (network_profile, signature) DO NOTHING
          RETURNING signature
        `;
        if (inserted.length) await tx`
          INSERT INTO streaks (
            network_profile, wallet_address, current_streak, longest_streak, last_counted_day
          ) VALUES (${deposit.networkProfile}, ${deposit.walletAddress}, 1, 1, '2026-08-30')
          ON CONFLICT (network_profile, wallet_address) DO UPDATE
          SET current_streak = streaks.current_streak + 1,
              longest_streak = GREATEST(streaks.longest_streak, streaks.current_streak + 1)
        `;
      });
    },
  };
  const chain: ReconciliationChain = {
    assertCluster: async () => undefined,
    getSignatureStatus: async (value) => {
      if (outcomes.get(value) === 'confirmed') return { confirmationStatus: 'confirmed', err: null };
      if (outcomes.get(value) === 'failed') return { confirmationStatus: 'confirmed', err: { failed: true } };
      return null;
    },
    getBlockHeight: async () => 50,
    verifyDeposit: async (record) => ({
      signature: record.signature,
      walletAddress: record.walletAddress,
      amountBaseUnits: 1_000_000n,
      blockTime: now,
      networkProfile: record.networkProfile,
    }),
    verifyWithdraw: async () => true,
  };
  return (limit: number) => reconcileSubmissions({ profile: 'devnet', limit, store, chain, now });
}

function request(secret: string | undefined, query = '', method = 'POST') {
  return new Request(`http://localhost/api/internal/reconcile${query}`, {
    method,
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

async function cleanupRows() {
  if (!sql) return;
  await sql.begin(async (tx) => {
    await tx`DELETE FROM spins WHERE wallet_address = ${wallet}`;
    await tx`DELETE FROM deposits WHERE signature LIKE ${`${namespace}%`}`;
    await tx`DELETE FROM streaks WHERE wallet_address = ${wallet}`;
    await tx`DELETE FROM transaction_submissions WHERE signature LIKE ${`${namespace}%`}`;
  });
}

describe('scheduler invocation with PostgreSQL rehearsal', () => {
  beforeAll(async () => {
    if (!rehearsalUrl) throw new Error('BLOCKED: SOLSTREAK_REHEARSAL_DATABASE_URL is required');
    if (!rehearsalSecret) throw new Error('BLOCKED: SOLSTREAK_REHEARSAL_CRON_SECRET is required');
    if (!urlHasExpectedProjectRef(rehearsalUrl)) throw new Error('BLOCKED: rehearsal project ref mismatch');
    sql = postgres(rehearsalUrl, { max: 10, ssl: 'require', connect_timeout: 10 });
    const [identity] = await sql<{ database: string }[]>`SELECT current_database() AS database`;
    if (identity.database !== 'postgres') throw new Error('BLOCKED: current_database mismatch');
    for (const table of TABLES) {
      const [row] = await sql<{ present: boolean }[]>`
        SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS present
      `;
      if (!row.present) throw new Error(`BLOCKED: required table missing: ${table}`);
    }
    if (Object.values(await counts(sql)).some((value) => value !== 0)) {
      throw new Error('BLOCKED: application tables are not initially empty');
    }
    await sql`INSERT INTO users (privy_user_id, wallet_address) VALUES (${userId}, ${wallet})`;
  }, 20_000);

  afterEach(cleanupRows);

  afterAll(async () => {
    try {
      await cleanupRows();
      if (sql) {
        await sql`DELETE FROM users WHERE privy_user_id = ${userId}`;
        expect(await counts(sql)).toEqual({
          users: 0, deposits: 0, streaks: 0, spins: 0, transaction_submissions: 0,
        });
      }
    } finally {
      await sql?.end();
    }
  }, 20_000);

  it('enforces bearer authorization, method, batch cap, and zero summary', async () => {
    const seenLimits: number[] = [];
    const zero: ReconciliationSummary = {
      claimed: 0, pending: 0, reconciled: 0, reportPending: 0,
      failed: 0, expired: 0, unknown: 0, skipped: 0,
    };
    const handler = createSchedulerHandler({
      secret: rehearsalSecret,
      run: async (limit) => { seenLimits.push(limit); return zero; },
    });
    expect((await handler(request(undefined))).status).toBe(401);
    expect((await handler(request('wrong-secret'))).status).toBe(401);
    expect((await handler(request(rehearsalSecret, '', 'GET'))).status).toBe(405);
    const response = await handler(request(rehearsalSecret, '?limit=999'));
    expect(response.status).toBe(200);
    expect(seenLimits).toEqual([100]);
    expect(await response.json()).toEqual(zero);

    const databaseBacked = createSchedulerHandler({
      secret: rehearsalSecret,
      run: runner(new Map()),
    });
    expect(await (await databaseBacked(request(rehearsalSecret))).json()).toEqual(zero);
  });

  it('applies the requested batch to pending PostgreSQL records', async () => {
    const values = await Promise.all([
      insertSubmission('batch-a'),
      insertSubmission('batch-b'),
      insertSubmission('batch-c'),
    ]);
    const handler = createSchedulerHandler({
      secret: rehearsalSecret,
      run: runner(new Map(values.map((value) => [value, 'pending'] as const))),
    });
    const summary = await (await handler(request(rehearsalSecret, '?limit=2'))).json() as ReconciliationSummary;
    expect(summary).toMatchObject({ claimed: 2, pending: 2 });
    const [row] = await sql!<{ attempted: string }[]>`
      SELECT COUNT(*)::text AS attempted
      FROM transaction_submissions
      WHERE signature = ANY(${values}) AND attempt_count = 1
    `;
    expect(row.attempted).toBe('2');
  });

  it('claims the requested batch and prevents concurrent duplicate processing', async () => {
    const first = await insertSubmission('concurrent-a', { kind: 'withdraw' });
    const second = await insertSubmission('concurrent-b', { kind: 'withdraw' });
    const outcomes = new Map([[first, 'confirmed'], [second, 'confirmed']] as const);
    const handler = createSchedulerHandler({ secret: rehearsalSecret, run: runner(outcomes) });
    const responses = await Promise.all([
      handler(request(rehearsalSecret, '?limit=1')),
      handler(request(rehearsalSecret, '?limit=1')),
    ]);
    const summaries = await Promise.all(responses.map((response) => response.json() as Promise<ReconciliationSummary>));
    expect(summaries.reduce((sum, item) => sum + item.claimed, 0)).toBe(2);
    const rows = await sql!<{ signature: string; status: string; attempts: number }[]>`
      SELECT signature, lifecycle_status AS status, attempt_count AS attempts
      FROM transaction_submissions WHERE signature IN (${first}, ${second})
    `;
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === 'reconciled' && row.attempts === 1)).toBe(true);
  });

  it('protects active claims, reclaims stale claims, and applies retry backoff', async () => {
    const active = await insertSubmission('active', {
      status: 'processing', claimedAt: new Date(baseNow.getTime() - 60_000), attemptCount: 1,
    });
    const stale = await insertSubmission('stale', {
      status: 'processing', claimedAt: new Date(baseNow.getTime() - 6 * 60_000), attemptCount: 1,
    });
    const pending = await insertSubmission('pending');
    const handler = createSchedulerHandler({
      secret: rehearsalSecret,
      run: runner(new Map([[stale, 'confirmed'], [pending, 'pending']])),
    });
    const response = await handler(request(rehearsalSecret, '?limit=10'));
    expect(response.status).toBe(200);
    const rows = await sql!<{ signature: string; status: string; attempts: number; next_attempt_at: Date }[]>`
      SELECT signature, lifecycle_status AS status, attempt_count AS attempts, next_attempt_at
      FROM transaction_submissions WHERE signature IN (${active}, ${stale}, ${pending})
    `;
    const bySignature = new Map(rows.map((row) => [row.signature, row]));
    expect(bySignature.get(active)).toMatchObject({ status: 'processing', attempts: 1 });
    expect(bySignature.get(stale)).toMatchObject({ status: 'reconciled', attempts: 2 });
    expect(bySignature.get(pending)).toMatchObject({ status: 'pending', attempts: 1 });
    expect(bySignature.get(pending)!.next_attempt_at.getTime()).toBeGreaterThan(baseNow.getTime());
    expect((await handler(request(rehearsalSecret, '?limit=10')).then((item) => item.json())).claimed).toBe(0);
  });

  it('recovers a timed-out claimed record after the stale-claim lease', async () => {
    const value = await insertSubmission('timeout', { kind: 'withdraw' });
    const timeoutHandler = createSchedulerHandler({
      secret: rehearsalSecret,
      timeoutMs: 10,
      run: async (limit) => {
        await claim('devnet', limit, randomUUID(), baseNow);
        return new Promise<ReconciliationSummary>(() => undefined);
      },
    });
    expect((await timeoutHandler(request(rehearsalSecret))).status).toBe(503);
    let [row] = await sql!<{ status: string; attempts: number }[]>`
      SELECT lifecycle_status AS status, attempt_count AS attempts
      FROM transaction_submissions WHERE network_profile = 'devnet' AND signature = ${value}
    `;
    expect(row).toMatchObject({ status: 'processing', attempts: 1 });

    const recoveredAt = new Date(baseNow.getTime() + 6 * 60_000);
    const recovery = createSchedulerHandler({
      secret: rehearsalSecret,
      run: runner(new Map([[value, 'confirmed']]), recoveredAt),
    });
    expect((await recovery(request(rehearsalSecret))).status).toBe(200);
    [row] = await sql!<{ status: string; attempts: number }[]>`
      SELECT lifecycle_status AS status, attempt_count AS attempts
      FROM transaction_submissions WHERE network_profile = 'devnet' AND signature = ${value}
    `;
    expect(row).toMatchObject({ status: 'reconciled', attempts: 2 });
  });

  it('is idempotent, isolates Devnet from Mainnet, and redacts internal failures', async () => {
    const deposit = await insertSubmission('deposit');
    await sql!`
      INSERT INTO streaks (network_profile, wallet_address, current_streak, longest_streak)
      VALUES ('mainnet', ${wallet}, 7, 7)
    `;
    const handler = createSchedulerHandler({
      secret: rehearsalSecret,
      run: runner(new Map([[deposit, 'confirmed']])),
    });
    expect((await handler(request(rehearsalSecret))).status).toBe(200);
    expect((await handler(request(rehearsalSecret))).status).toBe(200);
    expect((await sql!<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM deposits
      WHERE network_profile = 'devnet' AND signature = ${deposit}
    `)[0].count).toBe('1');
    expect((await sql!<{ current_streak: number }[]>`
      SELECT current_streak FROM streaks
      WHERE network_profile = 'mainnet' AND wallet_address = ${wallet}
    `)[0].current_streak).toBe(7);

    const failing = createSchedulerHandler({
      secret: rehearsalSecret,
      run: async () => { throw new Error(`${rehearsalUrl} https://rpc.invalid/?token=${rehearsalSecret}`); },
    });
    const response = await failing(request(rehearsalSecret));
    const body = JSON.stringify(await response.json());
    expect(response.status).toBe(503);
    expect(body).toBe('{"error":"Reconciliation unavailable","code":"RECONCILIATION_UNAVAILABLE"}');
    expect(body).not.toContain(rehearsalSecret);
    expect(body).not.toContain('rpc.invalid');
    expect(body).not.toContain(PROJECT_REF);
  });
});
