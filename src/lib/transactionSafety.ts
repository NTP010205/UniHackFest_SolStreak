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
  if (!input.rpcConfigured) {
    return { enabled: false, reason: 'Solana RPC configuration is not ready.' };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { enabled: false, reason: 'Enter an amount greater than 0 USDC.' };
  }
  if (input.pending) return { enabled: false, reason: 'A transaction is already pending.' };
  return { enabled: true, reason: null };
}
