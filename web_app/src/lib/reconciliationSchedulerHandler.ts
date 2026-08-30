import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import type { ReconciliationSummary } from '@/lib/reconciliation';
import { emitOperationalEvent, requestIdFor, withRequestId } from '@/lib/observability';
import type { SolanaNetworkProfileName } from '@/lib/networkProfile';
import { RateLimitUnavailableError } from '@/lib/rateLimit';

export const SCHEDULER_DEFAULT_BATCH = 25;
export const SCHEDULER_MAX_BATCH = 100;
export const SCHEDULER_TIMEOUT_MS = 20_000;

type SchedulerRunner = (limit: number) => Promise<ReconciliationSummary>;

function digest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest();
}

function authorized(request: Request, expected: string | undefined) {
  const header = request.headers.get('authorization');
  const match = header?.match(/^Bearer\s+([^\s]+)$/i);
  if (!expected || !match) return false;
  return timingSafeEqual(digest(expected), digest(match[1]));
}

function batchLimit(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get('limit') ?? SCHEDULER_DEFAULT_BATCH);
  return Number.isInteger(requested)
    ? Math.max(1, Math.min(requested, SCHEDULER_MAX_BATCH))
    : SCHEDULER_DEFAULT_BATCH;
}

function sanitizedSummary(summary: ReconciliationSummary): ReconciliationSummary {
  const count = (value: number) => Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  return {
    claimed: count(summary.claimed),
    pending: count(summary.pending),
    reconciled: count(summary.reconciled),
    reportPending: count(summary.reportPending),
    failed: count(summary.failed),
    expired: count(summary.expired),
    unknown: count(summary.unknown),
    skipped: count(summary.skipped),
  };
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SchedulerTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

class SchedulerTimeoutError extends Error {}

export function createSchedulerHandler(options: {
  secret: string | undefined;
  run: SchedulerRunner;
  timeoutMs?: number;
  limitInvocation?: () => Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  networkProfile?: SolanaNetworkProfileName;
}) {
  return async (request: Request) => {
    const requestId = requestIdFor(request);
    const profile = options.networkProfile ?? 'mainnet';
    const startedAt = Date.now();
    const respond = (response: Response) => withRequestId(response, requestId);
    if (request.method !== 'POST') {
      return respond(NextResponse.json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, {
        status: 405,
        headers: { Allow: 'POST' },
      }));
    }
    if (!authorized(request, options.secret)) {
      return respond(NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 }));
    }
    try {
      const rateLimit = await options.limitInvocation?.();
      if (rateLimit && !rateLimit.allowed) {
        emitOperationalEvent({ event: 'api.rate_limit.denied', severity: 'warning', requestId,
          routeKey: 'internal.reconcile', networkProfile: profile, status: 'denied', durationMs: Date.now() - startedAt });
        return respond(NextResponse.json(
          { error: 'Too many requests', code: 'RATE_LIMITED' },
          { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
        ));
      }
      emitOperationalEvent({ event: 'reconciliation.started', severity: 'info', requestId,
        routeKey: 'internal.reconcile', networkProfile: profile, status: 'started', durationMs: 0 });
      const summary = await withTimeout(
        options.run(batchLimit(request)),
        options.timeoutMs ?? SCHEDULER_TIMEOUT_MS,
      );
      emitOperationalEvent({ event: 'reconciliation.completed', severity: 'info', requestId,
        routeKey: 'internal.reconcile', networkProfile: profile, status: 'completed', durationMs: Date.now() - startedAt });
      return respond(NextResponse.json(sanitizedSummary(summary)));
    } catch (error) {
      if (error instanceof RateLimitUnavailableError) {
        emitOperationalEvent({ event: 'api.rate_limit.unavailable', severity: 'error', requestId,
          routeKey: 'internal.reconcile', networkProfile: profile, status: 'unavailable', durationMs: Date.now() - startedAt });
      }
      emitOperationalEvent({
        event: error instanceof SchedulerTimeoutError ? 'reconciliation.timeout' : 'reconciliation.failed',
        severity: 'error', requestId, routeKey: 'internal.reconcile', networkProfile: profile,
        status: error instanceof SchedulerTimeoutError ? 'timeout' : 'failed', durationMs: Date.now() - startedAt,
      });
      return respond(NextResponse.json({
        error: 'Reconciliation unavailable', code: 'RECONCILIATION_UNAVAILABLE',
      }, { status: 503 }));
    }
  };
}
