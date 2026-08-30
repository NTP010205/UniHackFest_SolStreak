import { describe, expect, it } from 'vitest';
import { getTransactionGate, type TransactionGateInput } from './transactionSafety';

const valid: TransactionGateInput = {
  featureEnabled: true,
  privyReady: true,
  authenticated: true,
  hasEmbeddedWallet: true,
  rpcConfigured: true,
  amount: 1,
  pending: false,
};

describe('transaction safety gate', () => {
  it.each([
    ['missing RPC', { rpcConfigured: false }],
    ['disabled feature flag', { featureEnabled: false }],
    ['unauthenticated user', { authenticated: false }],
    ['missing embedded wallet', { hasEmbeddedWallet: false }],
    ['invalid zero amount', { amount: 0 }],
    ['invalid NaN amount', { amount: Number.NaN }],
  ])('blocks %s', (_name, override) => {
    expect(getTransactionGate({ ...valid, ...override }).enabled).toBe(false);
  });

  it('allows only a fully ready request', () => {
    expect(getTransactionGate(valid)).toEqual({ enabled: true, reason: null });
  });
});
