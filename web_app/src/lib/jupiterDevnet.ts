import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  type TransactionInstructionCtorFields,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import { toBaseUnits } from './decimals';
import type { SolanaNetworkProfile } from './networkProfile';
import { encodeAnchorU64InstructionData } from './solanaEncoding';
import {
  assertDevnetEarnOperational,
  decodeDevnetLendingAccount,
  DEVNET_EARN_ACCOUNTS,
} from './jupiterDevnetAccounts';

const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const DEPOSIT_DISCRIMINATOR = [242, 35, 198, 137, 82, 225, 242, 182];
const WITHDRAW_DISCRIMINATOR = [183, 18, 70, 156, 148, 109, 161, 34];
const FULL_WITHDRAW_ASSETS = (1n << 64n) - 1n;

export function assertDevnetDepositBalance(
  rawBalance: bigint | null,
  requiredAmount: bigint,
) {
  if (rawBalance === null) {
    throw new Error('Circle Devnet USDC token account is missing');
  }
  if (rawBalance < requiredAmount) {
    throw new Error('Not enough Circle Devnet USDC');
  }
}

// web3.js v1 types still spell instruction data as Node Buffer, although the
// runtime accepts Uint8Array and browser builds use that representation.
function instructionData(bytes: Uint8Array): NonNullable<TransactionInstructionCtorFields['data']> {
  return bytes as NonNullable<TransactionInstructionCtorFields['data']>;
}

function ata(owner: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN_PROGRAM.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function amountData(discriminator: number[], amount: bigint) {
  return encodeAnchorU64InstructionData(discriminator, amount);
}

function ataCreate(payer: PublicKey, owner: PublicKey, mint: PublicKey) {
  const address = ata(owner, mint);
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: address, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: instructionData(Uint8Array.of(1)),
  });
}

