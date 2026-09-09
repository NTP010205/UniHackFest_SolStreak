import { describe, expect, it } from 'vitest';
import { getTransactionGate, safeTransactionError, type TransactionGateInput } from './transactionSafety';

const valid: TransactionGateInput = {
  featureEnabled: true,
  privyReady: true,
  authenticated: true,
  hasEmbeddedWallet: true,
  walletVerified: true,
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
    ['unverified wallet', { walletVerified: false }],
    ['invalid zero amount', { amount: 0 }],
    ['invalid NaN amount', { amount: Number.NaN }],
  ])('blocks %s', (_name, override) => {
    expect(getTransactionGate({ ...valid, ...override }).enabled).toBe(false);
  });

  it('allows only a fully ready request', () => {
    expect(getTransactionGate(valid)).toEqual({ enabled: true, reason: null });
  });

  it('redacts raw simulation logs into a stable readiness message', () => {
    const raw = new Error('Simulation failed at https://secret-rpc: custom program error: 0xbc4 AccountNotInitialized');
    const message = safeTransactionError(raw);
    expect(message).toMatch(/token account is missing/i);
    expect(message).not.toMatch(/secret-rpc|0xbc4|AccountNotInitialized/i);
  });

  it('explains user cancellation without exposing the provider error', () => {
    expect(safeTransactionError(new Error('Provider rejected request 4001')))
      .toBe('The wallet signature request was cancelled. No transaction was sent.');
  });
});
