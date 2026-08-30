import { afterEach, describe, expect, it } from 'vitest';

import { emitOperationalEvent, requestIdFor, setOperationalEventSinkForTests, withRequestId } from './observability';

describe('operational observability contract', () => {
  afterEach(() => setOperationalEventSinkForTests());

  it('emits only the fixed safe schema', () => {
    const events: unknown[] = [];
    setOperationalEventSinkForTests(event => events.push(event));
    const event = emitOperationalEvent({ event: 'rpc.request.failed', severity: 'error', requestId: 'request_1234',
      routeKey: 'rpc.status', networkProfile: 'devnet', status: 'unavailable', durationMs: 12.9 });
    expect(event).toMatchObject({ event: 'rpc.request.failed', requestId: 'request_1234', durationMs: 12 });
    expect(Object.keys(event).sort()).toEqual([
      'durationMs', 'event', 'networkProfile', 'requestId', 'routeKey', 'severity', 'status', 'timestamp',
    ]);
    expect(JSON.stringify(events)).not.toContain('token');
    expect(JSON.stringify(events)).not.toContain('postgres://');
  });

  it('propagates only safe request IDs and creates a replacement otherwise', () => {
    const safe = requestIdFor(new Request('http://local', { headers: { 'x-request-id': 'client-request_123' } }));
    expect(safe).toBe('client-request_123');
    const unsafe = requestIdFor(new Request('http://local', { headers: { 'x-request-id': 'secret bearer value' } }));
    expect(unsafe).not.toContain('secret');
    const response = withRequestId(new Response('ok'), safe);
    expect(response.headers.get('x-request-id')).toBe(safe);
  });
});
