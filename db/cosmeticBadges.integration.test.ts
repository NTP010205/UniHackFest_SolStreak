import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres, { type Sql } from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { consumeBadgeSpin, grantWelcomeEntitlement, publicBadgeSpinResult, type BadgeSpinResult } from '../src/lib/badges';

const rehearsalUrl = process.env.SOLSTREAK_REHEARSAL_DATABASE_URL;
const PROJECT_REF = 'ugijqdapnsuefnbldlpt';
const APP_TABLES = ['users', 'deposits', 'streaks', 'spins', 'transaction_submissions'] as const;
const BADGE_TABLES = ['spin_entitlements', 'badge_awards', 'user_badges'] as const;
const namespace = `badge_${Date.now()}_${randomUUID().slice(0, 8)}`;
const wallet = '11111111111111111111111111111111';
export const MIGRATION_POOL_MAX = 1;
export const INTEGRATION_POOL_MAX = 5;
let sql: Sql | undefined;
let requiredTablesReady = false;
const pendingOperations = new Set<Promise<unknown>>();

function track<T>(operation: Promise<T>) {
  pendingOperations.add(operation);
  void operation.then(
    () => pendingOperations.delete(operation),
    () => pendingOperations.delete(operation),
  );
  return operation;
}

function safeResultDiagnostic(result: BadgeSpinResult) {
  return {
    spinId: result.spinId,
    badgeCode: result.badgeCode,
    isNewBadge: result.isNewBadge,
    awardCount: result.awardCount,
    source: result.source,
    remainingSpins: result.remainingSpins,
  };
}

function validProject(raw: string) {
  try {
    const parsed = new URL(raw);
    return parsed.hostname.split(/[.-]/).includes(PROJECT_REF) ||
      decodeURIComponent(parsed.username).split(/[.:_-]/).includes(PROJECT_REF);
  } catch { return false; }
}

async function count(client: Sql, table: string) {
  return Number((await client.unsafe<{ count: string }[]>(`SELECT count(*)::text AS count FROM ${table}`))[0].count);
}

async function cleanup() {
  if (!sql || !requiredTablesReady) return;
  for (const table of [...APP_TABLES, ...BADGE_TABLES]) {
    const [relation] = await sql<{ present: boolean }[]>`
      SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS present
    `;
    if (!relation.present) return;
  }
  await sql.begin(async tx => {
    await tx`DELETE FROM badge_awards WHERE privy_user_id LIKE ${`${namespace}%`}`;
    await tx`DELETE FROM user_badges WHERE privy_user_id LIKE ${`${namespace}%`}`;
    await tx`DELETE FROM spins WHERE privy_user_id LIKE ${`${namespace}%`}`;
    await tx`DELETE FROM spin_entitlements WHERE privy_user_id LIKE ${`${namespace}%`}`;
    await tx`DELETE FROM users WHERE privy_user_id LIKE ${`${namespace}%`}`;
  });
}

