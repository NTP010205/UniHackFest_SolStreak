import type { Sql, TransactionSql } from 'postgres';

import { db } from './db';
import { calendarDayVN, lastCalendarDays, previousDay, streakDayOf, updateStreak } from './streak';
import type { VerifiedDeposit } from './onchain';
import { spinAdminWeighted, spinWeighted } from './wheel';
import { BADGE_DISPLAY_LABELS, consumeAdminBadgeSpin, consumeBadgeSpin, grantWelcomeEntitlement, type BadgeSpinResult } from './badges';
import { emitOperationalEvent, safeRequestId } from './observability';
import type { SolanaNetworkProfileName } from './networkProfile';
import type { SubmissionRecord, SubmissionStatus, TrackSubmissionInput } from './submissions';

export class WalletBindingError extends Error {}
export class SpinNotEligibleError extends Error {}
export class AlreadySpunError extends Error {}
export class SubmissionConflictError extends Error {}

interface SubmissionRow {
  network_profile: SolanaNetworkProfileName;
  signature: string;
  privy_user_id: string;
  wallet_address: string;
  transaction_kind: 'deposit' | 'withdraw';
  blockhash: string;
  last_valid_block_height: string;
  lifecycle_status: SubmissionStatus;
  submitted_at: Date;
  confirmed_at: Date | null;
  reported_at: Date | null;
  attempt_count: number;
  next_attempt_at: Date;
  last_error_code: string | null;
  created_at: Date;
  updated_at: Date;
  reclaimed_stale?: boolean;
}

function submission(row: SubmissionRow): SubmissionRecord {
  return {
    networkProfile: row.network_profile,
    signature: row.signature,
    userId: row.privy_user_id,
    walletAddress: row.wallet_address,
    kind: row.transaction_kind,
    blockhash: row.blockhash,
    lastValidBlockHeight: Number(row.last_valid_block_height),
    status: row.lifecycle_status,
    submittedAt: row.submitted_at,
    confirmedAt: row.confirmed_at,
    reportedAt: row.reported_at,
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at,
    lastErrorCode: row.last_error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reclaimedStale: row.reclaimed_stale ?? false,
  };
}

async function ensureUser(sql: Sql | TransactionSql, userId: string, walletAddress: string) {
  await sql`
    INSERT INTO users (privy_user_id, wallet_address)
    VALUES (${userId}, ${walletAddress})
    ON CONFLICT (privy_user_id) DO NOTHING
  `;
  const [user] = await sql<{ wallet_address: string }[]>`
    SELECT wallet_address FROM users WHERE privy_user_id = ${userId}
  `;
  if (!user || user.wallet_address !== walletAddress) {
    throw new WalletBindingError('This Privy user is already bound to another wallet');
  }
}

export async function trackSubmission(userId: string, input: TrackSubmissionInput): Promise<SubmissionRecord> {
  return db().begin(async (sql) => {
    await ensureUser(sql, userId, input.walletAddress);
    const rows = await sql<SubmissionRow[]>`
      INSERT INTO transaction_submissions (
        network_profile, signature, privy_user_id, wallet_address, transaction_kind,
        blockhash, last_valid_block_height, lifecycle_status
      ) VALUES (
        ${input.networkProfile}, ${input.signature}, ${userId}, ${input.walletAddress}, ${input.kind},
        ${input.blockhash}, ${input.lastValidBlockHeight}, 'submitted'
      )
      ON CONFLICT (network_profile, signature) DO NOTHING
      RETURNING *
    `;
    if (rows[0]) return submission(rows[0]);
    const [existing] = await sql<SubmissionRow[]>`
      SELECT * FROM transaction_submissions
      WHERE network_profile = ${input.networkProfile} AND signature = ${input.signature}
    `;
    if (!existing || existing.privy_user_id !== userId || existing.wallet_address !== input.walletAddress ||
        existing.transaction_kind !== input.kind || existing.blockhash !== input.blockhash ||
        Number(existing.last_valid_block_height) !== input.lastValidBlockHeight) {
      throw new SubmissionConflictError('Submission identity conflicts with an existing record');
    }
    return submission(existing);
  });
}

