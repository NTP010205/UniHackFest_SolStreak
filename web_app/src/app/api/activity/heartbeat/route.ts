import { NextResponse } from 'next/server';

import { apiError } from '@/lib/apiError';
import { parseJsonBody } from '@/lib/apiRequest';
import { authenticateWallet } from '@/lib/auth';
import { ACTIVE_NETWORK } from '@/lib/networkProfile';
import { requestIdFor, withRequestId } from '@/lib/observability';
import { API_RATE_LIMITS, enforceApiRateLimit } from '@/lib/rateLimit';
import { recordUserActivity } from '@/lib/store';
import { walletBodySchema } from '@/lib/validation';

export async function POST(request: Request) {
  const context = {
    requestId: requestIdFor(request),
    routeKey: API_RATE_LIMITS.activityHeartbeat.route,
    networkProfile: ACTIVE_NETWORK.name,
    startedAt: Date.now(),
  };
  try {
    const input = await parseJsonBody(request, walletBodySchema);
    const identity = await authenticateWallet(request, input.wallet);
    await enforceApiRateLimit({
      policy: API_RATE_LIMITS.activityHeartbeat,
      userId: identity.userId,
      networkProfile: ACTIVE_NETWORK.name,
    });
    const lastSeenAt = await recordUserActivity(
      identity.userId,
      identity.walletAddress,
      ACTIVE_NETWORK.name,
    );
    return withRequestId(NextResponse.json({
      networkProfile: ACTIVE_NETWORK.name,
      status: 'active',
      lastSeenAt,
    }), context.requestId);
  } catch (error) {
    return apiError(error, context);
  }
}
