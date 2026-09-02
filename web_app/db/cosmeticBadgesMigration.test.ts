import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('./migrations/005_cosmetic_badges.sql', import.meta.url), 'utf8');

describe('005 cosmetic badge ledger migration', () => {
  it('supports fresh and repeated application without destructive data operations', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS spin_entitlements');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS badge_awards');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS user_badges');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS spin_entitlements_welcome_user_key');
    expect(sql).not.toMatch(/\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
  });

  it('enforces welcome, award, badge catalog and positive count invariants', () => {
    expect(sql).toContain("WHERE source = 'welcome_demo'");
    expect(sql).toContain('CONSTRAINT badge_awards_profile_spin_key UNIQUE (network_profile, spin_id)');
    expect(sql).toContain("badge_code IN ('BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'JACKPOT')");
    expect(sql).toContain('award_count INTEGER NOT NULL CHECK (award_count > 0)');
    expect(sql).toContain('award_count_snapshot INTEGER NOT NULL CHECK (award_count_snapshot > 0)');
    expect(sql).toContain('remaining_spins_snapshot INTEGER NOT NULL CHECK (remaining_spins_snapshot >= 0)');
    expect(sql).toContain("source <> 'welcome_demo' OR network_profile = 'devnet'");
    expect(sql).toContain('CONSTRAINT spins_profile_entitlement_fk');
    expect(sql).toContain('FOREIGN KEY (network_profile, entitlement_id)');
    expect(sql).toContain('REFERENCES spin_entitlements(network_profile, id)');
  });

  it('catalog-verifies identity and network constraints on rerun', () => {
    expect(sql).toContain('users_identity_pair_key');
    expect(sql).toContain('spin_entitlements_identity_fk');
    expect(sql).toContain('spins_identity_fk');
    expect(sql).toContain('badge_awards_identity_fk');
    expect(sql).toContain('user_badges_identity_fk');
    expect(sql).toContain("contype = 'f' AND convalidated");
    expect(sql).toContain('legacy Privy user and wallet ownership mismatch');
    expect(sql).toContain('legacy spin and entitlement network profile mismatch');
  });

  it('fails closed when named uniqueness objects have an unexpected definition', () => {
    expect(sql).toContain('welcome entitlement uniqueness has an unexpected definition');
    expect(sql).toContain('badge award spin uniqueness has an unexpected definition');
    expect(sql).toContain('welcome Devnet-only constraint has an unexpected definition');
    expect(sql).toContain('spin profile entitlement FK has an unexpected definition');
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
    expect(sql).not.toMatch(/DROP CONSTRAINT IF EXISTS (spin_entitlements_welcome_devnet_check|spins_profile_entitlement_fk|spin_entitlements_identity_fk|spins_identity_fk|badge_awards_identity_fk|user_badges_identity_fk)/);
  });

  it('backfills legacy spins before enforcing non-null and composite constraints', () => {
    expect(sql.indexOf('INSERT INTO spin_entitlements')).toBeLessThan(sql.indexOf('ALTER TABLE spins ALTER COLUMN entitlement_id SET NOT NULL'));
    expect(sql.indexOf("UPDATE spins SET request_key = 'legacy:' || id::text")).toBeLessThan(sql.indexOf('ALTER TABLE spins ALTER COLUMN request_key SET NOT NULL'));
    expect(sql).toContain('ON CONFLICT (network_profile, privy_user_id, source, source_reference) DO NOTHING');
    expect(sql).toContain('BEGIN;');
    expect(sql.trim().endsWith('COMMIT;')).toBe(true);
  });

  it('contains no financial ledger or redemption columns', () => {
    expect(sql).not.toMatch(/\b(points|price|redeemable|redemption|monetary_value)\b/i);
  });
});
