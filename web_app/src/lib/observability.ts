import { randomUUID } from 'node:crypto';

import type { SolanaNetworkProfileName } from './networkProfile';

export const OPERATIONAL_EVENT_NAMES = [
  'api.rate_limit.denied', 'api.rate_limit.unavailable',
  'reconciliation.started', 'reconciliation.completed', 'reconciliation.failed',
  'reconciliation.stale_claim', 'reconciliation.timeout',
  'rpc.request.failed', 'rpc.rate_limited', 'rpc.genesis_mismatch',
  'database.unavailable',
  'badge.awarded', 'badge.replayed', 'badge.failed',
  'welcome_spin.granted', 'welcome_spin.consumed',
] as const;

export type OperationalEventName = typeof OPERATIONAL_EVENT_NAMES[number];
export type OperationalSeverity = 'info' | 'warning' | 'error';

export interface OperationalEvent {
  event: OperationalEventName;
  timestamp: string;
  severity: OperationalSeverity;
  requestId: string;
  routeKey: string;
  networkProfile: SolanaNetworkProfileName;
  status: string;
  durationMs: number;
}

type EventSink = (event: OperationalEvent) => void;
let sink: EventSink = event => console.log(JSON.stringify(event));

export function setOperationalEventSinkForTests(next?: EventSink) {
  sink = next ?? (event => console.log(JSON.stringify(event)));
}

export function emitOperationalEvent(input: Omit<OperationalEvent, 'timestamp' | 'durationMs'> & {
  timestamp?: Date;
  durationMs?: number;
}) {
  const event: OperationalEvent = {
    event: input.event,
    timestamp: (input.timestamp ?? new Date()).toISOString(),
    severity: input.severity,
    requestId: safeRequestId(input.requestId),
    routeKey: input.routeKey,
    networkProfile: input.networkProfile,
    status: input.status,
    durationMs: Math.max(0, Math.trunc(input.durationMs ?? 0)),
  };
  sink(event);
  return event;
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,80}$/;
export function safeRequestId(candidate?: string | null) {
  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
}

export function requestIdFor(request: Request) {
  return safeRequestId(request.headers.get('x-request-id'));
}

export function withRequestId(response: Response, requestId: string) {
  response.headers.set('x-request-id', requestId);
  return response;
}

export function safeErrorStatus(error: unknown) {
  if (error && typeof error === 'object' && (
    ('status' in error && Number((error as { status?: unknown }).status) === 429) ||
    ('code' in error && String((error as { code?: unknown }).code) === '429') ||
    ('message' in error && /(?:^|\D)429(?:\D|$)/.test(String((error as { message?: unknown }).message)))
  )) {
    return 'rate_limited';
  }
  return 'unavailable';
}
