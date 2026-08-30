import { createRemoteJWKSet, jwtVerify } from 'jose';

export class AuthenticationError extends Error {}

interface LinkedAccount {
  type?: string;
  address?: string;
  chain_type?: string;
}

export interface AuthenticatedUser {
  userId: string;
  walletAddress: string;
}

const jwksByApp = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(appId: string) {
  let jwks = jwksByApp.get(appId);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`));
    jwksByApp.set(appId, jwks);
  }
  return jwks;
}

function readIdentityToken(req: Request): string | null {
  const header = req.headers.get('privy-id-token');
  if (header) return header;

  const cookie = req.headers.get('cookie');
  return cookie?.match(/(?:^|;\s*)privy-id-token=([^;]+)/)?.[1] ?? null;
}

/** Verify Privy's signed identity token and require the requested Solana wallet to be linked. */
export async function authenticateWallet(
  req: Request,
  expectedWallet?: string,
): Promise<AuthenticatedUser> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) throw new AuthenticationError('Privy is not configured');

  const token = readIdentityToken(req);
  if (!token) throw new AuthenticationError('Sign in again to continue');

  try {
    const { payload } = await jwtVerify(token, getJwks(appId), {
      issuer: 'privy.io',
      audience: appId,
    });
    if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new AuthenticationError('Invalid or expired Privy identity token');
    }
    if (!payload.sub || typeof payload.linked_accounts !== 'string') {
      throw new AuthenticationError('Identity token is missing linked accounts');
    }

    const accounts: unknown = JSON.parse(payload.linked_accounts);
    if (!Array.isArray(accounts)) {
      throw new AuthenticationError('Identity token is missing linked accounts');
    }
    const wallets = accounts.filter(
      (account: LinkedAccount) =>
        account.type === 'wallet' &&
        account.chain_type === 'solana' &&
        typeof account.address === 'string',
    );
    const wallet = expectedWallet
      ? wallets.find((account) => account.address === expectedWallet)
      : wallets[0];
    if (!wallet?.address) throw new AuthenticationError('Wallet is not linked to this Privy user');

    return { userId: payload.sub, walletAddress: wallet.address };
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    throw new AuthenticationError('Invalid or expired Privy identity token');
  }
}
