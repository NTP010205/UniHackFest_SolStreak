const U64_MAX = (1n << 64n) - 1n;

/** Encode an unsigned 64-bit integer as exactly eight little-endian bytes. */
export function encodeU64LE(value: bigint): Uint8Array {
  if (value < 0n || value > U64_MAX) {
    throw new RangeError('u64 value is outside the supported range.');
  }
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setBigUint64(0, value, true);
  return bytes;
}

export function encodeAnchorU64InstructionData(
  discriminator: readonly number[],
  value: bigint,
): Uint8Array {
  if (discriminator.length !== 8 || discriminator.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    throw new RangeError('Anchor discriminator must contain exactly eight bytes.');
  }
  const data = new Uint8Array(16);
  data.set(discriminator, 0);
  data.set(encodeU64LE(value), 8);
  return data;
}
