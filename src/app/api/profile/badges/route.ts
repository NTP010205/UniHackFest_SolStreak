import { NextResponse } from 'next/server';

import { apiError } from '@/lib/apiError';
import { parseWalletQuery } from '@/lib/apiRequest';
import { authenticateWallet } from '@/lib/auth';
import { ACTIVE_NETWORK } from '@/lib/networkProfile';
import { requestIdFor, withRequestId } from '@/lib/observability';
import { API_RATE_LIMITS, enforceApiRateLimit } from '@/lib/rateLimit';
import { badgeProfileFor } from '@/lib/store';
import { walletSchema } from '@/lib/validation';

export async function GET(request: Request) {
  const context = { requestId: requestIdFor(request), routeKey: API_RATE_LIMITS.badges.route,
    networkProfile: ACTIVE_NETWORK.name, startedAt: Date.now() };
  try {
    const wallet = parseWalletQuery(request, walletSchema);
    const identity = await authenticateWallet(request, wallet);
    await enforceApiRateLimit({ policy: API_RATE_LIMITS.badges, userId: identity.userId,
      networkProfile: ACTIVE_NETWORK.name });
    return withRequestId(NextResponse.json(
      await badgeProfileFor(identity.userId, identity.walletAddress, ACTIVE_NETWORK.name),
    ), context.requestId);
  } catch (error) {
    return apiError(error, context);
  }
}
