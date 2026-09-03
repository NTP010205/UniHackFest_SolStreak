import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../scripts/migrate.mjs', import.meta.url), 'utf8');

describe('migration runner ordering', () => {
  it('awaits migrations sequentially and reports success only after 006 completes', () => {
    const network = source.indexOf('await sql.unsafe(networkProfiles).simple()');
    const submissions = source.indexOf('await sql.unsafe(transactionSubmissions).simple()');
    const rateLimits = source.indexOf('await sql.unsafe(apiRateLimits).simple()');
    const badges = source.indexOf('await sql.unsafe(cosmeticBadges).simple()');
    const adminLab = source.indexOf('await sql.unsafe(devnetAdminLab).simple()');
    const success = source.indexOf("console.log('SolStreak database schema is up to date.')");
    expect(network).toBeGreaterThan(-1);
    expect(submissions).toBeGreaterThan(network);
    expect(rateLimits).toBeGreaterThan(submissions);
    expect(badges).toBeGreaterThan(rateLimits);
    expect(adminLab).toBeGreaterThan(badges);
    expect(success).toBeGreaterThan(adminLab);
  });

  it('does not catch and suppress a failed migration', () => {
    expect(source).not.toMatch(/catch\s*\([^)]*\)\s*\{[^}]*schema is up to date/s);
    expect(source).toContain('finally');
  });
});
