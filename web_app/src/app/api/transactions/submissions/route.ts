import { NextResponse } from 'next/server';

import { apiError } from '@/lib/apiError';
import { parseJsonBody, parseWalletQuery } from '@/lib/apiRequest';
import { authenticateWallet } from '@/lib/auth';
import { ACTIVE_NETWORK, NETWORK_CONFIGURATION_ERROR } from '@/lib/networkProfile';
import { trackSubmission, unresolvedSubmissions } from '@/lib/store';
import { submissionTrackingSchema, walletSchema } from '@/lib/validation';
import { API_RATE_LIMITS, enforceApiRateLimit } from '@/lib/rateLimit';
import { requestIdFor, withRequestId } from '@/lib/observability';

function publicRecord(record: Awaited<ReturnType<typeof trackSubmission>>) {
  return {
    networkProfile: record.networkProfile,
    signature: record.signature,
    wallet: record.walletAddress,
    kind: record.kind,
    blockhash: record.blockhash,
    lastValidBlockHeight: record.lastValidBlockHeight,
    status: record.status,
    submittedAt: record.submittedAt,
    confirmedAt: record.confirmedAt,
    reportedAt: record.reportedAt,
    attemptCount: record.attemptCount,
    nextAttemptAt: record.nextAttemptAt,
    lastErrorCode: record.lastErrorCode,
  };
}

export async function POST(request: Request) {
  const context = { requestId: requestIdFor(request), routeKey: API_RATE_LIMITS.submissionTrack.route,
    networkProfile: ACTIVE_NETWORK.name, startedAt: Date.now() };
  try {
    const input = await parseJsonBody(request, submissionTrackingSchema);
    if (NETWORK_CONFIGURATION_ERROR || input.networkProfile !== ACTIVE_NETWORK.name) {
      return withRequestId(NextResponse.json({ error: 'Network profile mismatch', code: 'NETWORK_MISMATCH' }, { status: 409 }), context.requestId);
    }
    const identity = await authenticateWallet(request, input.wallet);
    await enforceApiRateLimit({
      policy: API_RATE_LIMITS.submissionTrack, userId: identity.userId, networkProfile: ACTIVE_NETWORK.name,
    });
    const record = await trackSubmission(identity.userId, {
      networkProfile: input.networkProfile,
      signature: input.signature,
      walletAddress: identity.walletAddress,
      kind: input.kind,
      blockhash: input.blockhash,
      lastValidBlockHeight: input.lastValidBlockHeight,
    });
    return withRequestId(NextResponse.json(publicRecord(record)), context.requestId);
  } catch (error) {
    return apiError(error, context);
  }
}

export async function GET(request: Request) {
  const context = { requestId: requestIdFor(request), routeKey: API_RATE_LIMITS.submissionRecovery.route,
    networkProfile: ACTIVE_NETWORK.name, startedAt: Date.now() };
  try {
    const wallet = parseWalletQuery(request, walletSchema);
    const identity = await authenticateWallet(request, wallet);
    await enforceApiRateLimit({
      policy: API_RATE_LIMITS.submissionRecovery, userId: identity.userId, networkProfile: ACTIVE_NETWORK.name,
    });
    const records = await unresolvedSubmissions(identity.userId, identity.walletAddress, ACTIVE_NETWORK.name);
    return withRequestId(NextResponse.json({ submissions: records.map(publicRecord) }), context.requestId);
  } catch (error) {
    return apiError(error, context);
  }
}
