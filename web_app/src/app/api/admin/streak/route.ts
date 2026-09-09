import { NextResponse } from 'next/server';

import { requireDevnetAdmin } from '@/lib/admin';
import { apiError } from '@/lib/apiError';
import { parseJsonBody } from '@/lib/apiRequest';
import { ACTIVE_NETWORK } from '@/lib/networkProfile';
import { emitOperationalEvent, requestIdFor, withRequestId } from '@/lib/observability';
import { API_RATE_LIMITS, enforceApiRateLimit } from '@/lib/rateLimit';
import { setAdminDemoStreak } from '@/lib/store';
import { adminStreakSchema } from '@/lib/validation';

export async function POST(request: Request) {
  const context = { requestId: requestIdFor(request), routeKey: API_RATE_LIMITS.adminStreak.route,
    networkProfile: ACTIVE_NETWORK.name, startedAt: Date.now() };
  try {
    const input = await parseJsonBody(request, adminStreakSchema);
    const identity = await requireDevnetAdmin(request, ACTIVE_NETWORK.name, input.wallet);
    await enforceApiRateLimit({ policy: API_RATE_LIMITS.adminStreak, userId: identity.userId,
      networkProfile: ACTIVE_NETWORK.name });
    const result = await setAdminDemoStreak(
      identity.userId, identity.walletAddress, ACTIVE_NETWORK.name, input.currentStreak,
    );
    emitOperationalEvent({ event: 'admin.streak.updated', severity: 'info', requestId: context.requestId,
      routeKey: context.routeKey, networkProfile: ACTIVE_NETWORK.name, status: 'updated',
      durationMs: Date.now() - context.startedAt });
    return withRequestId(NextResponse.json(result), context.requestId);
  } catch (error) {
    emitOperationalEvent({ event: 'admin.streak.failed', severity: 'warning', requestId: context.requestId,
      routeKey: context.routeKey, networkProfile: ACTIVE_NETWORK.name, status: 'failed',
      durationMs: Date.now() - context.startedAt });
    return apiError(error, context);
  }
}
