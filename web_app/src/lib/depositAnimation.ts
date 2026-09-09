/**
 * Register one confirmed deposit for presentation. A report retry can emit the
 * same confirmed signature again, so the celebration must stay exactly-once.
 */
export function registerConfirmedDeposit(
  shownSignatures: Set<string>,
  signature: string,
): boolean {
  if (!signature || shownSignatures.has(signature)) return false;
  shownSignatures.add(signature);
  return true;
}