export async function unresolvedSubmissions(
  userId: string,
  walletAddress: string,
  networkProfile: SolanaNetworkProfileName,
): Promise<SubmissionRecord[]> {
  const sql = db();
  await ensureUser(sql, userId, walletAddress);
  const rows = await sql<SubmissionRow[]>`
    SELECT * FROM transaction_submissions
    WHERE privy_user_id = ${userId}
      AND wallet_address = ${walletAddress}
      AND network_profile = ${networkProfile}
      AND lifecycle_status IN ('submitted', 'pending', 'unknown', 'confirmed_unreported', 'report_pending', 'processing')
    ORDER BY submitted_at ASC
  `;
  return rows.map(submission);
}

export async function claimSubmissionBatch(
  networkProfile: SolanaNetworkProfileName,
  limit: number,
  claimToken: string,
  now = new Date(),
): Promise<SubmissionRecord[]> {
  const rows = await db()<SubmissionRow[]>`
    WITH candidates AS (
      SELECT network_profile, signature,
        (lifecycle_status = 'processing') AS reclaimed_stale
      FROM transaction_submissions
      WHERE network_profile = ${networkProfile}
        AND next_attempt_at <= ${now}
        AND (
          lifecycle_status IN ('submitted', 'pending', 'unknown', 'confirmed_unreported', 'report_pending')
          OR (lifecycle_status = 'processing' AND claimed_at < ${new Date(now.getTime() - 5 * 60_000)})
        )
      ORDER BY submitted_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${Math.max(1, Math.min(limit, 100))}
    )
    UPDATE transaction_submissions AS submission
    SET lifecycle_status = 'processing', claim_token = ${claimToken}, claimed_at = ${now},
        attempt_count = attempt_count + 1, updated_at = ${now}
    FROM candidates
    WHERE submission.network_profile = candidates.network_profile
      AND submission.signature = candidates.signature
    RETURNING submission.*, candidates.reclaimed_stale
  `;
  return rows.map(submission);
}

/**
 * Claims unresolved submissions for one authenticated identity only.
 * This powers the user-triggered status check and must never process another
 * wallet's records. Unlike the scheduler, an explicit check may retry a
 * non-processing record before its backoff expires; the API rate limiter
 * bounds those requests. Active processing claims remain protected.
 */
export async function claimUserSubmissionBatch(
  userId: string,
  walletAddress: string,
  kind: 'deposit' | 'withdraw',
  networkProfile: SolanaNetworkProfileName,
  limit: number,
  claimToken: string,
  now = new Date(),
): Promise<SubmissionRecord[]> {
  const sql = db();
  await ensureUser(sql, userId, walletAddress);
  const rows = await sql<SubmissionRow[]>`
    WITH candidates AS (
      SELECT network_profile, signature,
        (lifecycle_status = 'processing') AS reclaimed_stale
      FROM transaction_submissions
      WHERE privy_user_id = ${userId}
        AND wallet_address = ${walletAddress}
        AND transaction_kind = ${kind}
        AND network_profile = ${networkProfile}
        AND (
          lifecycle_status IN ('submitted', 'pending', 'unknown', 'confirmed_unreported', 'report_pending')
          OR (lifecycle_status = 'processing' AND claimed_at < ${new Date(now.getTime() - 5 * 60_000)})
        )
      ORDER BY submitted_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${Math.max(1, Math.min(limit, 5))}
    )
    UPDATE transaction_submissions AS submission
    SET lifecycle_status = 'processing', claim_token = ${claimToken}, claimed_at = ${now},
        attempt_count = attempt_count + 1, updated_at = ${now}
    FROM candidates
    WHERE submission.network_profile = candidates.network_profile
      AND submission.signature = candidates.signature
    RETURNING submission.*, candidates.reclaimed_stale
  `;
  return rows.map(submission);
}

export async function updateClaimedSubmission(
  record: Pick<SubmissionRecord, 'networkProfile' | 'signature'>,
  claimToken: string,
  update: {
    status: SubmissionStatus;
    nextAttemptAt: Date;
    errorCode?: string | null;
    confirmedAt?: Date | null;
    reportedAt?: Date | null;
  },
): Promise<boolean> {
  const rows = await db()<{ signature: string }[]>`
    UPDATE transaction_submissions
    SET lifecycle_status = ${update.status}, next_attempt_at = ${update.nextAttemptAt},
        last_error_code = ${update.errorCode ?? null},
        confirmed_at = COALESCE(${update.confirmedAt ?? null}, confirmed_at),
        reported_at = COALESCE(${update.reportedAt ?? null}, reported_at),
        claim_token = NULL, claimed_at = NULL, updated_at = now()
    WHERE network_profile = ${record.networkProfile} AND signature = ${record.signature}
      AND claim_token = ${claimToken}
    RETURNING signature
  `;
  return rows.length === 1;
}

