import { describe, expect, it } from 'vitest';

import { registerConfirmedDeposit } from './depositAnimation';

describe('confirmed deposit animation', () => {
  it('shows once for a newly confirmed signature', () => {
    const shown = new Set<string>();
    expect(registerConfirmedDeposit(shown, 'deposit-signature')).toBe(true);
    expect(registerConfirmedDeposit(shown, 'deposit-signature')).toBe(false);
  });

  it('does not accept an empty signature', () => {
    expect(registerConfirmedDeposit(new Set<string>(), '')).toBe(false);
  });
});
