import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('./migrations/006_devnet_admin_lab.sql', import.meta.url), 'utf8');
const baseline = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const runner = readFileSync(new URL('../scripts/migrate.mjs', import.meta.url), 'utf8');

describe('006 Devnet Admin Lab migration', () => {
  it('is transactional, rerunnable, and non-destructive to rows', () => {
    expect(sql).toMatch(/^BEGIN;/);
    expect(sql.trim().endsWith('COMMIT;')).toBe(true);
    expect(sql).not.toMatch(/\bDELETE\b|\bTRUNCATE\b/i);
    expect(sql).toContain("source IN ('welcome_demo', 'streak', 'admin_test')");
  });

  it('enforces admin_test as Devnet-only on entitlements and spins', () => {
    expect(sql).toContain('spin_entitlements_admin_test_devnet_check');
    expect(sql).toContain('spins_admin_test_devnet_check');
    expect(sql.match(/source <> 'admin_test' OR network_profile = 'devnet'/g)).toHaveLength(2);
  });

  it('catalog-verifies existing constraints and fails closed on conflicts', () => {
    expect(sql).toContain('contype = \'c\' AND convalidated');
    expect(sql).toContain('has an unexpected definition');
    expect(sql).toContain('admin_test source enforcement is incomplete');
  });

  it('catalog-discovers and removes only the obsolete three-column spins uniqueness', () => {
    expect(sql).toContain('spins_wallet_address_spin_day_key');
    expect(sql).toContain('spins_network_profile_wallet_day_key');
    expect(sql).toContain('spins_network_profile_wallet_address_spin_day_key');
    expect(sql).toContain("constraint_catalog.contype = 'u'");
    expect(sql).toContain('constraint_catalog.conrelid = spins_table');
    expect(sql).toContain('cardinality(constraint_catalog.conkey) = 3');
    expect(sql).toContain("'ALTER TABLE public.spins DROP CONSTRAINT %I'");
    expect(sql).toContain('spins wallet/day uniqueness remains after cleanup');
    expect(sql).not.toMatch(/DROP CONSTRAINT\s+(?:IF EXISTS\s+)?(?:spins_request_key|spins_entitlement_key|spins_profile_id_key|spins_admin_test_devnet_check)/i);
  });

  it('does not recreate wallet/day uniqueness in the fresh baseline schema', () => {
    expect(baseline).not.toMatch(/UNIQUE\s*\(\s*network_profile\s*,\s*wallet_address\s*,\s*spin_day\s*\)/i);
  });

  it('is applied after migration 005 by the runner', () => {
    expect(runner.indexOf('005_cosmetic_badges.sql')).toBeLessThan(runner.indexOf('006_devnet_admin_lab.sql'));
    expect(runner).toContain('await sql.unsafe(devnetAdminLab).simple()');
  });
});
