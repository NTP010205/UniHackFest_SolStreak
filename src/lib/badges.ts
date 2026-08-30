import type { Sql, TransactionSql } from 'postgres';

import type { SolanaNetworkProfileName } from './networkProfile';
import { BADGE_CATALOG_VERSION, badgeCodeFor, prizeLabel, type BadgeCode, type WheelPrizeId } from './wheel';

export type SpinSource = 'welcome_demo' | 'streak';

export interface BadgeSpinResult {
  spinId: string;
  result: WheelPrizeId;
  badgeCode: BadgeCode;
  label: string;
  isNewBadge: boolean;
  awardCount: number;
  source: SpinSource;
  remainingSpins: number;
  replayed: boolean;
}
export type PublicBadgeSpinResult = Omit<BadgeSpinResult, 'replayed'>;

export function publicBadgeSpinResult(result: BadgeSpinResult): PublicBadgeSpinResult {
  const { replayed: _internalReplayState, ...publicResult } = result;
  return publicResult;
}

interface AwardRow {
  spin_id: string;
  prize_id: WheelPrizeId;
  badge_code: BadgeCode;
  award_count: number;
  source: SpinSource;
  is_new_badge: boolean;
  remaining_spins_snapshot: number;
}

function result(row: AwardRow, remainingSpins: number, replayed = false): BadgeSpinResult {
  return {
    spinId: String(row.spin_id), result: row.prize_id, badgeCode: row.badge_code,
    label: prizeLabel(row.prize_id), isNewBadge: row.is_new_badge,
    awardCount: row.award_count, source: row.source, remainingSpins, replayed,
  };
}

export async function grantWelcomeEntitlement(
  sql: Sql | TransactionSql,
  userId: string,
  walletAddress: string,
  profile: SolanaNetworkProfileName,
) {
  if (profile !== 'devnet') return false;
  const rows = await sql<{ id: string }[]>`
    INSERT INTO spin_entitlements (
      network_profile, privy_user_id, wallet_address, source, source_reference
    ) VALUES (${profile}, ${userId}, ${walletAddress}, 'welcome_demo', 'once')
    ON CONFLICT DO NOTHING RETURNING id
  `;
  return rows.length === 1;
}

export async function consumeBadgeSpin(
  sql: Sql | TransactionSql,
  input: {
    profile: SolanaNetworkProfileName;
    userId: string;
    walletAddress: string;
    streakReference?: string;
    spinDay: string;
    requestKey: string;
    draw: () => WheelPrizeId;
    now: Date;
  },
): Promise<BadgeSpinResult | null> {
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(
    ${`${input.profile}:${input.userId}:${input.requestKey}`}, 0
  ))`;
  const [existing] = await sql<AwardRow[]>`
    SELECT spin.id AS spin_id, spin.prize_id, award.badge_code, award.is_new_badge,
      award.award_count_snapshot AS award_count, award.remaining_spins_snapshot,
      entitlement.source
    FROM spins spin
    JOIN badge_awards award ON award.spin_id = spin.id AND award.network_profile = spin.network_profile
    JOIN spin_entitlements entitlement ON entitlement.id = spin.entitlement_id
      AND entitlement.network_profile = spin.network_profile
    WHERE spin.network_profile = ${input.profile} AND spin.privy_user_id = ${input.userId}
      AND spin.request_key = ${input.requestKey}
  `;
  if (existing) {
    return result(existing, existing.remaining_spins_snapshot, true);
  }
  if (input.profile === 'devnet') {
    await grantWelcomeEntitlement(sql, input.userId, input.walletAddress, input.profile);
  }
  if (input.streakReference) {
    await sql`
      INSERT INTO spin_entitlements (
        network_profile, privy_user_id, wallet_address, source, source_reference
      ) VALUES (${input.profile}, ${input.userId}, ${input.walletAddress}, 'streak', ${input.streakReference})
      ON CONFLICT DO NOTHING
    `;
  }

  const [entitlement] = await sql<{ id: string; source: SpinSource }[]>`
    SELECT id, source FROM spin_entitlements
    WHERE network_profile = ${input.profile} AND privy_user_id = ${input.userId}
      AND status = 'available'
    ORDER BY CASE source WHEN 'welcome_demo' THEN 0 ELSE 1 END, created_at, id
    FOR UPDATE SKIP LOCKED LIMIT 1
  `;

  if (!entitlement) return null;

  const prize = input.draw();
  const badgeCode = badgeCodeFor(prize);
  const [spin] = await sql<{ id: string }[]>`
    INSERT INTO spins (
      network_profile, wallet_address, spin_day, prize_id, privy_user_id, source, entitlement_id, request_key
    ) VALUES (
      ${input.profile}, ${input.walletAddress}, ${input.spinDay},
      ${prize}, ${input.userId}, ${entitlement.source}, ${entitlement.id}, ${input.requestKey}
    ) RETURNING id
  `;
  const [badge] = await sql<{ award_count: number }[]>`
    INSERT INTO user_badges (
      network_profile, privy_user_id, wallet_address, badge_code,
      first_earned_at, last_earned_at, award_count
    ) VALUES (
      ${input.profile}, ${input.userId}, ${input.walletAddress}, ${badgeCode}, ${input.now}, ${input.now}, 1
    )
    ON CONFLICT (network_profile, privy_user_id, badge_code)
    DO UPDATE SET award_count = user_badges.award_count + 1,
      last_earned_at = EXCLUDED.last_earned_at
    RETURNING award_count
  `;
  await sql`
    UPDATE spin_entitlements SET status = 'consumed', consumed_at = ${input.now}
    WHERE id = ${entitlement.id} AND status = 'available'
  `;
  const [remaining] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM spin_entitlements
    WHERE network_profile = ${input.profile} AND privy_user_id = ${input.userId} AND status = 'available'
  `;
  await sql`
    INSERT INTO badge_awards (
      network_profile, privy_user_id, wallet_address, spin_id, entitlement_id,
      badge_code, catalog_version, is_new_badge, award_count_snapshot,
      remaining_spins_snapshot, awarded_at
    ) VALUES (
      ${input.profile}, ${input.userId}, ${input.walletAddress}, ${spin.id}, ${entitlement.id},
      ${badgeCode}, ${BADGE_CATALOG_VERSION}, ${badge.award_count === 1},
      ${badge.award_count}, ${remaining.count}, ${input.now}
    )
  `;
  return result({ spin_id: spin.id, prize_id: prize, badge_code: badgeCode,
    award_count: badge.award_count, source: entitlement.source,
    is_new_badge: badge.award_count === 1, remaining_spins_snapshot: remaining.count }, remaining.count);
}

export const BADGE_DISPLAY_LABELS: Record<BadgeCode, string> = {
  BRONZE: 'Bronze Badge', SILVER: 'Silver Badge', GOLD: 'Gold Badge',
  DIAMOND: 'Diamond Badge', JACKPOT: 'Jackpot Badge',
};
