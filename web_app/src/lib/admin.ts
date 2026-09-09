import { PublicKey } from '@solana/web3.js';

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

export function parseAdminWalletAddresses(raw: string | undefined): ReadonlySet<string> {
  return new Set((raw ?? '').split(',').map(value => value.trim()).filter(value => {
    if (!value) return false;
    try { return new PublicKey(value).toBase58() === value; }
    catch { return false; }
  }));
}

export function isAdminIdentity(
  identity: AuthenticatedUser,
  rawUserIds = process.env.SOLSTREAK_ADMIN_PRIVY_USER_IDS,
  rawWallets = process.env.SOLSTREAK_ADMIN_WALLET_ADDRESSES,
) {
  return isAdminPrivyUserId(identity.userId, rawUserIds)
    || parseAdminWalletAddresses(rawWallets).has(identity.walletAddress)
    // Backward-compatible for local configs that placed a wallet address in
    // the original allowlist before the dedicated wallet variable existed.
    || parseAdminWalletAddresses(rawUserIds).has(identity.walletAddress);
}

export async function requireDevnetAdmin(
  request: Request,
  profile: SolanaNetworkProfileName,
  expectedWallet: string,
  authenticate: (request: Request, expectedWallet?: string) => Promise<AuthenticatedUser> = authenticateWallet,
) {
  const identity = await authenticate(request, expectedWallet);
  if (profile !== 'devnet' || !isAdminIdentity(identity)) {
    throw new AdminAccessError('Admin access is unavailable');
  }
  return identity;
}
