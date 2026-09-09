import { NextResponse } from 'next/server';

import { apiError } from '@/lib/apiError';
import { parseJsonBody } from '@/lib/apiRequest';
import { authenticateWallet } from '@/lib/auth';
import { ACTIVE_NETWORK, NETWORK_CONFIGURATION_ERROR } from '@/lib/networkProfile';
import { requestIdFor, withRequestId } from '@/lib/observability';
import { API_RATE_LIMITS, enforceApiRateLimit } from '@/lib/rateLimit';
import { runConfiguredUserReconciliation } from '@/lib/reconciliationServer';
import { submissionReconciliationSchema } from '@/lib/validation';

function publicSummary(summary: Awaited<ReturnType<typeof runConfiguredUserReconciliation>>) {
  return {
    claimed: Math.max(0, Math.trunc(summary.claimed)),
    pending: Math.max(0, Math.trunc(summary.pending)),
    reconciled: Math.max(0, Math.trunc(summary.reconciled)),
    reportPending: Math.max(0, Math.trunc(summary.reportPending)),
    failed: Math.max(0, Math.trunc(summary.failed)),
    expired: Math.max(0, Math.trunc(summary.expired)),
    unknown: Math.max(0, Math.trunc(summary.unknown)),
  };
}

export async function POST(request: Request) {
  const context = {
    requestId: requestIdFor(request),
    routeKey: API_RATE_LIMITS.submissionReconcile.route,
    networkProfile: ACTIVE_NETWORK.name,
    startedAt: Date.now(),
  };
  try {
    if (NETWORK_CONFIGURATION_ERROR) {
      return withRequestId(NextResponse.json(
        { error: 'Network profile mismatch', code: 'NETWORK_MISMATCH' },
        { status: 409 },
      ), context.requestId);
    }
    const input = await parseJsonBody(request, submissionReconciliationSchema);
    const identity = await authenticateWallet(request, input.wallet);
    await enforceApiRateLimit({
      policy: API_RATE_LIMITS.submissionReconcile,
      userId: identity.userId,
      networkProfile: ACTIVE_NETWORK.name,
    });
    const summary = await runConfiguredUserReconciliation({
      userId: identity.userId,
      walletAddress: identity.walletAddress,
      kind: input.kind,
      limit: 5,
    });
    return withRequestId(NextResponse.json(publicSummary(summary)), context.requestId);
  } catch (error) {
    return apiError(error, context);
  }
}
