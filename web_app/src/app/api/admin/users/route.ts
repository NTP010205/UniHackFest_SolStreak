import { NextResponse } from 'next/server';

import { requireDevnetAdmin } from '@/lib/admin';
import { apiError } from '@/lib/apiError';
import { parseWalletQuery } from '@/lib/apiRequest';
import { ACTIVE_NETWORK } from '@/lib/networkProfile';
import { emitOperationalEvent, requestIdFor, withRequestId } from '@/lib/observability';
import { API_RATE_LIMITS, enforceApiRateLimit } from '@/lib/rateLimit';
import { devnetAdminUsers } from '@/lib/store';
import { walletSchema } from '@/lib/validation';

export async function GET(request: Request) {
  const context = {
    requestId: requestIdFor(request),
    routeKey: API_RATE_LIMITS.adminUsers.route,
    networkProfile: ACTIVE_NETWORK.name,
    startedAt: Date.now(),
  };
  try {
    const wallet = parseWalletQuery(request, walletSchema);
    const identity = await requireDevnetAdmin(request, ACTIVE_NETWORK.name, wallet);
    await enforceApiRateLimit({
      policy: API_RATE_LIMITS.adminUsers,
      userId: identity.userId,
      networkProfile: ACTIVE_NETWORK.name,
    });
    const users = await devnetAdminUsers();
    emitOperationalEvent({
      event: 'admin.users.viewed',
      severity: 'info',
      requestId: context.requestId,
      routeKey: context.routeKey,
      networkProfile: ACTIVE_NETWORK.name,
      status: 'viewed',
      durationMs: Date.now() - context.startedAt,
    });
    return withRequestId(NextResponse.json({
      isAdmin: true,
      networkProfile: 'devnet',
      users,
    }), context.requestId);
  } catch (error) {
    emitOperationalEvent({
      event: 'admin.users.failed',
      severity: 'warning',
      requestId: context.requestId,
      routeKey: context.routeKey,
      networkProfile: ACTIVE_NETWORK.name,
      status: 'failed',
      durationMs: Date.now() - context.startedAt,
    });
    return apiError(error, context);
  }
}