function asDay(value: string | Date | null): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

export async function recordVerifiedDeposit(
  userId: string,
  deposit: VerifiedDeposit,
): Promise<{ inserted: boolean; currentStreak: number }> {
  return db().begin(async (sql) => {
    await ensureUser(sql, userId, deposit.walletAddress);
    const day = streakDayOf(deposit.blockTime);
    const inserted = await sql<{ signature: string }[]>`
      INSERT INTO deposits (
        network_profile, signature, wallet_address, amount_base_units, block_time, streak_day, verified
      ) VALUES (
        ${deposit.networkProfile}, ${deposit.signature}, ${deposit.walletAddress}, ${deposit.amountBaseUnits.toString()},
        ${deposit.blockTime}, ${day}, true
      )
      ON CONFLICT (network_profile, signature) DO NOTHING
      RETURNING signature
    `;

    if (inserted.length === 0) {
      const [existing] = await sql<{ current_streak: number }[]>`
        SELECT current_streak FROM streaks
        WHERE wallet_address = ${deposit.walletAddress} AND network_profile = ${deposit.networkProfile}
      `;
      return { inserted: false, currentStreak: existing?.current_streak ?? 0 };
    }

    await sql`
      INSERT INTO streaks (network_profile, wallet_address)
      VALUES (${deposit.networkProfile}, ${deposit.walletAddress})
      ON CONFLICT (network_profile, wallet_address) DO NOTHING
    `;
    const [row] = await sql<
      { current_streak: number; longest_streak: number; last_counted_day: string | Date | null }[]
    >`
      SELECT current_streak, longest_streak, last_counted_day
      FROM streaks
      WHERE wallet_address = ${deposit.walletAddress} AND network_profile = ${deposit.networkProfile}
      FOR UPDATE
    `;

    const next = updateStreak(
      {
        current: row.current_streak,
        longest: row.longest_streak,
        lastDay: asDay(row.last_counted_day),
      },
      day,
    );
    await sql`
      UPDATE streaks
      SET current_streak = ${next.current},
          longest_streak = ${next.longest},
          last_counted_day = ${next.lastDay}
      WHERE wallet_address = ${deposit.walletAddress} AND network_profile = ${deposit.networkProfile}
    `;
    return { inserted: true, currentStreak: next.current };
  });
}

export async function dashboardFor(userId: string, walletAddress: string, networkProfile: SolanaNetworkProfileName, now = new Date()) {
  const sql = db();
  await ensureUser(sql, userId, walletAddress);
  if (networkProfile === 'devnet' && await grantWelcomeEntitlement(sql, userId, walletAddress, networkProfile)) {
    emitOperationalEvent({ event: 'welcome_spin.granted', severity: 'info', requestId: safeRequestId(),
      routeKey: 'streak.status', networkProfile, status: 'granted', durationMs: 0 });
  }

  const [streak, totals, depositDays, spin, entitlement] = await Promise.all([
    sql<{ current_streak: number; longest_streak: number; last_counted_day: string | Date | null }[]>`
      SELECT current_streak, longest_streak, last_counted_day
      FROM streaks WHERE wallet_address = ${walletAddress} AND network_profile = ${networkProfile}
    `,
    sql<{ total: string }[]>`
      SELECT COALESCE(SUM(amount_base_units), 0)::text AS total
      FROM deposits WHERE wallet_address = ${walletAddress} AND network_profile = ${networkProfile} AND verified = true
    `,
    sql<{ streak_day: string | Date }[]>`
      SELECT DISTINCT streak_day FROM deposits
      WHERE wallet_address = ${walletAddress} AND network_profile = ${networkProfile} AND verified = true
      ORDER BY streak_day DESC LIMIT 7
    `,
    sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM spins
        WHERE wallet_address = ${walletAddress} AND network_profile = ${networkProfile}
          AND spin_day = ${calendarDayVN(now)} AND source = 'streak'
      ) AS exists
    `,
    sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM spin_entitlements
        WHERE privy_user_id = ${userId} AND network_profile = ${networkProfile} AND status = 'available'
      ) AS exists
    `,
  ]);

  const raw = streak[0];
  const lastDay = asDay(raw?.last_counted_day ?? null);
  const today = streakDayOf(now);
  const alive = !!lastDay && (lastDay === today || lastDay === previousDay(today));
  const currentStreak = alive ? raw?.current_streak ?? 0 : 0;
  const deposited = new Set(depositDays.map((row) => asDay(row.streak_day)));

  return {
    wallet: walletAddress,
    totalDepositedUsdc: Number(BigInt(totals[0]?.total ?? '0')) / 1_000_000,
    currentStreak,
    longestStreak: raw?.longest_streak ?? 0,
    last7Days: lastCalendarDays(7, now).map((date) => ({ date, deposited: deposited.has(date) })),
    canSpin: entitlement[0]?.exists || (currentStreak > 0 && !spin[0]?.exists),
  };
}

