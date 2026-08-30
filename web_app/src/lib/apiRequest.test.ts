import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ApiRequestError, parseJsonBody, parseWalletQuery } from './apiRequest';

const schema = z.object({ wallet: z.string() }).strict();

describe('API request perimeter', () => {
  it('requires JSON content type, valid JSON, bounded bodies, and known fields', async () => {
    await expect(parseJsonBody(new Request('http://localhost', {
      method: 'POST', body: '{}',
    }), schema)).rejects.toMatchObject({ status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' });
    await expect(parseJsonBody(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
    }), schema)).rejects.toMatchObject({ status: 400, code: 'INVALID_JSON' });
    await expect(parseJsonBody(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wallet: 'ok', unknown: true }),
    }), schema)).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    await expect(parseJsonBody(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wallet: 'x'.repeat(5_000) }),
    }), schema)).rejects.toMatchObject({ status: 413, code: 'BODY_TOO_LARGE' });
  });

  it('rejects unknown or duplicate GET parameters', () => {
    expect(() => parseWalletQuery(
      new Request('http://localhost?wallet=one&extra=x'), z.string(),
    )).toThrow(ApiRequestError);
    expect(() => parseWalletQuery(
      new Request('http://localhost?wallet=one&wallet=two'), z.string(),
    )).toThrow(ApiRequestError);
  });
});
