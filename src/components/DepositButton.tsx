'use client';

import Spinner from './Spinner';

interface Props {
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
}

/**
 * Executes the deposit flow owned by useVaultTransaction('deposit'):
 * buildDepositTx → Privy signTransaction → send → confirm → report.
 * Purely presentational — all state lives in the hook.
 */
export default function DepositButton({ onClick, busy, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-glow-violet transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
    >
      {busy ? (
        <>
          <Spinner className="h-4 w-4" />
          Working…
        </>
      ) : (
        <>
          <span aria-hidden="true">⬆</span> Deposit
        </>
      )}
    </button>
  );
}
