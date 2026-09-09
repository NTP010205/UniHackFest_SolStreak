'use client';

import { useState } from 'react';
import type { ConnectedStandardSolanaWallet } from '@privy-io/react-auth/solana';

import { useFundingReadiness } from '@/hooks/useFundingReadiness';
import { truncateAddress } from '@/lib/format';
import { copyEmbeddedWalletAddress } from '@/lib/walletClipboard';
import { ACTIVE_NETWORK } from '@/lib/networkProfile';

export default function FundingReadiness({ wallet, className = '' }: {
  wallet: ConnectedStandardSolanaWallet;
  className?: string;
}) {
  const { balances, loading, error, updatedAt, refresh } = useFundingReadiness(wallet.address);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  async function copyAddress() {
    try {
      await copyEmbeddedWalletAddress(wallet, (value) => navigator.clipboard.writeText(value));
      setCopyStatus('Address copied');
    } catch {
      setCopyStatus('Unable to copy address. Please copy it manually.');
    }
  }

  return (
    <section className={`rounded-2xl border border-white/5 bg-white/[0.03] p-5 shadow-card sm:p-6 ${className}`} aria-labelledby="funding-readiness-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="funding-readiness-title" className="font-display text-lg font-semibold text-white">Funding readiness</h2>
          <p className="mt-1 text-xs text-slate-500">Read-only wallet details for the active network profile.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Refreshing…' : 'Refresh balances'}
        </button>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <div><dt className="text-xs text-slate-500">Network</dt><dd className="mt-1 text-sm text-slate-200">{ACTIVE_NETWORK.label}</dd>{ACTIVE_NETWORK.name === 'devnet' && <p className="mt-1 text-xs font-semibold text-amber-300">No financial value</p>}</div>
        <div><dt className="text-xs text-slate-500">SOL balance</dt><dd className="mt-1 font-mono text-sm text-slate-200">{balances ? `${balances.sol} SOL` : '—'}</dd></div>
        <div><dt className="text-xs text-slate-500">USDC balance</dt><dd className="mt-1 font-mono text-sm text-slate-200">{balances ? `${balances.usdc} USDC` : '—'}</dd></div>
      </dl>

      <div className="mt-4 rounded-xl border border-white/5 bg-night-950/50 p-4">
        <p className="text-xs text-slate-500">Embedded Privy Solana wallet</p>
        <code className="mt-1 block break-all font-mono text-xs text-slate-200" title={wallet.address}>{wallet.address}</code>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void copyAddress()} className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white">
            Copy address
          </button>
          <span className="font-mono text-xs text-slate-500">{truncateAddress(wallet.address, 6, 6)}</span>
          {copyStatus && <span className="text-xs text-slate-300" role="status">{copyStatus}</span>}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-amber-200" role="alert">⚠ {error}</p>}
      <p className="mt-4 text-xs text-slate-500" aria-live="polite">
        Last updated: {updatedAt ? updatedAt.toLocaleString() : 'Not yet updated'}
      </p>
      {ACTIVE_NETWORK.name === 'devnet' && (
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <a href="https://faucet.solana.com/" target="_blank" rel="noreferrer" className="font-semibold text-cyan-300 underline underline-offset-4">Get Devnet SOL ↗</a>
          <a href="https://faucet.circle.com/" target="_blank" rel="noreferrer" className="font-semibold text-violet-300 underline underline-offset-4">Get Circle Devnet USDC ↗</a>
        </div>
      )}
    </section>
  );
}
