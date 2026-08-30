import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type Connection,
} from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';

import { buildDevnetEarnInstructions, buildDevnetFullWithdrawInstructions } from './jupiterDevnet';
import { resolveNetworkProfile, type SolanaNetworkProfile } from './networkProfile';
import {
  verifyDepositWithConnection,
  verifyEarnTransactionWithConnection,
  verifyWithdrawalWithConnection,
} from './onchain';

const profile = resolveNetworkProfile({ NEXT_PUBLIC_SOLANA_NETWORK_PROFILE: 'devnet' }).profile;
const wallet = new PublicKey('6xcU1D3KHaxf1WCJUYFDcijypu4bhXC9Y4w7kmhs4tDp');
const blockhash = '11111111111111111111111111111111';

function tokenBalance(mint: string, owner: string, amount: bigint) {
  return { accountIndex: 0, mint, owner, uiTokenAmount: { amount: amount.toString(), decimals: 6 } };
}

function transactionFixture(kind: 'deposit' | 'withdraw', options: {
  failed?: boolean;
  profile?: SolanaNetworkProfile;
  unrelated?: boolean;
} = {}) {
  const fixtureProfile = options.profile ?? profile;
  const instructions = kind === 'deposit'
    ? buildDevnetEarnInstructions('deposit', wallet, 1, fixtureProfile)
    : buildDevnetFullWithdrawInstructions(wallet, 989_796n, fixtureProfile);
  if (options.unrelated) instructions[1].data[0] ^= 0xff;
  const transaction = new VersionedTransaction(new TransactionMessage({
    payerKey: wallet,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message());
  const liquidityIndex = transaction.message.staticAccountKeys.findIndex(
    (key) => key.toBase58() === fixtureProfile.liquidityProgram,
  );
  const preTokenBalances = kind === 'deposit'
    ? [tokenBalance(fixtureProfile.usdcMint, wallet.toBase58(), 20_000_000n)]
    : [
        tokenBalance(fixtureProfile.usdcMint, wallet.toBase58(), 19_000_000n),
        tokenBalance(fixtureProfile.fTokenMint, wallet.toBase58(), 989_796n),
      ];
  const postTokenBalances = kind === 'deposit'
    ? [
        tokenBalance(fixtureProfile.usdcMint, wallet.toBase58(), 19_000_000n),
        tokenBalance(fixtureProfile.fTokenMint, wallet.toBase58(), 989_796n),
      ]
    : [
        tokenBalance(fixtureProfile.usdcMint, wallet.toBase58(), 19_999_999n),
        tokenBalance(fixtureProfile.fTokenMint, wallet.toBase58(), 0n),
      ];
  const response = {
    blockTime: 1_777_000_000,
    transaction,
    meta: {
      err: options.failed ? { InstructionError: [1, 'Custom'] } : null,
      loadedAddresses: { writable: [], readonly: [] },
      innerInstructions: [{ index: 1, instructions: [{ programIdIndex: liquidityIndex, accounts: [], data: '' }] }],
      preTokenBalances,
      postTokenBalances,
    },
  };
  return {
    getGenesisHash: vi.fn().mockResolvedValue(fixtureProfile.genesisHash),
    getTransaction: vi.fn().mockResolvedValue(response),
  } as unknown as Connection;
}

describe('on-chain Jupiter Earn semantic verifier', () => {
  it('infers deposit from on-chain data and rejects a client withdraw declaration', async () => {
    const connection = transactionFixture('deposit');
    const verified = await verifyEarnTransactionWithConnection(connection, 'deposit-signature', wallet.toBase58(), profile);
    expect(verified).toMatchObject({
      kind: 'deposit', amountBaseUnits: 1_000_000n, fTokenDeltaBaseUnits: 989_796n,
    });
    expect(await verifyDepositWithConnection(connection, 'deposit-signature', wallet.toBase58(), profile)).not.toBeNull();
    expect(await verifyWithdrawalWithConnection(connection, 'deposit-signature', wallet.toBase58(), profile)).toBeNull();
  });

  it('infers withdraw from on-chain data and rejects a client deposit declaration', async () => {
    const connection = transactionFixture('withdraw');
    const verified = await verifyEarnTransactionWithConnection(connection, 'withdraw-signature', wallet.toBase58(), profile);
    expect(verified).toMatchObject({
      kind: 'withdraw', amountBaseUnits: 999_999n, fTokenDeltaBaseUnits: -989_796n,
    });
    expect(await verifyWithdrawalWithConnection(connection, 'withdraw-signature', wallet.toBase58(), profile)).not.toBeNull();
    expect(await verifyDepositWithConnection(connection, 'withdraw-signature', wallet.toBase58(), profile)).toBeNull();
  });

  it('rejects a confirmed unrelated transaction and a failed transaction', async () => {
    await expect(verifyEarnTransactionWithConnection(
      transactionFixture('deposit', { unrelated: true }), 'unrelated', wallet.toBase58(), profile,
    )).resolves.toBeNull();
    await expect(verifyEarnTransactionWithConnection(
      transactionFixture('deposit', { failed: true }), 'failed', wallet.toBase58(), profile,
    )).resolves.toBeNull();
  });

  it('rejects the right cluster with a wrong wallet, mint, or program', async () => {
    const connection = transactionFixture('deposit');
    await expect(verifyEarnTransactionWithConnection(
      connection, 'wrong-wallet', PublicKey.default.toBase58(), profile,
    )).resolves.toBeNull();
    await expect(verifyEarnTransactionWithConnection(
      connection, 'wrong-mint', wallet.toBase58(), { ...profile, usdcMint: PublicKey.default.toBase58() },
    )).resolves.toBeNull();
    await expect(verifyEarnTransactionWithConnection(
      connection, 'wrong-program', wallet.toBase58(), { ...profile, lendingProgram: PublicKey.default.toBase58() },
    )).resolves.toBeNull();
  });
});
