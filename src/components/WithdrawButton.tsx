'use client';

import Spinner from './Spinner';

interface Props {
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
}

/**
 * Withdraws from the Jupiter Earn position back to the embedded wallet.
 * No streak report is sent — only deposits extend a streak.
 */
export default function WithdrawButton({ onClick, busy, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-semibold text-night-950 shadow-glow-emerald transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
    >
      {busy ? (
        <>
          <Spinner className="h-4 w-4" />
          Working…
        </>
      ) : (
        <>
          <span aria-hidden="true">⬇</span> Withdraw
        </>
      )}
    </button>
  );
}
