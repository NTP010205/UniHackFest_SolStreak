import { ACTIVE_NETWORK, ACTIVE_RPC_CONFIGURED, NETWORK_CONFIGURATION_ERROR } from './networkProfile';

export const MAINNET_TRANSACTIONS_ENABLED = ACTIVE_NETWORK.transactionsEnabled;
export const SOLANA_RPC_URL = ACTIVE_NETWORK.rpcUrl;
export const SOLANA_RPC_SUBSCRIPTIONS_URL = ACTIVE_NETWORK.rpcSubscriptionsUrl;
export const SOLANA_RPC_CONFIGURED = ACTIVE_RPC_CONFIGURED && !NETWORK_CONFIGURATION_ERROR;

export interface TransactionGateInput {
  featureEnabled: boolean;
  privyReady: boolean;
  authenticated: boolean;
  hasEmbeddedWallet: boolean;
  walletVerified: boolean;
  rpcConfigured: boolean;
  amount: number;
  pending: boolean;
}

export interface TransactionGate {
  enabled: boolean;
  reason: string | null;
}

export function getTransactionGate(input: TransactionGateInput): TransactionGate {
  if (!input.featureEnabled) {
    return { enabled: false, reason: `${ACTIVE_NETWORK.name === 'devnet' ? 'Devnet' : 'Mainnet'} transactions are currently disabled.` };
  }
  if (!input.privyReady) return { enabled: false, reason: 'Privy is still initializing.' };
  if (!input.authenticated) return { enabled: false, reason: 'Sign in to continue.' };
  if (!input.hasEmbeddedWallet) {
    return { enabled: false, reason: 'Your embedded Solana wallet is not ready.' };
  }
  if (!input.walletVerified) {
    return { enabled: false, reason: 'Verify this wallet before starting a transaction.' };
  }
  if (!input.rpcConfigured) {
    return { enabled: false, reason: 'Solana RPC configuration is not ready.' };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { enabled: false, reason: 'Enter an amount greater than 0 USDC.' };
  }
  if (input.pending) return { enabled: false, reason: 'A transaction is already pending.' };
  return { enabled: true, reason: null };
}

/** Convert wallet/RPC errors into stable UI messages without leaking raw logs or URLs. */
export function safeTransactionError(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error ?? '');
  const normalized = value.toLowerCase();
  if (normalized.includes('circle devnet usdc token account')) {
    return 'This wallet has no Circle Devnet USDC token account. Get Devnet USDC, refresh balances, and try again.';
  }
  if (normalized.includes('not enough circle devnet usdc') || normalized.includes('insufficient funds')) {
    return 'This wallet does not have enough Devnet USDC or SOL for this transaction.';
  }
  if (normalized.includes('no devnet ftoken position')) {
    return 'No Devnet Jupiter position is available to withdraw. Deposit Devnet USDC first.';
  }
  if (normalized.includes('accountnotinitialized') || normalized.includes('0xbc4')) {
    return 'A required Devnet token account is missing. Refresh balances and obtain Circle Devnet USDC before trying again.';
  }
  if (normalized.includes('reject') || normalized.includes('cancel') || normalized.includes('denied')) {
    return 'The wallet signature request was cancelled. No transaction was sent.';
  }
  return 'The transaction could not be prepared safely. Refresh balances and try again.';
}
