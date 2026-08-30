import { randomUUID } from 'node:crypto';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Connection } from '@solana/web3.js';

import { reconcileSubmissions, type ReconciliationChain, type ReconciliationStore } from '../lib/reconciliation';
import { verifyDepositWithConnection, verifyWithdrawalWithConnection } from '../lib/onchain';
import { resolveNetworkProfile } from '../lib/networkProfile';
import type { SubmissionRecord, SubmissionStatus } from '../lib/submissions';

const rehearsalUrl = process.env.SOLSTREAK_REHEARSAL_DATABASE_URL;
const depositFixtureSignature = process.env.SOLSTREAK_DEVNET_DEPOSIT_SIGNATURE;
const withdrawFixtureSignature = process.env.SOLSTREAK_DEVNET_WITHDRAW_SIGNATURE;
const PROJECT_REF = 'ugijqdapnsuefnbldlpt';
const FIXTURE_WALLET = '6xcU1D3KHaxf1WCJUYFDcijypu4bhXC9Y4w7kmhs4tDp';
const DEVNET_PROFILE = resolveNetworkProfile({ NEXT_PUBLIC_SOLANA_NETWORK_PROFILE: 'devnet' }).profile;
const TABLES = ['users', 'deposits', 'streaks', 'spins', 'transaction_submissions'] as const;
const namespace = `rehearsal_${Date.now()}_${randomUUID().slice(0, 8)}`;
const wallet = `${namespace}_wallet`;
const userId = `${namespace}_user`;
const now = new Date('2026-08-29T00:00:00Z');
let sql: Sql | undefined;

function urlHasExpectedProjectRef(raw: string) {
  try {
    const parsed = new URL(raw);
    return parsed.hostname.split(/[.-]/).includes(PROJECT_REF) ||
      decodeURIComponent(parsed.username).split(/[.:_-]/).includes(PROJECT_REF);
  } catch { return false; }
}

function signature(label: string) { return `${namespace}_${label}`; }

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
    networkProfile: row.network_profile as 'mainnet' | 'devnet', signature: String(row.signature),
    userId: String(row.privy_user_id), walletAddress: String(row.wallet_address),
    kind: row.transaction_kind as 'deposit' | 'withdraw', blockhash: String(row.blockhash),
    lastValidBlockHeight: Number(row.last_valid_block_height), status: row.lifecycle_status as SubmissionStatus,
    submittedAt: row.submitted_at as Date, confirmedAt: row.confirmed_at as Date | null,
    reportedAt: row.reported_at as Date | null, attemptCount: Number(row.attempt_count),
    nextAttemptAt: row.next_attempt_at as Date, lastErrorCode: row.last_error_code as string | null,
    createdAt: row.created_at as Date, updatedAt: row.updated_at as Date,
  };
}

async function insertSubmission(client: Sql, label: string, options: {
  profile?: 'mainnet' | 'devnet'; kind?: 'deposit' | 'withdraw'; status?: SubmissionStatus;
  lastValidBlockHeight?: number;
} = {}) {
  const sig = signature(label);
  await client`
    INSERT INTO transaction_submissions (
      network_profile, signature, privy_user_id, wallet_address, transaction_kind,
      blockhash, last_valid_block_height, lifecycle_status, submitted_at, next_attempt_at
    ) VALUES (
      ${options.profile ?? 'devnet'}, ${sig}, ${userId}, ${wallet}, ${options.kind ?? 'deposit'},
      ${`${namespace}_blockhash`}, ${options.lastValidBlockHeight ?? 100}, ${options.status ?? 'submitted'},
      ${now}, ${now}
    )
  `;
  return sig;
}

