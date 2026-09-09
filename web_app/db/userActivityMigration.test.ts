import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('./migrations/007_devnet_user_activity.sql', import.meta.url), 'utf8');
const runner = readFileSync(new URL('../scripts/migrate.mjs', import.meta.url), 'utf8');

describe('007 Devnet user activity migration', () => {
  it('is transactional, rerunnable, and does not remove existing data', () => {
    expect(sql).toMatch(/^BEGIN;/);
    expect(sql.trim().endsWith('COMMIT;')).toBe(true);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS user_activity');
    expect(sql).not.toMatch(/\bDELETE\b|\bTRUNCATE\b|\bDROP\s+(?:TABLE|COLUMN)\b/i);
  });

  it('keeps presence network-scoped and indexed by recent activity', () => {
    expect(sql).toContain("CHECK (network_profile IN ('mainnet', 'devnet'))");
    expect(sql).toContain('PRIMARY KEY (network_profile, wallet_address)');
    expect(sql).toContain('user_activity_profile_last_seen_idx');
    expect(sql).toContain('last_seen_at DESC');
  });

  it('keeps the server-only table outside public Data API access', () => {
    expect(sql).toContain('ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('REVOKE ALL ON TABLE user_activity FROM PUBLIC');
  });

  it('is applied after migration 006 by the project migration runner', () => {
    expect(runner.indexOf('006_devnet_admin_lab.sql')).toBeLessThan(
      runner.indexOf('007_devnet_user_activity.sql'),
    );
    expect(runner).toContain('await sql.unsafe(userActivity).simple()');
  });
});
