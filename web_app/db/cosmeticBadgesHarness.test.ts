import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./cosmeticBadges.integration.test.ts', import.meta.url), 'utf8');
const config = readFileSync(new URL('../vitest.cosmetic-badges-integration.config.mts', import.meta.url), 'utf8');

describe('cosmetic badge PostgreSQL harness safety', () => {
  it('uses a single-connection migration client and a bounded concurrent test client', () => {
    expect(source).toContain('MIGRATION_POOL_MAX = 1');
    expect(source).toContain('INTEGRATION_POOL_MAX = 5');
    expect(source).toContain('max: MIGRATION_POOL_MAX');
    expect(source).toContain('max: INTEGRATION_POOL_MAX');
  });

  it('closes the migration client before creating the integration client', () => {
    expect(source.indexOf('await migrationSql.end()')).toBeLessThan(
      source.indexOf('max: INTEGRATION_POOL_MAX'),
    );
  });

  it('closes the integration pool in afterAll and guards cleanup after setup failure', () => {
    expect(source).toContain('if (!sql || !requiredTablesReady) return');
    expect(source).toContain("SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS present");
    expect(source).toContain('finally { await sql?.end(); }');
  });

  it('keeps real concurrency and verifies one persisted random draw', () => {
    expect(source).toContain('Array.from({ length: 12 }, () => track(run()))');
    expect(source).toContain('Promise.all(requests)');
    expect(source).toContain('expect(drawCalls).toBe(1)');
    expect(source).not.toContain('process.env.DATABASE_URL');
    expect(source).not.toContain('.env.local');
  });

  it('uses finite integration-only timeouts while retaining the five-connection pool', () => {
    expect(config).toContain('testTimeout: 30_000');
    expect(config).toContain('hookTimeout: 30_000');
    expect(config).toContain('sequence: { concurrent: false }');
    expect(source).toContain('INTEGRATION_POOL_MAX = 5');
    expect(source).toContain('Array.from({ length: 12 }, () => track(run()))');
    expect(source).toContain('Promise.allSettled([...pendingOperations])');
  });
});
