/** Truncates a base58 address for display, e.g. `7xKX…gF2W`. */
export function truncateAddress(address: string | undefined, lead = 4, tail = 4): string {
  if (!address) return '';
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/** Formats a USDC amount with thousands separators, always 2 decimals. */
export function formatUsdc(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
