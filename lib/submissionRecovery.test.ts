import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pendingSubmissionReferences, removePendingSubmission, savePendingSubmission } from './submissionRecovery';

describe('minimal local submission recovery reference', () => {
  const values = new Map<string, string>();
  beforeEach(() => vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }));
  afterEach(() => { values.clear(); vi.unstubAllGlobals(); });

  it('stores only the signature lifetime/profile/kind reference and removes it after finalization', () => {
    savePendingSubmission({
      networkProfile: 'devnet', signature: '1'.repeat(88), wallet: 'wallet', kind: 'deposit',
      blockhash: '2'.repeat(44), lastValidBlockHeight: 100,
    });
    const stored = values.values().next().value as string;
    expect(stored).not.toMatch(/signedTransaction|identityToken|rpc/i);
    expect(pendingSubmissionReferences('wallet', 'devnet', 'deposit')).toHaveLength(1);
    expect(pendingSubmissionReferences('wallet', 'mainnet')).toHaveLength(0);
    removePendingSubmission('devnet', '1'.repeat(88));
    expect(pendingSubmissionReferences('wallet', 'devnet')).toHaveLength(0);
  });
});