export function buildDevnetEarnInstructions(
  kind: 'deposit' | 'withdraw',
  signer: PublicKey,
  amountUsdc: number,
  profile: SolanaNetworkProfile,
) {
  if (profile.name !== 'devnet') throw new Error('Devnet adapter requires the Devnet profile.');
  const mint = new PublicKey(profile.usdcMint);
  const fTokenMint = new PublicKey(profile.fTokenMint);
  const lendingProgram = new PublicKey(profile.lendingProgram);
  const liquidityProgram = new PublicKey(profile.liquidityProgram);
  const userUsdc = ata(signer, mint);
  const userFToken = ata(signer, fTokenMint);
  const common = [
    { pubkey: DEVNET_EARN_ACCOUNTS.lendingAdmin, isSigner: false, isWritable: false },
    { pubkey: DEVNET_EARN_ACCOUNTS.lending, isSigner: false, isWritable: true },
  ];
  const keys = kind === 'deposit' ? [
    { pubkey: signer, isSigner: true, isWritable: true },
    { pubkey: userUsdc, isSigner: false, isWritable: true },
    { pubkey: userFToken, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    ...common,
    { pubkey: fTokenMint, isSigner: false, isWritable: true },
    { pubkey: DEVNET_EARN_ACCOUNTS.reserve, isSigner: false, isWritable: true },
    { pubkey: DEVNET_EARN_ACCOUNTS.supplyPosition, isSigner: false, isWritable: true },
    { pubkey: DEVNET_EARN_ACCOUNTS.rateModel, isSigner: false, isWritable: false },
    { pubkey: new PublicKey(profile.earnVault), isSigner: false, isWritable: true },
    { pubkey: DEVNET_EARN_ACCOUNTS.liquidity, isSigner: false, isWritable: true },
    { pubkey: liquidityProgram, isSigner: false, isWritable: true },
    { pubkey: DEVNET_EARN_ACCOUNTS.rewardsModel, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ] : [
    { pubkey: signer, isSigner: true, isWritable: true },
    { pubkey: userFToken, isSigner: false, isWritable: true },
    { pubkey: userUsdc, isSigner: false, isWritable: true },
    ...common,
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: fTokenMint, isSigner: false, isWritable: true },
    { pubkey: DEVNET_EARN_ACCOUNTS.reserve, isSigner: false, isWritable: true },
    { pubkey: DEVNET_EARN_ACCOUNTS.supplyPosition, isSigner: false, isWritable: true },
    { pubkey: DEVNET_EARN_ACCOUNTS.rateModel, isSigner: false, isWritable: false },
    { pubkey: new PublicKey(profile.earnVault), isSigner: false, isWritable: true },
    { pubkey: DEVNET_EARN_ACCOUNTS.claimAccount, isSigner: false, isWritable: true },
    { pubkey: DEVNET_EARN_ACCOUNTS.liquidity, isSigner: false, isWritable: true },
    { pubkey: liquidityProgram, isSigner: false, isWritable: true },
    { pubkey: DEVNET_EARN_ACCOUNTS.rewardsModel, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  return [
    ataCreate(signer, signer, kind === 'deposit' ? fTokenMint : mint),
    new TransactionInstruction({
      programId: lendingProgram,
      keys,
      data: instructionData(amountData(kind === 'deposit' ? DEPOSIT_DISCRIMINATOR : WITHDRAW_DISCRIMINATOR, toBaseUnits(amountUsdc))),
    }),
  ];
}

/**
 * Jupiter Lending withdraw(amount) accepts underlying assets, not shares.
 * u64::MAX is its documented full-withdraw sentinel: the program reads the
 * owner's live fToken balance and previews the corresponding asset amount.
 */
export function buildDevnetFullWithdrawInstructions(
  signer: PublicKey,
  rawFTokenBalance: bigint,
  profile: SolanaNetworkProfile,
) {
  if (rawFTokenBalance <= 0n) throw new Error('No Devnet fToken position to withdraw.');
  const instructions = buildDevnetEarnInstructions('withdraw', signer, 0, profile);
  instructions[1].data = instructionData(amountData(WITHDRAW_DISCRIMINATOR, FULL_WITHDRAW_ASSETS));
  return instructions;
}

export async function buildDevnetEarnTransaction(kind: 'deposit' | 'withdraw', signer: PublicKey, amount: number, connection: Connection, blockhash: string, profile: SolanaNetworkProfile) {
  await assertDevnetEarnOperational(connection, profile);
  if (kind === 'deposit') {
    const requiredAmount = toBaseUnits(amount);
    const userUsdc = ata(signer, new PublicKey(profile.usdcMint));
    const account = await connection.getAccountInfo(userUsdc, 'confirmed');
    if (!account) assertDevnetDepositBalance(null, requiredAmount);
    const balance = await connection.getTokenAccountBalance(userUsdc, 'confirmed');
    assertDevnetDepositBalance(BigInt(balance.value.amount), requiredAmount);
  }
  const instructions = buildDevnetEarnInstructions(kind, signer, amount, profile);
  return new VersionedTransaction(new TransactionMessage({ payerKey: signer, recentBlockhash: blockhash, instructions }).compileToV0Message());
}

export async function buildDevnetFullWithdrawTransaction(
  signer: PublicKey,
  connection: Connection,
  blockhash: string,
  profile: SolanaNetworkProfile,
) {
  await assertDevnetEarnOperational(connection, profile);
  const position = await getDevnetEarnPosition(connection, signer, profile);
  const instructions = buildDevnetFullWithdrawInstructions(signer, position.shares, profile);
  const transaction = new VersionedTransaction(new TransactionMessage({
    payerKey: signer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message());
  return { transaction, position };
}

export async function getDevnetEarnPosition(connection: Connection, owner: PublicKey, profile: SolanaNetworkProfile) {
  const fTokenAccount = ata(owner, new PublicKey(profile.fTokenMint));
  const [tokenAccount, lending] = await Promise.all([
    connection.getAccountInfo(fTokenAccount, 'confirmed'),
    connection.getAccountInfo(DEVNET_EARN_ACCOUNTS.lending, 'confirmed'),
  ]);
  if (!tokenAccount) return { shares: 0n, underlyingAssets: 0n };
  if (!lending) throw new Error('Devnet lending account is unavailable.');
  const balance = await connection.getTokenAccountBalance(fTokenAccount, 'confirmed');
  const shares = BigInt(balance.value.amount);
  const exchangePrice = decodeDevnetLendingAccount(lending, profile).tokenExchangePrice;
  return { shares, underlyingAssets: (shares * exchangePrice) / 1_000_000_000_000n };
}
