import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { BADGE_CODES } from '../lib/wheel';

const api = readFileSync(new URL('../docs/api-contract.md', import.meta.url), 'utf8');
const handoff = readFileSync(new URL('../docs/frontend-handoff.md', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

function routePaths(root = new URL('../app/api/', import.meta.url), prefix = '/api'): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    if (!entry.isDirectory()) return [];
    const child = new URL(`${entry.name}/`, root);
    const route = new URL('route.ts', child);
    try { readFileSync(route); return [`${prefix}/${entry.name}`]; }
    catch { return routePaths(child, `${prefix}/${entry.name}`); }
  });
}

describe('frontend handoff documentation contract', () => {
  it('documents every API route file', () => {
    for (const route of routePaths()) expect(api).toContain(route);
  });

  it('keeps the documented badge catalog aligned with source', () => {
    for (const code of BADGE_CODES) {
      expect(api).toContain(code);
      expect(handoff).toContain(code);
    }
    expect(api).not.toMatch(/\b(points|payout|redeemable|transferable|monetaryValue)\s*:/i);
  });

  it('marks reconciliation as internal and server/scheduler-only', () => {
    expect(api).toMatch(/\/api\/internal\/reconcile[^\n]*server\/scheduler only/i);
    expect(api).toContain('Frontend code must never call this route');
  });

  it('lists all required verification commands', () => {
    for (const command of [
      'npm test', 'npx tsc --noEmit', 'npm run build',
      'npm run test:reconciliation:integration', 'npm run test:scheduler:integration',
      'npm run test:api-perimeter:integration', 'npm run test:cosmetic-badges:integration',
    ]) expect(readme).toContain(command);
  });
});
