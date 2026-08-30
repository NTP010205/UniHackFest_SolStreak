import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';

import { DEVNET_EARN_ACCOUNTS } from './jupiterDevnetAccounts';
import {
  ACTIVE_NETWORK,
  assertRpcCluster,
  type SolanaNetworkProfile,
  type SolanaNetworkProfileName,
} from './networkProfile';

const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
export const DEPOSIT_DISCRIMINATOR = Uint8Array.from([242, 35, 198, 137, 82, 225, 242, 182]);
export const WITHDRAW_DISCRIMINATOR = Uint8Array.from([183, 18, 70, 156, 148, 109, 161, 34]);

function hasExactInstructionData(data: Uint8Array, discriminator: Uint8Array) {
  return data.length === 16 && discriminator.every((byte, index) => data[index] === byte);
}

export interface VerifiedDeposit {
  signature: string;
  walletAddress: string;
  amountBaseUnits: bigint;
  blockTime: Date;
  networkProfile: SolanaNetworkProfileName;
}

export interface VerifiedWithdrawal extends VerifiedDeposit {}

export interface VerifiedEarnTransaction extends VerifiedDeposit {
  kind: 'deposit' | 'withdraw';
  fTokenDeltaBaseUnits: bigint;
}

function serverRpcUrl() {
  return ACTIVE_NETWORK.name === 'devnet'
    ? process.env.SOLANA_DEVNET_RPC_URL?.trim()
    : process.env.RPC_URL?.trim();
}

function walletTokenBalance(
  balances: { owner?: string; mint: string; uiTokenAmount: { amount: string } }[] | null | undefined,
  wallet: string,
  mint: string,
) {
  return (balances ?? [])
    .filter((balance) => balance.owner === wallet && balance.mint === mint)
    .reduce((sum, balance) => sum + BigInt(balance.uiTokenAmount.amount), 0n);
}

function ata(owner: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN_PROGRAM.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM,
  )[0].toBase58();
}

function expectedDevnetAccounts(kind: 'deposit' | 'withdraw', wallet: string, profile: SolanaNetworkProfile) {
  const owner = new PublicKey(wallet);
  const usdcAta = ata(owner, new PublicKey(profile.usdcMint));
  const fTokenAta = ata(owner, new PublicKey(profile.fTokenMint));
  const common = [DEVNET_EARN_ACCOUNTS.lendingAdmin.toBase58(), DEVNET_EARN_ACCOUNTS.lending.toBase58()];
  return kind === 'deposit' ? [
    wallet, usdcAta, fTokenAta, profile.usdcMint, ...common, profile.fTokenMint,
    DEVNET_EARN_ACCOUNTS.reserve.toBase58(), DEVNET_EARN_ACCOUNTS.supplyPosition.toBase58(),
    DEVNET_EARN_ACCOUNTS.rateModel.toBase58(), profile.earnVault, DEVNET_EARN_ACCOUNTS.liquidity.toBase58(),
    profile.liquidityProgram, DEVNET_EARN_ACCOUNTS.rewardsModel.toBase58(), TOKEN_PROGRAM.toBase58(),
    ASSOCIATED_TOKEN_PROGRAM.toBase58(), SystemProgram.programId.toBase58(),
  ] : [
    wallet, fTokenAta, usdcAta, ...common, profile.usdcMint, profile.fTokenMint,
    DEVNET_EARN_ACCOUNTS.reserve.toBase58(), DEVNET_EARN_ACCOUNTS.supplyPosition.toBase58(),
    DEVNET_EARN_ACCOUNTS.rateModel.toBase58(), profile.earnVault, DEVNET_EARN_ACCOUNTS.claimAccount.toBase58(),
    DEVNET_EARN_ACCOUNTS.liquidity.toBase58(), profile.liquidityProgram,
    DEVNET_EARN_ACCOUNTS.rewardsModel.toBase58(), TOKEN_PROGRAM.toBase58(),
    ASSOCIATED_TOKEN_PROGRAM.toBase58(), SystemProgram.programId.toBase58(),
  ];
}

/**
 * Infers the kind from the deployed Lending instruction, then validates the
 * on-chain semantic. A client/database transaction_kind is never authoritative.
 */
