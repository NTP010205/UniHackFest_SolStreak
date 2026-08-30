import { describe, expect, it, vi } from 'vitest';

import { cleanupExpiredRateLimitBuckets, RATE_LIMIT_CLEANUP_MAX_BATCH } from './rateLimitMaintenance';

describe('rate-limit maintenance', () => {
  it('uses an indexed cutoff, a bounded batch, and returns only the deleted count', async () => {
    const calls: { text: string; values: unknown[] }[] = [];
    const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ text: strings.join('?'), values });
      return [{ deleted: 7 }];
    }) as never;
    await expect(cleanupExpiredRateLimitBuckets(sql, {
      now: new Date('2026-08-30T12:00:00.000Z'), batch: 50_000,
    })).resolves.toEqual({ deleted: 7 });
    expect(calls[0].text).toContain('WHERE window_start <');
    expect(calls[0].text).toContain('FOR UPDATE SKIP LOCKED');
    expect(calls[0].text).toContain('LIMIT');
    expect(calls[0].values).toContainEqual(new Date('2026-08-29T12:00:00.000Z'));
    expect(calls[0].values).toContain(RATE_LIMIT_CLEANUP_MAX_BATCH);
  });

  it('is safe to call concurrently and propagates cleanup failure to its caller', async () => {
    const sql = vi.fn(async () => [{ deleted: 0 }]) as never;
    await expect(Promise.all([
      cleanupExpiredRateLimitBuckets(sql), cleanupExpiredRateLimitBuckets(sql),
    ])).resolves.toEqual([{ deleted: 0 }, { deleted: 0 }]);
    const failing = vi.fn(async () => { throw new Error('database secret'); }) as never;
    await expect(cleanupExpiredRateLimitBuckets(failing)).rejects.toThrow();
  });
});