export async function recordSpin(
  userId: string,
  walletAddress: string,
  networkProfile: SolanaNetworkProfileName,
  requestKey: string,
  now = new Date(),
  draw = spinWeighted,
): Promise<BadgeSpinResult> {
  return db().begin(async (sql) => {
    await ensureUser(sql, userId, walletAddress);
    const [streak] = await sql<
      { current_streak: number; last_counted_day: string | Date | null }[]
    >`
      SELECT current_streak, last_counted_day FROM streaks
      WHERE wallet_address = ${walletAddress} AND network_profile = ${networkProfile}
      FOR UPDATE
    `;
    const lastDay = asDay(streak?.last_counted_day ?? null);
    const today = streakDayOf(now);
    const streakEligible = Boolean(streak && streak.current_streak > 0 &&
      (lastDay === today || lastDay === previousDay(today)));
    const streakReference = streakEligible ? calendarDayVN(now) : undefined;
    const awarded = await consumeBadgeSpin(sql, {
      profile: networkProfile, userId, walletAddress, streakReference,
      spinDay: calendarDayVN(now), requestKey, draw, now,
    });
    if (!awarded) throw new SpinNotEligibleError('Make a verified deposit to unlock the wheel');
    return awarded;
  });
}

export async function recordAdminSpin(
  userId: string,
  walletAddress: string,
  networkProfile: SolanaNetworkProfileName,
  requestKey: string,
  now = new Date(),
  draw = spinAdminWeighted,
): Promise<BadgeSpinResult> {
  if (networkProfile !== 'devnet') throw new Error('Admin test spins are Devnet-only');
  return db().begin(async (sql) => {
    await ensureUser(sql, userId, walletAddress);
    return consumeAdminBadgeSpin(sql, {
      profile: networkProfile, userId, walletAddress, spinDay: calendarDayVN(now), requestKey, draw, now,
    });
  });
}

export async function setAdminDemoStreak(
  userId: string,
  walletAddress: string,
  networkProfile: SolanaNetworkProfileName,
  currentStreak: number,
  now = new Date(),
) {
  if (networkProfile !== 'devnet') throw new Error('Admin streak adjustment is Devnet-only');
  return db().begin(async (sql) => {
    await ensureUser(sql, userId, walletAddress);
    const [row] = await sql<{ current_streak: number; longest_streak: number }[]>`
      INSERT INTO streaks (
        network_profile, wallet_address, current_streak, longest_streak, last_counted_day
      ) VALUES (
        'devnet', ${walletAddress}, ${currentStreak}, ${currentStreak},
        ${currentStreak > 0 ? streakDayOf(now) : null}
      )
      ON CONFLICT (network_profile, wallet_address)
      DO UPDATE SET current_streak = EXCLUDED.current_streak,
        longest_streak = GREATEST(streaks.longest_streak, EXCLUDED.current_streak),
        last_counted_day = EXCLUDED.last_counted_day
      RETURNING current_streak, longest_streak
    `;
    return { currentStreak: row.current_streak, longestStreak: row.longest_streak };
  });
}