describe('PostgreSQL cosmetic badge ledger', () => {
  beforeAll(async () => {
    if (!rehearsalUrl) throw new Error('BLOCKED: SOLSTREAK_REHEARSAL_DATABASE_URL is required');
    if (!validProject(rehearsalUrl)) throw new Error('BLOCKED: rehearsal project ref mismatch');
    const migrationSql = postgres(rehearsalUrl, {
      max: MIGRATION_POOL_MAX, ssl: 'require', connect_timeout: 10,
    });
    let migrationFailure: unknown;
    try {
      if ((await migrationSql<{ name: string }[]>`SELECT current_database() AS name`)[0].name !== 'postgres') {
        throw new Error('BLOCKED: current_database mismatch');
      }
      for (const table of APP_TABLES) {
        const present = (await migrationSql<{ present: boolean }[]>`
          SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS present
        `)[0].present;
        if (!present) throw new Error(`BLOCKED: required table missing: ${table}`);
        if (await count(migrationSql, table) !== 0) throw new Error(`BLOCKED: table is not initially empty: ${table}`);
      }
      const migrations = await Promise.all([
        '002_network_profiles.sql', '003_transaction_submissions.sql',
        '004_api_rate_limits.sql', '005_cosmetic_badges.sql',
      ].map(name => readFile(new URL(`./migrations/${name}`, import.meta.url), 'utf8')));
      for (const migration of migrations) await migrationSql.unsafe(migration).simple();
      await migrationSql.unsafe(migrations.at(-1)!).simple();
    } catch (error) {
      migrationFailure = error;
    } finally {
      try { await migrationSql.end(); }
      catch (closeError) { if (!migrationFailure) migrationFailure = closeError; }
    }
    if (migrationFailure) throw migrationFailure;

    sql = postgres(rehearsalUrl, {
      max: INTEGRATION_POOL_MAX, ssl: 'require', connect_timeout: 10,
    });
    if ((await sql<{ name: string }[]>`SELECT current_database() AS name`)[0].name !== 'postgres') {
      throw new Error('BLOCKED: integration current_database mismatch');
    }
    for (const table of BADGE_TABLES) {
      const present = (await sql<{ present: boolean }[]>`
        SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS present
      `)[0].present;
      if (!present) throw new Error(`BLOCKED: required table missing after migration: ${table}`);
      if (await count(sql, table) !== 0) throw new Error(`BLOCKED: badge table is not initially empty: ${table}`);
    }
    requiredTablesReady = true;
  }, 20_000);

  afterEach(async () => {
    await Promise.allSettled([...pendingOperations]);
    pendingOperations.clear();
  });

  afterAll(async () => {
    try {
      await cleanup();
      if (sql && requiredTablesReady) {
        for (const table of [...APP_TABLES, ...BADGE_TABLES]) expect(await count(sql, table)).toBe(0);
      }
    } finally { await sql?.end(); }
  }, 20_000);

  it('grants welcome once, isolates networks, and concurrently awards exactly once', async () => {
    const userId = `${namespace}_welcome`;
    await sql!`INSERT INTO users (privy_user_id, wallet_address) VALUES (${userId}, ${wallet})`;
    expect(await grantWelcomeEntitlement(sql!, userId, wallet, 'devnet')).toBe(true);
    expect(await grantWelcomeEntitlement(sql!, userId, wallet, 'devnet')).toBe(false);
    expect(await grantWelcomeEntitlement(sql!, userId, wallet, 'mainnet')).toBe(false);
    let drawCalls = 0;
    const run = () => sql!.begin(tx => consumeBadgeSpin(tx, {
      profile: 'devnet', userId, walletAddress: wallet, spinDay: '2026-08-30',
      requestKey: '123e4567-e89b-42d3-a456-426614174000',
      draw: () => { drawCalls += 1; return 'badge_bronze'; }, now: new Date('2026-08-30T12:00:00Z'),
    }));
    const requests = Array.from({ length: 12 }, () => track(run()));
    const results = await Promise.all(requests);
    const persistedResults = results.filter((result): result is BadgeSpinResult => result !== null);
    expect(persistedResults).toHaveLength(12);
    const [firstInternal] = persistedResults;
    const first = publicBadgeSpinResult(firstInternal);
    for (const retry of persistedResults) {
      expect(safeResultDiagnostic(retry)).toStrictEqual(safeResultDiagnostic(firstInternal));
      expect(publicBadgeSpinResult(retry)).toStrictEqual(first);
    }
    expect(persistedResults.filter(result => result.replayed)).toHaveLength(11);
    expect(persistedResults.filter(result => !result.replayed)).toHaveLength(1);
    expect(first).toMatchObject({ badgeCode: 'BRONZE', awardCount: 1, source: 'welcome_demo' });
    expect(drawCalls).toBe(1);
    expect((await sql!<{ count: number }[]>`
      SELECT count(*)::int AS count FROM spins WHERE privy_user_id = ${userId}
    `)[0].count).toBe(1);
    expect(await count(sql!, 'badge_awards')).toBe(1);
    expect(await count(sql!, 'deposits')).toBe(0);
    expect(await count(sql!, 'streaks')).toBe(0);
  });

  it('enforces Devnet-only welcome, profile linkage, and user-wallet ownership in PostgreSQL', async () => {
    const userA = `${namespace}_constraints_a`;
    const userB = `${namespace}_constraints_b`;
    const walletA = 'Vote111111111111111111111111111111111111111';
    const walletB = 'Stake11111111111111111111111111111111111111';
    await sql!`INSERT INTO users (privy_user_id, wallet_address) VALUES
      (${userA}, ${walletA}), (${userB}, ${walletB})`;

    await expect(sql!`INSERT INTO spin_entitlements
      (network_profile, privy_user_id, wallet_address, source, source_reference)
      VALUES ('mainnet', ${userA}, ${walletA}, 'welcome_demo', 'once')`).rejects.toMatchObject({ code: '23514' });
    await expect(sql!`INSERT INTO spin_entitlements
      (network_profile, privy_user_id, wallet_address, source, source_reference)
      VALUES ('devnet', ${userA}, ${walletB}, 'streak', 'wrong-owner')`).rejects.toMatchObject({ code: '23503' });

    const [mainnetEntitlement] = await sql!<{ id: string }[]>`INSERT INTO spin_entitlements
      (network_profile, privy_user_id, wallet_address, source, source_reference)
      VALUES ('mainnet', ${userA}, ${walletA}, 'streak', 'mainnet-day') RETURNING id`;
    const [devnetEntitlement] = await sql!<{ id: string }[]>`INSERT INTO spin_entitlements
      (network_profile, privy_user_id, wallet_address, source, source_reference)
      VALUES ('devnet', ${userA}, ${walletA}, 'streak', 'devnet-day') RETURNING id`;
    await expect(sql!`INSERT INTO spins
      (network_profile, wallet_address, spin_day, prize_id, privy_user_id, source, entitlement_id, request_key)
      VALUES ('devnet', ${walletA}, '2026-08-30', 'badge_bronze', ${userA}, 'streak',
        ${mainnetEntitlement.id}, 'cross-mainnet')`).rejects.toMatchObject({ code: '23503' });
    await expect(sql!`INSERT INTO spins
      (network_profile, wallet_address, spin_day, prize_id, privy_user_id, source, entitlement_id, request_key)
      VALUES ('mainnet', ${walletA}, '2026-08-30', 'badge_bronze', ${userA}, 'streak',
        ${devnetEntitlement.id}, 'cross-devnet')`).rejects.toMatchObject({ code: '23503' });
  });

  it('keeps history while a duplicate badge increments ownership exactly once', async () => {
    const userId = `${namespace}_duplicate`;
    const secondWallet = 'So11111111111111111111111111111111111111112';
    await sql!`INSERT INTO users (privy_user_id, wallet_address) VALUES (${userId}, ${secondWallet})`;
    for (const day of ['2026-08-29', '2026-08-30']) {
      await sql!`INSERT INTO spin_entitlements
        (network_profile, privy_user_id, wallet_address, source, source_reference)
        VALUES ('mainnet', ${userId}, ${secondWallet}, 'streak', ${day})`;
      await sql!.begin(tx => consumeBadgeSpin(tx, { profile: 'mainnet', userId, walletAddress: secondWallet,
        streakReference: day, spinDay: day,
        requestKey: day === '2026-08-29' ? '223e4567-e89b-42d3-a456-426614174000' : '223e4567-e89b-42d3-a456-426614174001',
        draw: () => 'badge_gold', now: new Date(`${day}T12:00:00Z`) }));
    }
    const [badge] = await sql!<{
      award_count: number; first_earned_at: Date; last_earned_at: Date;
    }[]>`SELECT award_count, first_earned_at, last_earned_at
      FROM user_badges WHERE privy_user_id = ${userId}`;
    expect(badge.award_count).toBe(2);
    expect(badge.first_earned_at).toEqual(new Date('2026-08-29T12:00:00Z'));
    expect(badge.last_earned_at).toEqual(new Date('2026-08-30T12:00:00Z'));
    expect((await sql!<{ count: number }[]>`
      SELECT count(*)::int AS count FROM user_badges WHERE privy_user_id = ${userId}
    `)[0].count).toBe(1);
    expect((await sql!<{ count: number }[]>`
      SELECT count(*)::int AS count FROM spins WHERE privy_user_id = ${userId}
    `)[0].count).toBe(2);
    expect((await sql!<{ count: number }[]>`SELECT count(*)::int AS count FROM badge_awards WHERE privy_user_id = ${userId}`)[0].count).toBe(2);
    expect(await sql!<{ award_count_snapshot: number }[]>`
      SELECT award_count_snapshot FROM badge_awards
      WHERE privy_user_id = ${userId} ORDER BY awarded_at, id
    `).toEqual([{ award_count_snapshot: 1 }, { award_count_snapshot: 2 }]);
  });

  it('rolls back spin, award and entitlement consumption on failure', async () => {
    const userId = `${namespace}_rollback`;
    const rollbackWallet = 'SysvarRent111111111111111111111111111111111';
    await sql!`INSERT INTO users (privy_user_id, wallet_address) VALUES (${userId}, ${rollbackWallet})`;
    await expect(sql!.begin(tx => consumeBadgeSpin(tx, { profile: 'devnet', userId,
      walletAddress: rollbackWallet, spinDay: '2026-08-30', draw: () => 'invalid' as never,
      requestKey: '323e4567-e89b-42d3-a456-426614174000',
      now: new Date('2026-08-30T12:00:00Z') }))).rejects.toThrow();
    expect((await sql!<{ status: string }[]>`SELECT status FROM spin_entitlements WHERE privy_user_id = ${userId}`)[0]?.status).toBeUndefined();
    expect((await sql!<{ count: number }[]>`SELECT count(*)::int AS count FROM spins WHERE privy_user_id = ${userId}`)[0].count).toBe(0);
  });
});
