import { NextResponse } from 'next/server';

import { apiError } from '@/lib/apiError';
import { parseJsonBody } from '@/lib/apiRequest';
import { authenticateWallet } from '@/lib/auth';
import { verifyDepositOnChain } from '@/lib/onchain';
import { recordVerifiedDeposit } from '@/lib/store';
import { depositReportSchema } from '@/lib/validation';
import { ACTIVE_NETWORK, NETWORK_CONFIGURATION_ERROR } from '@/lib/networkProfile';
import { API_RATE_LIMITS, enforceApiRateLimit } from '@/lib/rateLimit';
import { requestIdFor, withRequestId } from '@/lib/observability';

export async function POST(request: Request) {
  const context = { requestId: requestIdFor(request), routeKey: API_RATE_LIMITS.report.route,
    networkProfile: ACTIVE_NETWORK.name, startedAt: Date.now() };
  const respond = (response: Response) => withRequestId(response, context.requestId);
  try {
    const input = await parseJsonBody(request, depositReportSchema);
    if (NETWORK_CONFIGURATION_ERROR || input.networkProfile !== ACTIVE_NETWORK.name) {
      return respond(NextResponse.json({ error: 'Network profile mismatch', code: 'NETWORK_MISMATCH' }, { status: 409 }));
    }

    const identity = await authenticateWallet(request, input.wallet);
    await enforceApiRateLimit({
      policy: API_RATE_LIMITS.report, userId: identity.userId, networkProfile: ACTIVE_NETWORK.name,
    });
    const deposit = await verifyDepositOnChain(input.signature, identity.walletAddress);
    if (!deposit) {
      return respond(NextResponse.json({
        error: 'Transaction is not a valid Jupiter USDC deposit', code: 'INVALID_DEPOSIT',
      }, { status: 422 }));
    }

    const result = await recordVerifiedDeposit(identity.userId, deposit);
    return respond(NextResponse.json(result));
  } catch (error) {
    return apiError(error, context);
  }
}