async function claim(client: Sql, profile: 'mainnet' | 'devnet', limit: number, token: string, at = now) {
  const rows = await client<Record<string, unknown>[]>`
    WITH candidates AS (
      SELECT network_profile, signature FROM transaction_submissions
      WHERE network_profile = ${profile} AND next_attempt_at <= ${at}
        AND (lifecycle_status IN ('submitted', 'pending', 'unknown', 'confirmed_unreported', 'report_pending')
          OR (lifecycle_status = 'processing' AND claimed_at < ${new Date(at.getTime() - 5 * 60_000)}))
      ORDER BY submitted_at, signature FOR UPDATE SKIP LOCKED LIMIT ${limit}
    )
    UPDATE transaction_submissions AS submission
    SET lifecycle_status = 'processing', claim_token = ${token}, claimed_at = ${at},
        attempt_count = attempt_count + 1, updated_at = ${at}
    FROM candidates WHERE submission.network_profile = candidates.network_profile
      AND submission.signature = candidates.signature
    RETURNING submission.*
  `;
  return rows.map(rowToRecord);
}

async function cleanup() {
  if (!sql) return;
  await sql.begin(async tx => {
    await tx`DELETE FROM spins WHERE wallet_address = ${wallet}`;
    await tx`DELETE FROM deposits WHERE signature LIKE ${`${namespace}%`}`;
    await tx`DELETE FROM streaks WHERE wallet_address = ${wallet}`;
    await tx`DELETE FROM transaction_submissions WHERE signature LIKE ${`${namespace}%`}`;
    await tx`DELETE FROM users WHERE privy_user_id = ${userId}`;
  });
}

