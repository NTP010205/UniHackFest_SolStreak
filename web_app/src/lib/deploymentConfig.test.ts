import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryFile = (path: string) => readFileSync(
  fileURLToPath(new URL(`../../../${path}`, import.meta.url)),
  'utf8',
);

describe('Render release configuration', () => {
  const blueprint = repositoryFile('render.yaml');
  const readme = repositoryFile('README.md');
  const environmentExample = repositoryFile('web_app/.env.local.example');

  it('deploys the full Next.js application as a Node web service', () => {
    expect(blueprint).toContain('type: web');
    expect(blueprint).toContain('runtime: node');
    expect(blueprint).toContain('rootDir: web_app');
    expect(blueprint).toContain('buildCommand: npm ci && npm run build -- --webpack');
    expect(blueprint).toContain('startCommand: npm start');
  });

  it('pins the reviewed release to Devnet and keeps Mainnet disabled', () => {
    expect(blueprint).toMatch(/NEXT_PUBLIC_SOLANA_NETWORK_PROFILE\n\s+value: devnet/);
    expect(blueprint).toMatch(/NEXT_PUBLIC_ENABLE_DEVNET_TRANSACTIONS\n\s+value: "true"/);
    expect(blueprint).toMatch(/NEXT_PUBLIC_ENABLE_MAINNET_TRANSACTIONS\n\s+value: "false"/);
  });

  it('requires deployment secrets without committing their values', () => {
    for (const key of [
      'DATABASE_URL',
      'NEXT_PUBLIC_PRIVY_APP_ID',
      'NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL',
      'NEXT_PUBLIC_SOLANA_DEVNET_RPC_SUBSCRIPTIONS_URL',
      'SOLANA_DEVNET_RPC_URL',
      'SOLSTREAK_ADMIN_PRIVY_USER_IDS',
      'SOLSTREAK_ADMIN_WALLET_ADDRESSES',
      'RECONCILIATION_SECRET',
    ]) {
      expect(blueprint).toMatch(new RegExp(`key: ${key}\\n\\s+sync: false`));
    }
    expect(blueprint).not.toContain('SOLSTREAK_REHEARSAL_DATABASE_URL');
    expect(blueprint).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect(environmentExample).toMatch(/^RECONCILIATION_SECRET=$/m);
  });

  it('documents the actual hosted infrastructure and operating flow', () => {
    expect(readme).toContain('## How SolStreak Works');
    expect(readme).toContain('## Infrastructure');
    expect(readme).toContain('Supabase PostgreSQL');
    expect(readme).toContain('Privy React SDK');
    expect(readme).toContain('## Deploying to Render');
  });
});
