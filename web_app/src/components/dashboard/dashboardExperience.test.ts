import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const dashboard = source('../../app/dashboard/page.tsx');
const hero = source('./DashboardHero.tsx');
const transactionCard = source('../TransactionCard.tsx');
const transactionHook = source('../../hooks/useVaultTransaction.ts');
const streakTracker = source('../StreakTracker.tsx');
const adminLab = source('../AdminLab.tsx');

describe('dashboard experience contract', () => {
  it('triggers the deposit celebration from a confirmed signature, not a transient render phase', () => {
    expect(transactionCard).toContain('registerConfirmedDeposit');
    expect(transactionCard).toContain('handleDepositSuccess');
    expect(transactionCard).not.toContain('previousDepositPhase');
    expect(transactionHook).toContain("next.phase === 'confirmed' && next.signature");
    expect(transactionHook).toContain('onSuccessRef.current?.(next.signature)');
  });

  it('uses existing SolStreak artwork for the dashboard hero', () => {
    for (const asset of ['Deposit.png', 'Coin.png', 'NormalStreak.png']) {
      expect(hero).toContain(asset);
    }
    for (const target of ['#transactions', '#wallet-readiness', '#lucky-wheel', '#badges']) {
      expect(hero).toContain(`href="${target}"`);
    }
  });

  it('keeps a clear dashboard hierarchy without duplicating transaction surfaces', () => {
    expect(dashboard.match(/<DashboardHero\b/g)).toHaveLength(1);
    expect(dashboard.match(/<TransactionCard\b/g)).toHaveLength(1);
    expect(dashboard.match(/<LuckyWheel\b/g)).toHaveLength(1);
    expect(dashboard.match(/<BadgeCollection\b/g)).toHaveLength(1);
    expect(dashboard.indexOf('<PortfolioStats')).toBeGreaterThan(dashboard.indexOf('<DashboardHero'));
    expect(dashboard.indexOf('<TransactionCard')).toBeGreaterThan(dashboard.indexOf('id="wallet-readiness"'));
  });

  it('surfaces read-only admin users near the top of an authenticated dashboard', () => {
    expect(dashboard.indexOf('<AdminLab')).toBeGreaterThan(dashboard.indexOf('<PortfolioStats'));
    expect(dashboard.indexOf('<AdminLab')).toBeLessThan(dashboard.indexOf('id="wallet-readiness"'));
    expect(adminLab).toContain('id="admin-lab"');
    expect(adminLab).toContain('Read only');
    expect(adminLab).toContain('fetch(`/api/admin/users${walletQuery}`');
    expect(adminLab).toContain('walletAddress: string');
    expect(adminLab).toContain('No Devnet user activity has been recorded yet.');
    expect(adminLab).toContain('The read-only user table is temporarily unavailable (HTTP ${usersResponse.status}).');
    for (const sourceTable of ['transaction_submissions', 'spins', 'badge_awards']) {
      expect(source('../../lib/store.ts')).toContain(`UNION SELECT privy_user_id, wallet_address FROM ${sourceTable}`);
    }
    expect(source('../../lib/store.ts')).toContain('SELECT privy_user_id, wallet_address FROM users');
    const store = source('../../lib/store.ts');
    const usersQuery = store.slice(
      store.indexOf('export async function devnetAdminUsers'),
      store.indexOf('export async function badgeProfileFor'),
    );
    expect(usersQuery).toContain('FROM users app_user');
    expect(usersQuery).toContain('ON deposit.wallet_address = app_user.wallet_address');
    expect(usersQuery).toContain('ON spin.wallet_address = app_user.wallet_address');
    expect(usersQuery).not.toContain('USING (wallet_address)');
    expect(usersQuery).not.toContain('WITH devnet_profiles');
    expect(usersQuery).toContain("activity.last_seen_at >= now() - interval '75 seconds'");
    expect(usersQuery).toContain('ORDER BY is_online DESC, last_active_at DESC');
  });

  it('presents streak progress as a tiered seven-day command center', () => {
    expect(streakTracker).toContain('Seven-day signal');
    expect(streakTracker).toContain('STREAK_TIERS');
    expect(streakTracker).toContain('streak-progress');
    expect(streakTracker).toContain('Last seven saving days');
    expect(streakTracker).toContain('/assets/images/SolStreak.png');
  });
});
