import { describe, expect, it } from 'vitest';

import { fromBaseUnits, toBaseUnits } from './decimals';

describe('USDC decimal conversion', () => {
  it('converts whole and fractional USDC to six decimal base units', () => {
    expect(toBaseUnits(10)).toBe(10_000_000n);
    expect(toBaseUnits(10.123456)).toBe(10_123_456n);
    expect(toBaseUnits(0.000001)).toBe(1n);
  });

  it('rounds sub-base-unit input and converts back', () => {
    expect(toBaseUnits(1.0000006)).toBe(1_000_001n);
    expect(fromBaseUnits(10_123_456n)).toBe(10.123456);
  });
});