export async function verifyEarnTransactionWithConnection(
  connection: Connection,
  signature: string,
  expectedWallet: string,
  profile: SolanaNetworkProfile = ACTIVE_NETWORK,
): Promise<VerifiedEarnTransaction | null> {
  await assertRpcCluster(connection, profile);
  const tx = await connection.getTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });
  if (!tx?.meta || tx.meta.err || !tx.blockTime) return null;
  if (tx.transaction.message.staticAccountKeys[0]?.toBase58() !== expectedWallet) return null;

  const keys = tx.transaction.message.getAccountKeys({ accountKeysFromLookups: tx.meta.loadedAddresses });
  const lendingInstructions = tx.transaction.message.compiledInstructions.filter(
    (instruction) => keys.get(instruction.programIdIndex)?.toBase58() === profile.lendingProgram,
  );
  if (lendingInstructions.length !== 1) return null;
  const lendingInstruction = lendingInstructions[0];
  const kind = hasExactInstructionData(lendingInstruction.data, DEPOSIT_DISCRIMINATOR)
    ? 'deposit'
    : hasExactInstructionData(lendingInstruction.data, WITHDRAW_DISCRIMINATOR)
      ? 'withdraw'
      : null;
  if (!kind) return null;

  const instructionAccounts = [...lendingInstruction.accountKeyIndexes]
    .map((index) => keys.get(index)?.toBase58());
  if (profile.name === 'devnet') {
    const expectedAccounts = expectedDevnetAccounts(kind, expectedWallet, profile);
    if (instructionAccounts.length !== expectedAccounts.length ||
        instructionAccounts.some((address, index) => address !== expectedAccounts[index])) return null;
  } else if (![profile.usdcMint, profile.fTokenMint, profile.earnVault].every(
    (address) => instructionAccounts.includes(address),
  )) return null;

  const invokedLiquidity = (tx.meta.innerInstructions ?? []).some((group) =>
    group.instructions.some((instruction) =>
      'programIdIndex' in instruction &&
      keys.get(instruction.programIdIndex)?.toBase58() === profile.liquidityProgram,
    ),
  );
  if (!invokedLiquidity) return null;

  const preUsdc = walletTokenBalance(tx.meta.preTokenBalances, expectedWallet, profile.usdcMint);
  const postUsdc = walletTokenBalance(tx.meta.postTokenBalances, expectedWallet, profile.usdcMint);
  const preFToken = walletTokenBalance(tx.meta.preTokenBalances, expectedWallet, profile.fTokenMint);
  const postFToken = walletTokenBalance(tx.meta.postTokenBalances, expectedWallet, profile.fTokenMint);
  const usdcDelta = postUsdc - preUsdc;
  const fTokenDelta = postFToken - preFToken;
  if ((kind === 'deposit' && (usdcDelta >= 0n || fTokenDelta <= 0n)) ||
      (kind === 'withdraw' && (usdcDelta <= 0n || fTokenDelta >= 0n))) return null;

  return {
    kind,
    signature,
    walletAddress: expectedWallet,
    amountBaseUnits: kind === 'deposit' ? -usdcDelta : usdcDelta,
    fTokenDeltaBaseUnits: fTokenDelta,
    blockTime: new Date(tx.blockTime * 1000),
    networkProfile: profile.name,
  };
}

async function verifyConfigured(signature: string, expectedWallet: string) {
  const rpcUrl = serverRpcUrl();
  if (!rpcUrl) throw new Error('RPC_URL is not configured');
  return verifyEarnTransactionWithConnection(new Connection(rpcUrl, 'confirmed'), signature, expectedWallet);
}

export async function verifyDepositWithConnection(
  connection: Connection,
  signature: string,
  expectedWallet: string,
  profile: SolanaNetworkProfile = ACTIVE_NETWORK,
): Promise<VerifiedDeposit | null> {
  const verified = await verifyEarnTransactionWithConnection(connection, signature, expectedWallet, profile);
  return verified?.kind === 'deposit' ? verified : null;
}

export async function verifyWithdrawalWithConnection(
  connection: Connection,
  signature: string,
  expectedWallet: string,
  profile: SolanaNetworkProfile = ACTIVE_NETWORK,
): Promise<VerifiedWithdrawal | null> {
  const verified = await verifyEarnTransactionWithConnection(connection, signature, expectedWallet, profile);
  return verified?.kind === 'withdraw' ? verified : null;
}

export async function verifyDepositOnChain(signature: string, expectedWallet: string): Promise<VerifiedDeposit | null> {
  const verified = await verifyConfigured(signature, expectedWallet);
  return verified?.kind === 'deposit' ? verified : null;
}

export async function verifyWithdrawalOnChain(signature: string, expectedWallet: string): Promise<VerifiedWithdrawal | null> {
  const verified = await verifyConfigured(signature, expectedWallet);
  return verified?.kind === 'withdraw' ? verified : null;
}
