import type { SolanaNetworkProfileName } from './networkProfile';

export type TransactionKind = 'deposit' | 'withdraw';
export type SubmissionStatus =
  | 'submitted'
  | 'pending'
  | 'unknown'
  | 'confirmed_unreported'
  | 'report_pending'
  | 'processing'
  | 'reconciled'
  | 'failed'
  | 'expired';

export interface SubmissionRecord {
  networkProfile: SolanaNetworkProfileName;
  signature: string;
  userId: string;
  walletAddress: string;
  kind: TransactionKind;
  blockhash: string;
  lastValidBlockHeight: number;
  status: SubmissionStatus;
  submittedAt: Date;
  confirmedAt: Date | null;
  reportedAt: Date | null;
  attemptCount: number;
  nextAttemptAt: Date;
  lastErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  reclaimedStale?: boolean;
}

export interface TrackSubmissionInput {
  networkProfile: SolanaNetworkProfileName;
  signature: string;
  walletAddress: string;
  kind: TransactionKind;
  blockhash: string;
  lastValidBlockHeight: number;
}

export const UNRESOLVED_SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
  'submitted', 'pending', 'unknown', 'confirmed_unreported', 'report_pending', 'processing',
];
