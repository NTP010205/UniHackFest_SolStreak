/**
 * The single shared USDC decimal conversion (roadmap Phase 2 gotcha:
 * "10 USDC becomes tiny units"). Every amount crossing the UI ↔ chain
 * boundary must go through these helpers — never inline `* 1_000_000`.
 */
export const USDC_DECIMALS = 6;

/** Human USDC amount → on-chain base units. */
export function toBaseUnits(amountUsdc: number): bigint {
  return BigInt(Math.round(amountUsdc * 1_000_000));
}

/** On-chain base units → human USDC amount. */
export function fromBaseUnits(baseUnits: bigint | number): number {
  return Number(baseUnits) / 1_000_000;
}
