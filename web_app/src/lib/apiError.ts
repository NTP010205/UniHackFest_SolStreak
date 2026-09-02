import { NextResponse } from 'next/server';

import { AuthenticationError } from './auth';
import { ApiRequestError } from './apiRequest';
import { DatabaseConfigurationError } from './db';
import { RateLimitExceededError, RateLimitUnavailableError } from './rateLimit';
import { AlreadySpunError, SpinNotEligibleError, SubmissionConflictError, WalletBindingError } from './store';
import { emitOperationalEvent, withRequestId } from './observability';
import type { SolanaNetworkProfileName } from './networkProfile';

export interface ApiErrorContext {
  requestId: string;
  routeKey: string;
  networkProfile: SolanaNetworkProfileName;
  startedAt?: number;
}

export function apiError(error: unknown, context?: ApiErrorContext) {
  const finish = (response: NextResponse) => context ? withRequestId(response, context.requestId) : response;
  if (error instanceof ApiRequestError) {
    return finish(NextResponse.json({ error: error.message, code: error.code }, { status: error.status }));
  }
  if (error instanceof AuthenticationError) {
    return finish(NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 }));
  }
  if (error instanceof RateLimitExceededError) {
    if (context) emitOperationalEvent({ event: 'api.rate_limit.denied', severity: 'warning', status: 'denied',
      requestId: context.requestId, routeKey: context.routeKey, networkProfile: context.networkProfile,
      durationMs: Date.now() - (context.startedAt ?? Date.now()) });
    return finish(NextResponse.json(
      { error: 'Too many requests', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } },
    ));
  }
  if (error instanceof RateLimitUnavailableError) {
    if (context) emitOperationalEvent({ event: 'api.rate_limit.unavailable', severity: 'error', status: 'unavailable',
      requestId: context.requestId, routeKey: context.routeKey, networkProfile: context.networkProfile,
      durationMs: Date.now() - (context.startedAt ?? Date.now()) });
    return finish(NextResponse.json({ error: 'Service unavailable', code: 'RATE_LIMIT_UNAVAILABLE' }, { status: 503 }));
  }
  if (error instanceof WalletBindingError) {
    return finish(NextResponse.json({ error: error.message, code: 'WALLET_FORBIDDEN' }, { status: 403 }));
  }
  if (error instanceof AlreadySpunError) {
    return finish(NextResponse.json({ error: error.message, code: 'SPIN_ALREADY_CLAIMED' }, { status: 409 }));
  }
  if (error instanceof SubmissionConflictError) {
    return finish(NextResponse.json({ error: error.message, code: 'SUBMISSION_CONFLICT' }, { status: 409 }));
  }
  if (error instanceof SpinNotEligibleError) {
    return finish(NextResponse.json({ error: error.message, code: 'SPIN_NOT_ELIGIBLE' }, { status: 403 }));
  }
  if (error instanceof DatabaseConfigurationError) {
    if (context) emitOperationalEvent({ event: 'database.unavailable', severity: 'error', status: 'unavailable',
      requestId: context.requestId, routeKey: context.routeKey, networkProfile: context.networkProfile,
      durationMs: Date.now() - (context.startedAt ?? Date.now()) });
    return finish(NextResponse.json({ error: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 }));
  }
  // Error messages from RPC/network clients can contain credential-bearing
  // endpoint URLs. Log only a coarse error class, never the raw error object.
  return finish(NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 }));
}
