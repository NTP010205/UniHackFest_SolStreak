import { NextResponse } from 'next/server';

import { requireDevnetAdmin } from '@/lib/admin';
import { apiError } from '@/lib/apiError';
import { ACTIVE_NETWORK } from '@/lib/networkProfile';
import { emitOperationalEvent, requestIdFor, withRequestId } from '@/lib/observability';
import { API_RATE_LIMITS, enforceApiRateLimit } from '@/lib/rateLimit';
import { devnetAdminMetrics } from '@/lib/store';

export async function GET(request: Request) {
  const context = { requestId: requestIdFor(request), routeKey: API_RATE_LIMITS.adminMetrics.route,
    networkProfile: ACTIVE_NETWORK.name, startedAt: Date.now() };
  try {
    const identity = await requireDevnetAdmin(request, ACTIVE_NETWORK.name);
    await enforceApiRateLimit({ policy: API_RATE_LIMITS.adminMetrics, userId: identity.userId,
      networkProfile: ACTIVE_NETWORK.name });
    const metrics = await devnetAdminMetrics();
    emitOperationalEvent({ event: 'admin.metrics.viewed', severity: 'info', requestId: context.requestId,
      routeKey: context.routeKey, networkProfile: ACTIVE_NETWORK.name, status: 'viewed',
      durationMs: Date.now() - context.startedAt });
    return withRequestId(NextResponse.json({ isAdmin: true, networkProfile: 'devnet', ...metrics }), context.requestId);
  } catch (error) {
    emitOperationalEvent({ event: 'admin.metrics.failed', severity: 'warning', requestId: context.requestId,
      routeKey: context.routeKey, networkProfile: ACTIVE_NETWORK.name, status: 'failed',
      durationMs: Date.now() - context.startedAt });
    return apiError(error, context);
  }
}
