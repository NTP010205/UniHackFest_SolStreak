import { describe, expect, it, vi } from 'vitest';

import { createBoundedClientFactory, DATABASE_POOL_MAX_CONNECTIONS } from './db';

describe('shared bounded database client', () => {
  it('creates one bounded pool and reuses it across requests', () => {
    const pool = { id: 'shared' };
    const create = vi.fn(() => pool);
    const getClient = createBoundedClientFactory(create);
    expect(getClient('postgres://rehearsal', true)).toBe(pool);
    expect(getClient('postgres://rehearsal', true)).toBe(pool);
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith('postgres://rehearsal', expect.objectContaining({
      max: DATABASE_POOL_MAX_CONNECTIONS,
      ssl: 'require',
    }));
    expect(DATABASE_POOL_MAX_CONNECTIONS).toBeLessThan(15);
  });
});
