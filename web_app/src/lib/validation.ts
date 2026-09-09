import { PublicKey } from '@solana/web3.js';
import { z } from 'zod';

const base58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function decodedBase58Length(value: string) {
  let number = 0n;
  for (const char of value) {
    const digit = base58Alphabet.indexOf(char);
    if (digit < 0) return -1;
    number = number * 58n + BigInt(digit);
  }
  let bytes = 0;
  while (number > 0n) { bytes += 1; number >>= 8n; }
  return (value.match(/^1*/)?.[0].length ?? 0) + bytes;
}

export const walletSchema = z
  .string()
  .min(32)
  .max(44)
  .regex(base58)
  .refine((value) => {
    try {
      return new PublicKey(value).toBase58() === value;
    } catch {
      return false;
    }
  }, 'Invalid Solana wallet');

export const signatureSchema = z.string().min(80).max(100).regex(base58, 'Invalid signature');
export const submissionSignatureSchema = signatureSchema.refine(value => decodedBase58Length(value) === 64, 'Invalid signature length');
export const blockhashSchema = z.string().min(32).max(44).regex(base58, 'Invalid blockhash').refine(value => {
  try { return new PublicKey(value).toBase58() === value; } catch { return false; }
}, 'Invalid blockhash');

export const walletBodySchema = z.object({ wallet: walletSchema }).strict();
export const networkProfileSchema = z.enum(['mainnet', 'devnet']);
export const depositReportSchema = z
  .object({ wallet: walletSchema, signature: signatureSchema, networkProfile: networkProfileSchema })
  .strict();
export const submissionTrackingSchema = z.object({
  wallet: walletSchema,
  signature: submissionSignatureSchema,
  networkProfile: networkProfileSchema,
  kind: z.enum(['deposit', 'withdraw']),
  blockhash: blockhashSchema,
  lastValidBlockHeight: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict();
export const submissionReconciliationSchema = z.object({
  wallet: walletSchema,
  kind: z.enum(['deposit', 'withdraw']),
}).strict();

export const adminStreakSchema = z.object({
  wallet: walletSchema,
  currentStreak: z.number().int().min(0).max(365),
}).strict();
export const adminSpinSchema = walletBodySchema;
