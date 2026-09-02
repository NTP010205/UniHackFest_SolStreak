'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useVaultTransaction } from '@/hooks/useVaultTransaction';
import { ACTIVE_NETWORK, NETWORK_CONFIGURATION_ERROR, transactionExplorerUrl } from '@/lib/networkProfile';

import DepositButton from './DepositButton';
import Spinner from './Spinner';
import WithdrawButton from './WithdrawButton';
import { VideoOverlay } from './ui/VideoOverlay';

const QUICK_AMOUNTS = [1, 5, 10, 25];

interface Props {
  /** Called after a confirmed transaction so the dashboard can refetch. */
  onTransactionComplete?: () => void;
}

/**
 * The deposit/withdraw interface. The card owns both transaction hooks;
 * the buttons are presentational. A single status area surfaces the active
 * phase label, the confirmed signature (explorer link), or the error —
 * so the user always sees exactly where their transaction is.
 */
export default function TransactionCard({ onTransactionComplete }: Props) {
  const [amount, setAmount] = useState('');
  const [showDepositAnimation, setShowDepositAnimation] = useState(false);
  const previousDepositPhase = useRef<string>('idle');

  const deposit = useVaultTransaction('deposit', onTransactionComplete);
  const withdraw = useVaultTransaction('withdraw', onTransactionComplete);

  useEffect(() => {
    if (deposit.phase === 'confirmed' && previousDepositPhase.current !== 'confirmed') {
      setShowDepositAnimation(true);
    }
    previousDepositPhase.current = deposit.phase;
  }, [deposit.phase]);

  const finishDepositAnimation = useCallback(() => setShowDepositAnimation(false), []);

  const parsedAmount = Number.parseFloat(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const anyBusy = deposit.busy || withdraw.busy;
  const transactionsLocked = deposit.locked || withdraw.locked;

  const active = deposit.busy ? deposit : withdraw.busy ? withdraw : null;
  const terminal = ['report_pending', 'failed', 'expired', 'unknown'].includes(deposit.phase)
    ? deposit
    : ['report_pending', 'failed', 'expired', 'unknown'].includes(withdraw.phase)
      ? withdraw
      : null;
  const error = deposit.error ?? withdraw.error;
  const showSuccess = (deposit.phase === 'confirmed' || withdraw.phase === 'confirmed') && !error;
  const configurationMessage = !deposit.availability.rpcConfigured
    ? 'Solana RPC configuration is not ready. Deposit/Withdraw are locked.'
    : !deposit.availability.featureEnabled
      ? `${ACTIVE_NETWORK.name === 'devnet' ? 'Devnet' : 'Mainnet'} Deposit/Withdraw are disabled by the safety flag.`
      : null;

  const explorerUrl = useMemo(() => {
    const sig = deposit.signature ?? withdraw.signature;
    if (!sig) return null;
    return transactionExplorerUrl(sig);
  }, [deposit.signature, withdraw.signature]);

  return (
    <>
    {showDepositAnimation && (
      <VideoOverlay
        src="/assets/animations/Deposit_Success.webm"
        label="Deposit successful"
        onEnded={finishDepositAnimation}
      />
    )}
    <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 shadow-card sm:p-6">
      <h2 className="font-display text-lg font-semibold text-white">Deposit &amp; Withdraw</h2>
      <span className="mt-2 inline-flex rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-violet-200">{ACTIVE_NETWORK.name}</span>
      <p className="mt-1 text-xs text-slate-500">
        Funds move directly between your wallet and Jupiter Earn — you stay in control at every step.
      </p>

      {configurationMessage && (
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="status">
          ⚠ {configurationMessage}
        </div>
      )}
      {NETWORK_CONFIGURATION_ERROR && <div className="mt-3 text-sm text-red-200" role="alert">{NETWORK_CONFIGURATION_ERROR}</div>}

      <label htmlFor="usdc-amount" className="mt-5 block text-sm font-medium text-slate-300">
        Amount
      </label>
      <div className="relative mt-1.5">
        <input
          id="usdc-amount"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.1"
          placeholder="0.00"
          value={amount}
          disabled={transactionsLocked}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-night-950/60 px-4 py-3 pr-16 font-mono text-lg text-white placeholder:text-slate-600 focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
          USDC
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((v) => (
          <button
            key={v}
            type="button"
            disabled={transactionsLocked}
            onClick={() => setAmount(String(v))}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-xs font-medium text-slate-300 transition hover:border-violet-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            +{v}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <DepositButton
          onClick={() => deposit.execute(parsedAmount)}
          busy={deposit.busy}
          disabled={!amountValid || transactionsLocked || Boolean(configurationMessage)}
        />
        <WithdrawButton
          onClick={() => withdraw.execute(parsedAmount)}
          busy={withdraw.busy}
          disabled={!amountValid || transactionsLocked || Boolean(configurationMessage)}
        />
      </div>

      {/* In-flight status */}
      {active && active.statusLabel && (
        <div
          className="mt-4 flex items-center gap-2.5 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-200"
          role="status"
          aria-live="polite"
        >
          <Spinner className="h-4 w-4 shrink-0" />
          {active.statusLabel}… please keep this tab open.
        </div>
      )}

      {/* Success — confirmed signature with explorer link */}
      {showSuccess && !active && explorerUrl && (
        <div
          className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          role="status"
        >
          ✓ Transaction confirmed
          {deposit.phase === 'confirmed' ? ' — your streak has been updated.' : '.'}{' '}
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-2"
          >
            View on Solana Explorer
          </a>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          ⚠ {error}
          {deposit.phase === 'report_pending' && (
            <button type="button" onClick={() => void deposit.retryReport()} className="ml-2 font-medium underline underline-offset-2">
              Retry report only
            </button>
          )}
        </div>
      )}
      {terminal && (
        <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500" aria-live="polite">
          Lifecycle state: {terminal.phase.replace('_', ' ')}
          {terminal.signature ? ` · ${terminal.signature.slice(0, 8)}…` : ''}
        </p>
      )}
    </section>
    </>
  );
}
