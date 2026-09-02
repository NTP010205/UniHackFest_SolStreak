import type { BlockhashLifetime } from './transactionLifecycle';
import type { SolanaNetworkProfileName } from './networkProfile';
import type { TransactionKind } from './submissions';

export interface PendingSubmissionReference extends BlockhashLifetime {
  networkProfile: SolanaNetworkProfileName;
  signature: string;
  wallet: string;
  kind: TransactionKind;
}

const KEY = 'solstreak:pending-submissions:v1';

function read(): PendingSubmissionReference[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is PendingSubmissionReference =>
      !!item && typeof item === 'object' &&
      typeof (item as PendingSubmissionReference).signature === 'string' &&
      typeof (item as PendingSubmissionReference).wallet === 'string' &&
      typeof (item as PendingSubmissionReference).blockhash === 'string' &&
      Number.isSafeInteger((item as PendingSubmissionReference).lastValidBlockHeight) &&
      ['deposit', 'withdraw'].includes((item as PendingSubmissionReference).kind) &&
      ['mainnet', 'devnet'].includes((item as PendingSubmissionReference).networkProfile)
    ) : [];
  } catch { return []; }
}

export function pendingSubmissionReferences(wallet: string, networkProfile: SolanaNetworkProfileName, kind?: TransactionKind) {
  return read().filter((item) => item.wallet === wallet && item.networkProfile === networkProfile && (!kind || item.kind === kind));
}

export function savePendingSubmission(reference: PendingSubmissionReference) {
  if (typeof localStorage === 'undefined') return;
  const rest = read().filter((item) => !(item.networkProfile === reference.networkProfile && item.signature === reference.signature));
  localStorage.setItem(KEY, JSON.stringify([...rest, reference]));
}

export function removePendingSubmission(networkProfile: SolanaNetworkProfileName, signature: string) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(read().filter((item) =>
    item.networkProfile !== networkProfile || item.signature !== signature
  )));
}
