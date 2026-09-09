import { NextResponse } from 'next/server';

import { requireDevnetAdmin } from '@/lib/admin';
import { apiError } from '@/lib/apiError';
import { parseWalletQuery } from '@/lib/apiRequest';
import { ACTIVE_NETWORK } from '@/lib/networkProfile';
import { requestIdFor, withRequestId } from '@/lib/observability';
import { walletSchema } from '@/lib/validation';

/** Lightweight, database-free capability check used only to reveal admin navigation. */
export async function GET(request: Request) {
  const context = {
    requestId: requestIdFor(request),
    routeKey: 'admin.access',
    networkProfile: ACTIVE_NETWORK.name,
    startedAt: Date.now(),
  };
  try {
    const wallet = parseWalletQuery(request, walletSchema);
    await requireDevnetAdmin(request, ACTIVE_NETWORK.name, wallet);
    return withRequestId(NextResponse.json({ isAdmin: true, networkProfile: 'devnet' }), context.requestId);
  } catch (error) {
    return apiError(error, context);
  }
}
