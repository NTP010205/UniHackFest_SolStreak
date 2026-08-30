'use client';

import { useEffect, useState } from 'react';
import { useSignMessage } from '@privy-io/react-auth/solana';
import type { ConnectedStandardSolanaWallet } from '@privy-io/react-auth/solana';

import { truncateAddress } from '@/lib/format';

interface Props {
  ready: boolean;
  authenticated: boolean;
  wallet: ConnectedStandardSolanaWallet | undefined;
}

type SigningState = 'idle' | 'signing' | 'success' | 'error';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default function PrivyVerification({ ready, authenticated, wallet }: Props) {
  const { signMessage } = useSignMessage();
  const [hostname, setHostname] = useState<string | null>(null);
  const [signingState, setSigningState] = useState<SigningState>('idle');
  const [result, setResult] = useState('No test message signed in this session.');

  useEffect(() => setHostname(window.location.hostname), []);

  const localhost = hostname !== null && LOCAL_HOSTS.has(hostname);
  const canSign = ready && authenticated && wallet !== undefined && localhost;

  async function signTestMessage() {
    if (!canSign || !wallet || !hostname) return;

    setSigningState('signing');
    setResult('Waiting for Privy wallet approval…');
    const timestamp = new Date().toISOString();
    const message = [
      'SolStreak authentication test',
      `Hostname: ${hostname}`,
      `Timestamp: ${timestamp}`,
      `Nonce: ${randomNonce()}`,
    ].join('\n');

    try {
      await signMessage({
        message: new TextEncoder().encode(message),
        wallet,
        options: { uiOptions: { title: 'Verify your SolStreak wallet' } },
      });
      setSigningState('success');
      setResult(`Message signed successfully at ${timestamp}.`);
    } catch {
      setSigningState('error');
      setResult('Message signing failed or was cancelled. No transaction was sent.');
    }
  }

  return (
    <section className="rounded-2xl border border-sky-400/20 bg-sky-500/5 p-5" aria-label="Privy verification">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-white">Privy verification</h2>
          <p className="mt-1 text-xs text-slate-400">
            Development-only message signature gate. This does not create or send a transaction.
          </p>
        </div>
        <button
          type="button"
          disabled={!canSign || signingState === 'signing'}
          onClick={() => void signTestMessage()}
          className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-semibold text-night-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {signingState === 'signing' ? 'Signing…' : 'Sign test message'}
        </button>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-500">Ready</dt>
          <dd className="mt-1 text-slate-200">{ready ? 'true' : 'false'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Authenticated</dt>
          <dd className="mt-1 text-slate-200">{authenticated ? 'true' : 'false'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Embedded Solana wallet</dt>
          <dd className="mt-1 font-mono text-xs text-slate-200" title={wallet?.address}>
            {wallet ? truncateAddress(wallet.address, 6, 6) : 'Not available'}
          </dd>
        </div>
      </dl>

      <p
        className={`mt-4 text-xs ${signingState === 'error' ? 'text-red-300' : signingState === 'success' ? 'text-emerald-300' : 'text-slate-400'}`}
        role="status"
      >
        {!localhost && hostname !== null ? 'Message signing is restricted to localhost. ' : ''}
        {result}
      </p>
    </section>
  );
}
