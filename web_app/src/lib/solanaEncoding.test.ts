import { afterEach, describe, expect, it, vi } from 'vitest';

import { encodeAnchorU64InstructionData, encodeU64LE } from './solanaEncoding';

afterEach(() => vi.unstubAllGlobals());

describe('browser-safe Solana u64 encoding', () => {
  it.each([
    [0n, [0, 0, 0, 0, 0, 0, 0, 0]],
    [1n, [1, 0, 0, 0, 0, 0, 0, 0]],
    [1_000_000n, [64, 66, 15, 0, 0, 0, 0, 0]],
    [(1n << 64n) - 1n, [255, 255, 255, 255, 255, 255, 255, 255]],
  ] as const)('encodes %s as exact little-endian bytes', (value, expected) => {
    const encoded = encodeU64LE(value);
    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(encoded).toHaveLength(8);
    expect([...encoded]).toEqual(expected);
  });

  it('rejects values outside the unsigned 64-bit range', () => {
    expect(() => encodeU64LE(-1n)).toThrow(RangeError);
    expect(() => encodeU64LE(1n << 64n)).toThrow(RangeError);
  });

  it('does not depend on global Buffer', () => {
    vi.stubGlobal('Buffer', undefined);
    expect([...encodeU64LE(1_000_000n)]).toEqual([64, 66, 15, 0, 0, 0, 0, 0]);
  });

  it('preserves the discriminator and appends a u64 amount', () => {
    const data = encodeAnchorU64InstructionData([242, 35, 198, 137, 82, 225, 242, 182], 1_000_000n);
    expect(data).toBeInstanceOf(Uint8Array);
    expect([...data]).toEqual([242, 35, 198, 137, 82, 225, 242, 182, 64, 66, 15, 0, 0, 0, 0, 0]);
  });
});