export async function devnetAdminMetrics() {
  const sql = db();
  const [summary] = await sql<{
    total_users: number; devnet_profiles: number; active_profiles_7d: number;
    active_streaks: number; total_spins: number; total_badge_awards: number;
    unique_badge_ownerships: number; streak_1_6: number; streak_7_14: number;
    streak_15_29: number; streak_30_plus: number;
  }[]>`
    WITH devnet_profiles AS (
      SELECT privy_user_id, wallet_address FROM users
      UNION SELECT privy_user_id, wallet_address FROM spin_entitlements WHERE network_profile = 'devnet'
      UNION SELECT app_user.privy_user_id, deposit.wallet_address FROM deposits deposit
        JOIN users app_user USING (wallet_address) WHERE deposit.network_profile = 'devnet'
      UNION SELECT app_user.privy_user_id, streak.wallet_address FROM streaks streak
        JOIN users app_user USING (wallet_address) WHERE streak.network_profile = 'devnet'
      UNION SELECT privy_user_id, wallet_address FROM transaction_submissions
        WHERE network_profile = 'devnet'
      UNION SELECT privy_user_id, wallet_address FROM spins
        WHERE network_profile = 'devnet' AND privy_user_id IS NOT NULL
      UNION SELECT privy_user_id, wallet_address FROM badge_awards
        WHERE network_profile = 'devnet'
    ), active_profiles AS (
      SELECT DISTINCT app_user.privy_user_id FROM users app_user
      JOIN deposits deposit USING (wallet_address)
      WHERE deposit.network_profile = 'devnet' AND deposit.block_time >= now() - interval '7 days'
      UNION SELECT DISTINCT privy_user_id FROM spins
      WHERE network_profile = 'devnet' AND created_at >= now() - interval '7 days'
    )
    SELECT
      (SELECT count(DISTINCT privy_user_id)::int FROM devnet_profiles) AS total_users,
      (SELECT count(*)::int FROM devnet_profiles) AS devnet_profiles,
      (SELECT count(*)::int FROM active_profiles) AS active_profiles_7d,
      (SELECT count(*)::int FROM streaks WHERE network_profile = 'devnet' AND current_streak > 0) AS active_streaks,
      (SELECT count(*)::int FROM spins WHERE network_profile = 'devnet') AS total_spins,
      (SELECT count(*)::int FROM badge_awards WHERE network_profile = 'devnet') AS total_badge_awards,
      (SELECT count(*)::int FROM user_badges WHERE network_profile = 'devnet') AS unique_badge_ownerships,
      (SELECT count(*)::int FROM streaks WHERE network_profile = 'devnet' AND current_streak BETWEEN 1 AND 6) AS streak_1_6,
      (SELECT count(*)::int FROM streaks WHERE network_profile = 'devnet' AND current_streak BETWEEN 7 AND 14) AS streak_7_14,
      (SELECT count(*)::int FROM streaks WHERE network_profile = 'devnet' AND current_streak BETWEEN 15 AND 29) AS streak_15_29,
      (SELECT count(*)::int FROM streaks WHERE network_profile = 'devnet' AND current_streak >= 30) AS streak_30_plus
  `;
  return {
    totalUsers: summary.total_users,
    devnetProfiles: summary.devnet_profiles,
    activeProfiles7d: summary.active_profiles_7d,
    activeStreaks: summary.active_streaks,
    streakDistribution: {
      days1to6: summary.streak_1_6, days7to14: summary.streak_7_14,
      days15to29: summary.streak_15_29, days30Plus: summary.streak_30_plus,
    },
    totalSpins: summary.total_spins,
    totalBadgeAwards: summary.total_badge_awards,
    uniqueBadgeOwnerships: summary.unique_badge_ownerships,
  };
}

export interface DevnetAdminUserSummary {
  walletLabel: string;
  currentStreak: number;
  longestStreak: number;
  totalDepositedUsdc: number;
  lastActiveAt: Date;
  isOnline: boolean;
}

function abbreviatedWallet(address: string) {
  return address.length <= 14 ? address : `${address.slice(0, 6)}…${address.slice(-6)}`;
}

