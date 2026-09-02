import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('./migrations/003_transaction_submissions.sql', import.meta.url), 'utf8');

describe('transaction submissions migration', () => {
  it('namespaces signatures by network profile and preserves both clusters', () => {
    expect(sql).toMatch(/PRIMARY KEY\s*\(network_profile,\s*signature\)/i);
    expect(sql).not.toMatch(/UNIQUE\s*\(signature\)/i);
    expect(sql).toContain("network_profile IN ('mainnet', 'devnet')");
  });

  it('contains durable retry and atomic-claim fields without sensitive payloads', () => {
    for (const field of ['blockhash', 'last_valid_block_height', 'attempt_count', 'next_attempt_at', 'claim_token', 'claimed_at']) {
      expect(sql).toContain(field);
    }
    expect(sql).not.toMatch(/signed_transaction|identity_token|private_key|rpc_url/i);
  });
});
