import { PublicKey } from '@solana/web3.js';
import { NextResponse } from 'next/server';

import { apiError } from '@/lib/apiError';
import { parseWalletQuery } from '@/lib/apiRequest';
import { authenticateWallet } from '@/lib/auth';
import { getJupiterPositionUsdc } from '@/lib/jupiter';
import { dashboardFor } from '@/lib/store';
import { walletSchema } from '@/lib/validation';
import { ACTIVE_NETWORK } from '@/lib/networkProfile';
import { API_RATE_LIMITS, enforceApiRateLimit } from '@/lib/rateLimit';
import { requestIdFor, withRequestId } from '@/lib/observability';

export async function GET(request: Request) {
  const context = { requestId: requestIdFor(request), routeKey: API_RATE_LIMITS.status.route,
    networkProfile: ACTIVE_NETWORK.name, startedAt: Date.now() };
  try {
    const wallet = parseWalletQuery(request, walletSchema);
    const identity = await authenticateWallet(request, wallet);
    await enforceApiRateLimit({
      policy: API_RATE_LIMITS.status, userId: identity.userId, networkProfile: ACTIVE_NETWORK.name,
    });
    const dashboard = await dashboardFor(identity.userId, identity.walletAddress, ACTIVE_NETWORK.name);

    let currentPositionUsdc: number | null = null;
    let positionUnavailable = false;
    try {
      currentPositionUsdc = await getJupiterPositionUsdc(new PublicKey(identity.walletAddress));
    } catch {
      positionUnavailable = true;
    }

    return withRequestId(NextResponse.json({
      ...dashboard,
      currentPositionUsdc,
      positionUnavailable,
      networkProfile: ACTIVE_NETWORK.name,
    }), context.requestId);
  } catch (error) {
    return apiError(error, context);
  }
}
