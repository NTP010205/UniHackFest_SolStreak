import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('network profile data migration', () => {
  it('backfills existing rows to mainnet and scopes signatures and streaks by profile', async () => {
    const sql = await readFile(new URL('./migrations/002_network_profiles.sql', import.meta.url), 'utf8');
    expect(sql).toContain("UPDATE deposits SET network_profile = 'mainnet'");
    expect(sql).toContain("UPDATE streaks SET network_profile = 'mainnet'");
    expect(sql).toContain('PRIMARY KEY (network_profile, signature)');
    expect(sql).toContain('PRIMARY KEY (network_profile, wallet_address)');
    expect(sql).toContain('UNIQUE (network_profile, wallet_address, spin_day)');
  });

  it('creates the required spin uniqueness in a fresh database state', async () => {
    const sql = await readFile(new URL('./migrations/002_network_profiles.sql', import.meta.url), 'utf8');
    expect(sql).toContain('ADD CONSTRAINT spins_network_profile_wallet_day_key');
    expect(sql).toContain('UNIQUE (network_profile, wallet_address, spin_day)');
  });

  it('is a no-op on rerun when the named unique constraint is correct', async () => {
    const sql = await readFile(new URL('./migrations/002_network_profiles.sql', import.meta.url), 'utf8');
    expect(sql).toContain("c.conname = 'spins_network_profile_wallet_day_key'");
    expect(sql).toContain("named_constraint.contype <> 'u'");
    expect(sql).toContain('named_constraint.conkey <> expected_columns');
    expect(sql).toMatch(/IF FOUND THEN[\s\S]*named_constraint[\s\S]*RETURN;/);
  });

  it('attaches an existing correct standalone unique index', async () => {
    const sql = await readFile(new URL('./migrations/002_network_profiles.sql', import.meta.url), 'utf8');
    expect(sql).toContain('indisunique AND i.indisvalid');
    expect(sql).toContain('i.indpred IS NULL AND i.indexprs IS NULL');
    expect(sql).toContain('UNIQUE USING INDEX spins_network_profile_wallet_day_key');
    expect(sql).toContain('UNIQUE USING INDEX %s');
  });

  it('accepts an existing correct constraint under another generated name', async () => {
    const sql = await readFile(new URL('./migrations/002_network_profiles.sql', import.meta.url), 'utf8');
    expect(sql).toMatch(/c\.conrelid = spins_table[\s\S]*c\.contype = 'u'[\s\S]*c\.conkey = expected_columns/);
  });

  it('fails closed when a same-named constraint, index, or relation has a wrong definition', async () => {
    const sql = await readFile(new URL('./migrations/002_network_profiles.sql', import.meta.url), 'utf8');
    expect(sql).toContain('constraint spins_network_profile_wallet_day_key has an unexpected definition');
    expect(sql).toContain('index spins_network_profile_wallet_day_key has an unexpected definition');
    expect(sql).toContain('exists but is not a valid unique index');
    expect(sql.match(/RAISE EXCEPTION/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps existing objects protected by transaction rollback on validation failure', async () => {
    const sql = await readFile(new URL('./migrations/002_network_profiles.sql', import.meta.url), 'utf8');
    expect(sql.trimStart().startsWith('BEGIN;')).toBe(true);
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
    expect(sql).not.toContain('DROP INDEX spins_network_profile_wallet_day_key');
    expect(sql).not.toContain('DROP CONSTRAINT IF EXISTS spins_network_profile_wallet_day_key');
  });

  it('allows an identical signature on distinct clusters by using the composite key', async () => {
    const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
    expect(schema).toContain('PRIMARY KEY (network_profile, signature)');
    expect(schema).not.toContain('signature TEXT PRIMARY KEY');
  });

  it('filters dashboard totals, streaks and spins by network profile', async () => {
    const store = await readFile(new URL('../lib/store.ts', import.meta.url), 'utf8');
    expect(store.match(/network_profile = \$\{networkProfile\}/g)?.length).toBeGreaterThanOrEqual(4);
    expect(store).toContain('ON CONFLICT (network_profile, signature) DO NOTHING');
  });
});