/** Read-only, Devnet-scoped rows for the Admin Lab. No email or Privy ID leaves the server. */
export async function devnetAdminUsers(): Promise<DevnetAdminUserSummary[]> {
  const rows = await db()<{
    wallet_address: string;
    current_streak: number;
    longest_streak: number;
    total_deposited_base_units: string;
    last_active_at: Date;
    is_online: boolean;
  }[]>`
    WITH deposit_stats AS (
      SELECT wallet_address, sum(amount_base_units)::text AS total_deposited_base_units,
        max(block_time) AS last_deposit_at
      FROM deposits WHERE network_profile = 'devnet' AND verified = true
      GROUP BY wallet_address
    ), spin_stats AS (
      SELECT wallet_address, max(created_at) AS last_spin_at
      FROM spins WHERE network_profile = 'devnet'
      GROUP BY wallet_address
    )
    SELECT app_user.wallet_address,
      coalesce(streak.current_streak, 0)::int AS current_streak,
      coalesce(streak.longest_streak, 0)::int AS longest_streak,
      coalesce(deposit.total_deposited_base_units, '0') AS total_deposited_base_units,
      greatest(app_user.created_at, activity.last_seen_at, deposit.last_deposit_at, spin.last_spin_at) AS last_active_at,
      coalesce(activity.last_seen_at >= now() - interval '75 seconds', false) AS is_online
    FROM users app_user
    LEFT JOIN user_activity activity
      ON activity.network_profile = 'devnet' AND activity.wallet_address = app_user.wallet_address
    LEFT JOIN streaks streak
      ON streak.network_profile = 'devnet' AND streak.wallet_address = app_user.wallet_address
    LEFT JOIN deposit_stats deposit
      ON deposit.wallet_address = app_user.wallet_address
    LEFT JOIN spin_stats spin
      ON spin.wallet_address = app_user.wallet_address
    ORDER BY is_online DESC, last_active_at DESC, current_streak DESC, app_user.wallet_address
    LIMIT 100
  `;
  return rows.map(row => ({
    walletLabel: abbreviatedWallet(row.wallet_address),
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    totalDepositedUsdc: Number(BigInt(row.total_deposited_base_units)) / 1_000_000,
    lastActiveAt: row.last_active_at,
    isOnline: row.is_online,
  }));
}

/** Records authenticated dashboard presence without exposing identity data to the client. */
export async function recordUserActivity(
  userId: string,
  walletAddress: string,
  networkProfile: SolanaNetworkProfileName,
  now = new Date(),
) {
  return db().begin(async (sql) => {
    await ensureUser(sql, userId, walletAddress);
    const [activity] = await sql<{ last_seen_at: Date }[]>`
      INSERT INTO user_activity (network_profile, wallet_address, last_seen_at)
      VALUES (${networkProfile}, ${walletAddress}, ${now})
      ON CONFLICT (network_profile, wallet_address)
      DO UPDATE SET last_seen_at = GREATEST(user_activity.last_seen_at, EXCLUDED.last_seen_at)
      RETURNING last_seen_at
    `;
    return activity.last_seen_at;
  });
}

export async function badgeProfileFor(
  userId: string,
  walletAddress: string,
  networkProfile: SolanaNetworkProfileName,
) {
  const sql = db();
  await ensureUser(sql, userId, walletAddress);
  if (networkProfile === 'devnet' && await grantWelcomeEntitlement(sql, userId, walletAddress, networkProfile)) {
    emitOperationalEvent({ event: 'welcome_spin.granted', severity: 'info', requestId: safeRequestId(),
      routeKey: 'profile.badges', networkProfile, status: 'granted', durationMs: 0 });
  }
  const [badges, history, entitlements] = await Promise.all([
    sql<{ badge_code: keyof typeof BADGE_DISPLAY_LABELS; award_count: number; first_earned_at: Date; last_earned_at: Date }[]>`
      SELECT badge_code, award_count, first_earned_at, last_earned_at FROM user_badges
      WHERE network_profile = ${networkProfile} AND privy_user_id = ${userId}
      ORDER BY first_earned_at, badge_code
    `,
    sql<{ spin_id: string; badge_code: keyof typeof BADGE_DISPLAY_LABELS; awarded_at: Date }[]>`
      SELECT spin_id, badge_code, awarded_at FROM badge_awards
      WHERE network_profile = ${networkProfile} AND privy_user_id = ${userId}
      ORDER BY awarded_at DESC, id DESC LIMIT 20
    `,
    sql<{ id: string; source: 'welcome_demo' | 'streak'; created_at: Date }[]>`
      SELECT id, source, created_at FROM spin_entitlements
      WHERE network_profile = ${networkProfile} AND privy_user_id = ${userId} AND status = 'available'
      ORDER BY created_at, id
    `,
  ]);
  return {
    networkProfile,
    badges: badges.map(row => ({ badgeCode: row.badge_code, displayLabel: BADGE_DISPLAY_LABELS[row.badge_code],
      awardCount: row.award_count, firstEarnedAt: row.first_earned_at, lastEarnedAt: row.last_earned_at })),
    recentHistory: history.map(row => ({ spinId: String(row.spin_id), badgeCode: row.badge_code,
      displayLabel: BADGE_DISPLAY_LABELS[row.badge_code], awardedAt: row.awarded_at })),
    availableSpinEntitlements: entitlements.map(row => ({ entitlementId: String(row.id), source: row.source,
      createdAt: row.created_at })),
  };
}
