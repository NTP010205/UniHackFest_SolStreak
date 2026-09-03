import type { AuthenticatedUser } from './auth';
import { authenticateWallet } from './auth';
import type { SolanaNetworkProfileName } from './networkProfile';

export class AdminAccessError extends Error {}

export function parseAdminPrivyUserIds(raw: string | undefined): ReadonlySet<string> {
  return new Set((raw ?? '').split(',').map(value => value.trim()).filter(Boolean));
}

export function isAdminPrivyUserId(userId: string, raw = process.env.SOLSTREAK_ADMIN_PRIVY_USER_IDS) {
  return parseAdminPrivyUserIds(raw).has(userId);
}

export async function requireDevnetAdmin(
  request: Request,
  profile: SolanaNetworkProfileName,
  authenticate: (request: Request) => Promise<AuthenticatedUser> = authenticateWallet,
) {
  const identity = await authenticate(request);
  if (profile !== 'devnet' || !isAdminPrivyUserId(identity.userId)) {
    throw new AdminAccessError('Admin access is unavailable');
  }
  return identity;
}
