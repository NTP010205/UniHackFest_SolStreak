import { describe, expect, it, vi } from 'vitest';

import { preserveReconciliationResultDuringCleanup } from './reconciliationServer';

describe('reconciliation maintenance isolation', () => {
  it('does not hide or roll back a reconciliation result when cleanup fails', async () => {
    const summary = { claimed: 2, reconciled: 2 };
    const failure = vi.fn();
    await expect(preserveReconciliationResultDuringCleanup(
      summary,
      async () => { throw new Error('postgres://credential'); },
      failure,
    )).resolves.toBe(summary);
    expect(failure).toHaveBeenCalledOnce();
  });
});
