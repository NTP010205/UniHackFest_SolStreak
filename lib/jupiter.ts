import {
  getDepositIxs,
  getUserLendingPositionByAsset,
  getWithdrawIxs,
} from '@jup-ag/lend/earn';
import BN from 'bn.js';
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import { fromBaseUnits, toBaseUnits } from './decimals';
import { ACTIVE_NETWORK, assertRpcCluster } from './networkProfile';
import { buildDevnetEarnTransaction, buildDevnetFullWithdrawTransaction, getDevnetEarnPosition } from './jupiterDevnet';
import { assertDevnetEarnOperational } from './jupiterDevnetAccounts';

// Jupiter Earn currently documents its USDC flow on mainnet. Keep the mint
// configurable for controlled test environments, but default to canonical
// mainnet USDC so a production deployment does not build unusable devnet ixs.
export const USDC_MINT = new PublicKey(
  ACTIVE_NETWORK.usdcMint,
);

// NOTE: this SDK version (0.2.x) has no `cluster` option — the chain is
// whatever RPC endpoint the connection points at. The roadmap's Phase 0
// devnet question therefore reduces to: point NEXT_PUBLIC_SOLANA_RPC_URL at a
// configured RPC endpoint that has usable Jupiter Lend liquidity.
async function assemble(
  userPubkey: PublicKey,
  ixs: TransactionInstruction[],
  blockhash: string,
): Promise<VersionedTransaction> {
  const message = new TransactionMessage({
    payerKey: userPubkey,
    recentBlockhash: blockhash,
    instructions: ixs,
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

export async function buildDepositTx(
  userPubkey: PublicKey,
  amountUsdc: number,
  connection: Connection,
  blockhash: string,
) {
  if (ACTIVE_NETWORK.name === 'devnet') return buildDevnetEarnTransaction('deposit', userPubkey, amountUsdc, connection, blockhash, ACTIVE_NETWORK);
  const { ixs } = await getDepositIxs({
    amount: new BN(toBaseUnits(amountUsdc).toString()),
    asset: USDC_MINT,
    signer: userPubkey,
    connection,
  });
  return assemble(userPubkey, ixs, blockhash);
}

export async function buildWithdrawTx(
  userPubkey: PublicKey,
  amountUsdc: number,
  connection: Connection,
  blockhash: string,
) {
  if (ACTIVE_NETWORK.name === 'devnet') {
    return (await buildDevnetFullWithdrawTransaction(userPubkey, connection, blockhash, ACTIVE_NETWORK)).transaction;
  }
  const { ixs } = await getWithdrawIxs({
    amount: new BN(toBaseUnits(amountUsdc).toString()),
    asset: USDC_MINT,
    signer: userPubkey,
    connection,
  });
  return assemble(userPubkey, ixs, blockhash);
}

/** Current redeemable Jupiter Earn position, including accrued variable yield. */
export async function getJupiterPositionUsdc(userPubkey: PublicKey): Promise<number> {
  const rpcUrl = ACTIVE_NETWORK.rpcUrl;
  if (!rpcUrl) throw new Error('RPC is not configured');
  const connection = new Connection(rpcUrl, 'confirmed');
  await assertRpcCluster(connection);
  if (ACTIVE_NETWORK.name === 'devnet') {
    await assertDevnetEarnOperational(connection, ACTIVE_NETWORK);
    const position = await getDevnetEarnPosition(connection, userPubkey, ACTIVE_NETWORK);
    return fromBaseUnits(position.underlyingAssets);
  }
  const position = await getUserLendingPositionByAsset({
    user: userPubkey,
    asset: USDC_MINT,
    connection,
    market: 'main',
  });
  return fromBaseUnits(BigInt(position.underlyingAssets.toString()));
}
