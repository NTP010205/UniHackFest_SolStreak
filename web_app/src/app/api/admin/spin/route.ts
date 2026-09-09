import { NextResponse } from 'next/server';

import { requireDevnetAdmin } from '@/lib/admin';
import { apiError } from '@/lib/apiError';
import { ApiRequestError, parseJsonBody } from '@/lib/apiRequest';
import { publicBadgeSpinResult } from '@/lib/badges';
import { ACTIVE_NETWORK } from '@/lib/networkProfile';
import { emitOperationalEvent, requestIdFor, withRequestId } from '@/lib/observability';
import { API_RATE_LIMITS, enforceApiRateLimit } from '@/lib/rateLimit';
import { recordAdminSpin } from '@/lib/store';
import { adminSpinSchema } from '@/lib/validation';

const IDEMPOTENCY_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const context = { requestId: requestIdFor(request), routeKey: API_RATE_LIMITS.adminSpin.route,
    networkProfile: ACTIVE_NETWORK.name, startedAt: Date.now() };
  try {
    const input = await parseJsonBody(request, adminSpinSchema);
    const requestKey = request.headers.get('idempotency-key');
    if (!requestKey || !IDEMPOTENCY_KEY.test(requestKey)) {
      throw new ApiRequestError('INVALID_IDEMPOTENCY_KEY', 'A valid Idempotency-Key header is required', 400);
    }
    const identity = await requireDevnetAdmin(request, ACTIVE_NETWORK.name, input.wallet);
    await enforceApiRateLimit({ policy: API_RATE_LIMITS.adminSpin, userId: identity.userId,
      networkProfile: ACTIVE_NETWORK.name });
    const result = await recordAdminSpin(
      identity.userId, identity.walletAddress, ACTIVE_NETWORK.name, requestKey,
    );
    emitOperationalEvent({ event: 'admin.spin.completed', severity: 'info', requestId: context.requestId,
      routeKey: context.routeKey, networkProfile: ACTIVE_NETWORK.name,
      status: result.replayed ? 'replayed' : 'awarded', durationMs: Date.now() - context.startedAt });
    return withRequestId(NextResponse.json(publicBadgeSpinResult(result)), context.requestId);
  } catch (error) {
    emitOperationalEvent({ event: 'admin.spin.failed', severity: 'warning', requestId: context.requestId,
      routeKey: context.routeKey, networkProfile: ACTIVE_NETWORK.name, status: 'failed',
      durationMs: Date.now() - context.startedAt });
    return apiError(error, context);
  }
}
