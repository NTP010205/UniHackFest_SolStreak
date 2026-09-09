import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const store = readFileSync(new URL('./store.ts', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../hooks/useVaultTransaction.ts', import.meta.url), 'utf8');

describe('user-triggered submission reconciliation boundary', () => {
  it('claims by authenticated user, wallet, kind, and network profile', () => {
    const start = store.indexOf('export async function claimUserSubmissionBatch');
    const end = store.indexOf('export async function updateClaimedSubmission', start);
    const implementation = store.slice(start, end);
    expect(implementation).toContain('privy_user_id = ${userId}');
    expect(implementation).toContain('wallet_address = ${walletAddress}');
    expect(implementation).toContain('transaction_kind = ${kind}');
    expect(implementation).toContain('network_profile = ${networkProfile}');
    expect(implementation).not.toMatch(/INSERT\s+INTO\s+(?:spins|deposits)/i);
  });

  it('checks status through the backend and never resubmits the signed transaction', () => {
    expect(hook).toContain("fetch('/api/transactions/submissions/reconcile'");
    const start = hook.indexOf('const checkStatus = useCallback');
    const implementation = hook.slice(start, hook.indexOf('\n\n  return {', start));
    expect(implementation).not.toContain('sendRawTransaction');
    expect(implementation).not.toContain('signTransaction');
    expect(implementation).not.toContain('.execute(');
  });

  it('keeps recovery explicit and checks each transaction kind without broadcasting', () => {
    const card = readFileSync(new URL('../components/TransactionCard.tsx', import.meta.url), 'utf8');
    expect(card).toContain('Check all transaction statuses');
    expect(card).toContain("deposit.phase === 'unknown'");
    expect(card).toContain("withdraw.phase === 'unknown'");
    expect(card).not.toContain('Check deposit status');
    expect(card).not.toContain('Check withdrawal status');
  });
});
