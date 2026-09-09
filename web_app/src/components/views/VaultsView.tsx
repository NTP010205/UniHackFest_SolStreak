'use client';

import TransactionCard from '@/components/TransactionCard';
import FundingReadiness from '@/components/FundingReadiness';
import type { ConnectedStandardSolanaWallet } from '@privy-io/react-auth/solana';

export function VaultsView({ wallet, walletVerified, onTransactionComplete }: {
  wallet: ConnectedStandardSolanaWallet;
  walletVerified: boolean;
  onTransactionComplete: () => void;
}) {
  return <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]"><FundingReadiness wallet={wallet} /><div className="lg:mt-6"><TransactionCard walletVerified={walletVerified} onTransactionComplete={onTransactionComplete} /></div></div>;
}
