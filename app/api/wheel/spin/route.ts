import { NextResponse } from 'next/server';

import { apiError } from '@/lib/apiError';
import { ApiRequestError, parseJsonBody } from '@/lib/apiRequest';
import { authenticateWallet } from '@/lib/auth';
import { recordSpin } from '@/lib/store';
import { walletBodySchema } from '@/lib/validation';
import { ACTIVE_NETWORK } from '@/lib/networkProfile';
import { API_RATE_LIMITS, enforceApiRateLimit } from '@/lib/rateLimit';
import { requestIdFor, withRequestId } from '@/lib/observability';
import { emitOperationalEvent } from '@/lib/observability';
import { publicBadgeSpinResult } from '@/lib/badges';

export async function POST(request: Request) {
  const context = { requestId: requestIdFor(request), routeKey: API_RATE_LIMITS.spin.route,
    networkProfile: ACTIVE_NETWORK.name, startedAt: Date.now() };
  try {
    const input = await parseJsonBody(request, walletBodySchema);
    const requestKey = request.headers.get('idempotency-key');
    if (!requestKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) {
      throw new ApiRequestError('INVALID_IDEMPOTENCY_KEY', 'A valid Idempotency-Key header is required', 400);
    }
    const identity = await authenticateWallet(request, input.wallet);
    await enforceApiRateLimit({
      policy: API_RATE_LIMITS.spin, userId: identity.userId, networkProfile: ACTIVE_NETWORK.name,
    });
    const result = await recordSpin(identity.userId, identity.walletAddress, ACTIVE_NETWORK.name, requestKey);
    emitOperationalEvent({ event: result.replayed ? 'badge.replayed' : 'badge.awarded', severity: 'info',
      requestId: context.requestId, routeKey: context.routeKey, networkProfile: ACTIVE_NETWORK.name,
      status: result.replayed ? 'replayed' : 'awarded', durationMs: Date.now() - context.startedAt });
    if (result.source === 'welcome_demo' && !result.replayed) emitOperationalEvent({ event: 'welcome_spin.consumed', severity: 'info',
      requestId: context.requestId, routeKey: context.routeKey, networkProfile: ACTIVE_NETWORK.name,
      status: 'consumed', durationMs: Date.now() - context.startedAt });

    return withRequestId(NextResponse.json(publicBadgeSpinResult(result)), context.requestId);
  } catch (error) {
    emitOperationalEvent({ event: 'badge.failed', severity: 'warning', requestId: context.requestId,
      routeKey: context.routeKey, networkProfile: ACTIVE_NETWORK.name, status: 'failed',
      durationMs: Date.now() - context.startedAt });
    return apiError(error, context);
  }
}