describe('PostgreSQL + Devnet RPC reconciliation rehearsal', () => {
  beforeAll(async () => {
    if (!rehearsalUrl) throw new Error('BLOCKED: SOLSTREAK_REHEARSAL_DATABASE_URL is required');
    if (!urlHasExpectedProjectRef(rehearsalUrl)) throw new Error('BLOCKED: rehearsal project ref mismatch');
    sql = postgres(rehearsalUrl, { max: 8, ssl: 'require', connect_timeout: 10 });
    const [identity] = await sql<{ database: string }[]>`SELECT current_database() AS database`;
    if (identity.database !== 'postgres') throw new Error('BLOCKED: current_database mismatch');
    for (const table of TABLES) {
      const [row] = await sql<{ present: boolean }[]>`SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS present`;
      if (!row.present) throw new Error(`BLOCKED: required table missing: ${table}`);
    }
    const initial = await counts(sql);
    if (Object.values(initial).some(value => value !== 0)) throw new Error('BLOCKED: application tables are not initially empty');
    await sql`INSERT INTO users (privy_user_id, wallet_address) VALUES (${userId}, ${wallet})`;
  }, 20_000);

  afterAll(async () => {
    try {
      await cleanup();
      if (sql) expect(await counts(sql)).toEqual({ users: 0, deposits: 0, streaks: 0, spins: 0, transaction_submissions: 0 });
    } finally { await sql?.end(); }
  }, 20_000);

  it('enforces composite identity, namespace separation, foreign keys, checks, and required fields', async () => {
    if (!sql) throw new Error('not connected');
    const shared = await insertSubmission(sql, 'shared', { profile: 'devnet' });
    await sql`
      INSERT INTO transaction_submissions (
        network_profile, signature, privy_user_id, wallet_address, transaction_kind,
        blockhash, last_valid_block_height, lifecycle_status
      ) VALUES ('mainnet', ${shared}, ${userId}, ${wallet}, 'deposit', 'blockhash', 1, 'submitted')
    `;
    await expect(sql`
      INSERT INTO transaction_submissions (
        network_profile, signature, privy_user_id, wallet_address, transaction_kind,
        blockhash, last_valid_block_height, lifecycle_status
      ) VALUES ('devnet', ${shared}, ${userId}, ${wallet}, 'deposit', 'blockhash', 1, 'submitted')
    `).rejects.toMatchObject({ code: '23505' });
    await expect(sql`
      INSERT INTO transaction_submissions (
        network_profile, signature, privy_user_id, wallet_address, transaction_kind,
        blockhash, last_valid_block_height, lifecycle_status
      ) VALUES ('devnet', ${signature('fk')}, 'missing-user', 'missing-wallet', 'deposit', 'blockhash', 1, 'submitted')
    `).rejects.toMatchObject({ code: '23503' });
    for (const [label, profile, kind, status] of [
      ['profile', 'testnet', 'deposit', 'submitted'], ['kind', 'devnet', 'swap', 'submitted'],
      ['status', 'devnet', 'deposit', 'client_confirmed'],
    ] as const) {
      await expect(sql`
        INSERT INTO transaction_submissions (
          network_profile, signature, privy_user_id, wallet_address, transaction_kind,
          blockhash, last_valid_block_height, lifecycle_status
        ) VALUES (${profile}, ${signature(label)}, ${userId}, ${wallet}, ${kind}, 'blockhash', 1, ${status})
      `).rejects.toMatchObject({ code: '23514' });
    }
    await expect(sql`
      INSERT INTO transaction_submissions (
        network_profile, signature, privy_user_id, wallet_address, transaction_kind,
        blockhash, last_valid_block_height, lifecycle_status, submitted_at
      ) VALUES ('devnet', ${signature('null')}, ${userId}, ${wallet}, 'deposit', 'blockhash', 1, 'submitted', NULL)
    `).rejects.toMatchObject({ code: '23502' });
  });

  it('uses SKIP LOCKED for competing workers, protects active claims, and reclaims stale claims', async () => {
    if (!sql) throw new Error('not connected');
    await insertSubmission(sql, 'worker-a');
    await insertSubmission(sql, 'worker-b');
    const [first, second] = await Promise.all([claim(sql, 'devnet', 1, randomUUID()), claim(sql, 'devnet', 1, randomUUID())]);
    expect(first).toHaveLength(1); expect(second).toHaveLength(1);
    expect(first[0].signature).not.toBe(second[0].signature);
    expect(first[0].attemptCount).toBe(1); expect(second[0].attemptCount).toBe(1);
    expect(await claim(sql, 'devnet', 10, randomUUID())).not.toEqual(expect.arrayContaining(first));

    await sql`
      UPDATE transaction_submissions SET claimed_at = ${new Date(now.getTime() - 6 * 60_000)}, next_attempt_at = ${now}
      WHERE network_profile = 'devnet' AND signature = ${first[0].signature}
    `;
    const reclaimed = await claim(sql, 'devnet', 10, randomUUID());
    expect(reclaimed.find(item => item.signature === first[0].signature)?.attemptCount).toBe(2);
  });

  it('rolls back deposit, streak, and submission changes together after a mid-transaction failure', async () => {
    if (!sql) throw new Error('not connected');
    const sig = await insertSubmission(sql, 'rollback');
    await expect(sql.begin(async tx => {
      await tx`
        INSERT INTO deposits (network_profile, signature, wallet_address, amount_base_units, block_time, streak_day, verified)
        VALUES ('devnet', ${sig}, ${wallet}, 1000000, ${now}, '2026-08-29', true)
      `;
      await tx`INSERT INTO streaks (network_profile, wallet_address, current_streak, longest_streak) VALUES ('devnet', ${wallet}, 1, 1)`;
      await tx`UPDATE transaction_submissions SET lifecycle_status = 'reconciled' WHERE network_profile = 'devnet' AND signature = ${sig}`;
      throw new Error('intentional rollback');
    })).rejects.toThrow('intentional rollback');
    const [state] = await sql<{ status: string }[]>`
      SELECT lifecycle_status AS status FROM transaction_submissions WHERE network_profile = 'devnet' AND signature = ${sig}
    `;
    expect(state.status).toBe('submitted');
    expect((await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM deposits WHERE signature = ${sig}`)[0].count).toBe('0');
    expect((await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM streaks WHERE wallet_address = ${wallet}`)[0].count).toBe('0');
  });

  it('runs reconciliation idempotently against PostgreSQL without cross-profile effects', async () => {
    if (!sql) throw new Error('not connected');
    const confirmed = await insertSubmission(sql, 'confirmed');
    const withdrawal = await insertSubmission(sql, 'withdraw', { kind: 'withdraw' });
    const failed = await insertSubmission(sql, 'failed');
    const expired = await insertSubmission(sql, 'expired', { lastValidBlockHeight: 10 });
    const pending = await insertSubmission(sql, 'pending');
    const unknown = await insertSubmission(sql, 'unknown');
    await sql`INSERT INTO streaks (network_profile, wallet_address, current_streak, longest_streak) VALUES ('mainnet', ${wallet}, 7, 7)`;

    const statuses = new Map<string, 'confirmed' | 'failed' | 'pending' | 'unknown'>([
      [confirmed, 'confirmed'], [withdrawal, 'confirmed'], [failed, 'failed'],
      [expired, 'pending'], [pending, 'pending'], [unknown, 'unknown'],
    ]);
    const store: ReconciliationStore = {
      claimBatch: (profile, limit, token, at) => claim(sql!, profile, limit, token, at),
      updateClaimed: async (record, token, update) => {
        const rows = await sql!<{ signature: string }[]>`
          UPDATE transaction_submissions SET lifecycle_status = ${update.status}, next_attempt_at = ${update.nextAttemptAt},
            last_error_code = ${update.errorCode ?? null}, confirmed_at = ${update.confirmedAt ?? null},
            reported_at = ${update.reportedAt ?? null}, claim_token = NULL, claimed_at = NULL, updated_at = ${now}
          WHERE network_profile = ${record.networkProfile} AND signature = ${record.signature} AND claim_token = ${token}
          RETURNING signature
        `;
        return rows.length === 1;
      },
      reportDeposit: async (_uid, deposit) => {
        await sql!.begin(async tx => {
          const inserted = await tx<{ signature: string }[]>`
            INSERT INTO deposits (network_profile, signature, wallet_address, amount_base_units, block_time, streak_day, verified)
            VALUES (${deposit.networkProfile}, ${deposit.signature}, ${deposit.walletAddress}, ${deposit.amountBaseUnits.toString()}, ${deposit.blockTime}, '2026-08-29', true)
            ON CONFLICT (network_profile, signature) DO NOTHING RETURNING signature
          `;
          if (inserted.length) await tx`
            INSERT INTO streaks (network_profile, wallet_address, current_streak, longest_streak, last_counted_day)
            VALUES (${deposit.networkProfile}, ${deposit.walletAddress}, 1, 1, '2026-08-29')
            ON CONFLICT (network_profile, wallet_address) DO UPDATE SET
              current_streak = streaks.current_streak + 1,
              longest_streak = GREATEST(streaks.longest_streak, streaks.current_streak + 1)
          `;
        });
      },
    };
    const chain: ReconciliationChain = {
      assertCluster: vi.fn().mockResolvedValue(undefined),
      getSignatureStatus: async sig => {
        if (statuses.get(sig) === 'unknown') throw new Error('sanitized RPC failure');
        if (statuses.get(sig) === 'failed') return { confirmationStatus: 'confirmed', err: { failed: true } };
        if (statuses.get(sig) === 'confirmed') return { confirmationStatus: 'confirmed', err: null };
        return null;
      },
      getBlockHeight: async () => 50,
      verifyDeposit: async record => ({ signature: record.signature, walletAddress: wallet, amountBaseUnits: 1_000_000n, blockTime: now, networkProfile: 'devnet' }),
      verifyWithdraw: async () => true,
    };
    await reconcileSubmissions({ profile: 'devnet', limit: 100, store, chain, now });
    const lifecycle = await sql<{ signature: string; status: string }[]>`
      SELECT signature, lifecycle_status AS status FROM transaction_submissions WHERE signature LIKE ${`${namespace}%`}
    `;
    const bySignature = new Map(lifecycle.map(row => [row.signature, row.status]));
    expect(bySignature.get(confirmed)).toBe('reconciled');
    expect(bySignature.get(withdrawal)).toBe('reconciled');
    expect(bySignature.get(failed)).toBe('failed');
    expect(bySignature.get(expired)).toBe('expired');
    expect(bySignature.get(pending)).toBe('pending');
    expect(bySignature.get(unknown)).toBe('unknown');
    const [pendingRetry] = await sql<{ attempt_count: number; next_attempt_at: Date }[]>`
      SELECT attempt_count, next_attempt_at FROM transaction_submissions
      WHERE network_profile = 'devnet' AND signature = ${pending}
    `;
    expect(pendingRetry.attempt_count).toBe(1);
    expect(pendingRetry.next_attempt_at.getTime()).toBeGreaterThan(now.getTime());
    expect((await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM deposits WHERE network_profile = 'devnet' AND signature = ${confirmed}`)[0].count).toBe('1');
    expect((await sql<{ current_streak: number }[]>`SELECT current_streak FROM streaks WHERE network_profile = 'devnet' AND wallet_address = ${wallet}`)[0].current_streak).toBe(1);
    expect((await sql<{ current_streak: number }[]>`SELECT current_streak FROM streaks WHERE network_profile = 'mainnet' AND wallet_address = ${wallet}`)[0].current_streak).toBe(7);

    await sql`UPDATE transaction_submissions SET lifecycle_status = 'report_pending', next_attempt_at = ${now} WHERE network_profile = 'devnet' AND signature = ${confirmed}`;
    await reconcileSubmissions({ profile: 'devnet', limit: 100, store, chain, now: new Date(now.getTime() + 1) });
    expect((await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM deposits WHERE network_profile = 'devnet' AND signature = ${confirmed}`)[0].count).toBe('1');
    expect((await sql<{ current_streak: number }[]>`SELECT current_streak FROM streaks WHERE network_profile = 'devnet' AND wallet_address = ${wallet}`)[0].current_streak).toBe(1);
  });

  it('verifies the public Devnet genesis read-only', async () => {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    expect(await connection.getGenesisHash()).toBe('EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG');
  }, 20_000);

  it.skipIf(!depositFixtureSignature || !withdrawFixtureSignature)(
    'semantically verifies optional confirmed Devnet deposit and withdraw fixtures',
    async () => {
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      expect(await connection.getGenesisHash()).toBe(DEVNET_PROFILE.genesisHash);

      const deposit = await verifyDepositWithConnection(
        connection, depositFixtureSignature!, FIXTURE_WALLET, DEVNET_PROFILE,
      );
      expect(deposit).toMatchObject({
        signature: depositFixtureSignature,
        walletAddress: FIXTURE_WALLET,
        networkProfile: 'devnet',
      });
      expect(deposit?.amountBaseUnits).toBeGreaterThan(0n);
      expect(await verifyWithdrawalWithConnection(
        connection, depositFixtureSignature!, FIXTURE_WALLET, DEVNET_PROFILE,
      )).toBeNull();

      const withdrawal = await verifyWithdrawalWithConnection(
        connection, withdrawFixtureSignature!, FIXTURE_WALLET, DEVNET_PROFILE,
      );
      expect(withdrawal).toMatchObject({
        signature: withdrawFixtureSignature,
        walletAddress: FIXTURE_WALLET,
        networkProfile: 'devnet',
      });
      expect(withdrawal?.amountBaseUnits).toBeGreaterThan(0n);
      expect(await verifyDepositWithConnection(
        connection, withdrawFixtureSignature!, FIXTURE_WALLET, DEVNET_PROFILE,
      )).toBeNull();
    },
    20_000,
  );
});
