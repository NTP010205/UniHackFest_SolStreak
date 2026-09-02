import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('./migrations/004_api_rate_limits.sql', import.meta.url), 'utf8');

describe('API rate-limit migration', () => {
  it('uses a distributed fixed-window composite identity and expiration index', () => {
    expect(sql).toMatch(/PRIMARY KEY \(route_key, privy_user_id, network_profile, window_start\)/);
    expect(sql).toMatch(/network_profile IN \('mainnet', 'devnet'\)/);
    expect(sql).toMatch(/request_count INTEGER NOT NULL CHECK \(request_count > 0\)/);
    expect(sql).toMatch(/api_rate_limit_buckets_expiration_idx/);
    expect(sql).toMatch(/DELETE FROM api_rate_limit_buckets WHERE window_start/);
    expect(sql).not.toMatch(/identity.token|private.key|rpc.url/i);
  });
});
