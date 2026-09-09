import { PublicKey } from '@solana/web3.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertDevnetDepositBalance,
  buildDevnetEarnInstructions,
  buildDevnetFullWithdrawInstructions,
} from './jupiterDevnet';
import { resolveNetworkProfile } from './networkProfile';

const profile = resolveNetworkProfile({ NEXT_PUBLIC_SOLANA_NETWORK_PROFILE: 'devnet' }).profile;
const signer = new PublicKey('11111111111111111111111111111111');

afterEach(() => vi.unstubAllGlobals());

describe('verified Jupiter Earn Devnet instruction fixtures', () => {
  it.each([
    ['deposit', [242, 35, 198, 137, 82, 225, 242, 182], 17],
    ['withdraw', [183, 18, 70, 156, 148, 109, 161, 34], 18],
  ] as const)('builds %s with the official discriminator and audited accounts', (kind, discriminator, accountCount) => {
    const instructions = buildDevnetEarnInstructions(kind, signer, 1.25, profile);
    const earn = instructions[1];
    expect(earn.programId.toBase58()).toBe('7tjE28izRUjzmxC1QNXnNwcc4N82CNYCexf3k8mw67s3');
    expect([...earn.data.subarray(0, 8)]).toEqual([...discriminator]);
    expect(new DataView(earn.data.buffer, earn.data.byteOffset + 8, 8).getBigUint64(0, true)).toBe(1_250_000n);
    expect(earn.keys).toHaveLength(accountCount);
    expect(earn.keys.map(({ isSigner }) => isSigner)).toEqual([
      true, ...Array(accountCount - 1).fill(false),
    ]);
    expect(earn.keys[0]).toMatchObject({ isSigner: true, isWritable: true });
    expect(earn.keys.some(({ pubkey }) => pubkey.toBase58() === profile.earnVault)).toBe(true);
    expect(earn.keys.some(({ pubkey }) => pubkey.toBase58() === profile.liquidityProgram)).toBe(true);
    expect(earn.keys.find(({ pubkey }) => pubkey.toBase58() === profile.liquidityProgram)?.isWritable).toBe(true);
  });

  it.each([
    ['deposit', [
      [signer.toBase58(), true, true],
      ['27SXXCACcdgCZLU5hwYYjCb4j22H4ovDpHooVJpAJtXw', false, true],
      ['CYBkAk7wb3BRqPBJn9Hsp48NcnVUqpv4qnfWi7LSfULD', false, true],
      [profile.usdcMint, false, false],
      ['DeF2BVMjWdCamK71nqBZ7uzQkLeW9MJ6C7zoCKLJXEmW', false, false],
      ['98Uy7eonumvRbhQvP5Jt7B3WjNqpndioMF99xvR7sDVa', false, true],
      [profile.fTokenMint, false, true],
      ['644Eh222dNe1V6sSRkYHBcdpxfjtxBBptAJ6mZujRRNo', false, true],
      ['B5JAZXGKaZfWsUrauprZVNQM7HwXN8AfKVTt25qtDKYV', false, true],
      ['CpSRFppSpkdPw7juvRpSxwVyZMN3y8g7cHXCbrc3MBUs', false, false],
      [profile.earnVault, false, true],
      ['DFHSbFzMU67yHK9yLsLBLso7aEnzrB4ZQR7KBujmSU3M', false, true],
      [profile.liquidityProgram, false, true],
      ['GGtryeuwjcWoG6zg4Xi1vUJN1xRhypms4xt129BKTUxt', false, false],
      ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', false, false],
      ['ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', false, false],
      ['11111111111111111111111111111111', false, false],
    ]],
    ['withdraw', null],
  ] as const)('matches the complete %s account order and privileges', (kind, depositFixture) => {
    const earn = buildDevnetEarnInstructions(kind, signer, 1, profile)[1];
    if (depositFixture) {
      expect(earn.keys.map((key) => [key.pubkey.toBase58(), key.isSigner, key.isWritable]))
        .toEqual(depositFixture);
      return;
    }
    expect(earn.keys.map(({ isSigner, isWritable }) => [isSigner, isWritable])).toEqual([
      [true, true], [false, true], [false, true], [false, false], [false, true],
      [false, false], [false, true], [false, true], [false, true], [false, false],
      [false, true], [false, true], [false, true], [false, true], [false, false],
      [false, false], [false, false], [false, false],
    ]);
    expect(earn.keys[13].pubkey.toBase58()).toBe(profile.liquidityProgram);
  });

  it('cannot be used with the Mainnet profile', () => {
    const mainnet = resolveNetworkProfile({}).profile;
    expect(() => buildDevnetEarnInstructions('deposit', signer, 1, mainnet)).toThrow(/Devnet profile/);
  });

  it('builds a browser-safe 1 USDC deposit without signing or broadcasting', () => {
    vi.stubGlobal('Buffer', undefined);
    const earn = buildDevnetEarnInstructions('deposit', signer, 1, profile)[1];
    expect(earn.data).toBeInstanceOf(Uint8Array);
    expect([...earn.data]).toEqual([
      242, 35, 198, 137, 82, 225, 242, 182,
      64, 66, 15, 0, 0, 0, 0, 0,
    ]);
  });

  it('builds full withdraw from a nonzero raw fToken balance, not a displayed USDC amount', () => {
    vi.stubGlobal('Buffer', undefined);
    const earn = buildDevnetFullWithdrawInstructions(signer, 989_796n, profile)[1];
    expect(earn.data).toBeInstanceOf(Uint8Array);
    expect([...earn.data.subarray(0, 8)]).toEqual([183, 18, 70, 156, 148, 109, 161, 34]);
    expect([...earn.data.subarray(8)]).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
  });

  it('rejects a zero fToken position before building full withdraw', () => {
    expect(() => buildDevnetFullWithdrawInstructions(signer, 0n, profile)).toThrow(/No Devnet fToken position/);
  });

  it('keeps full withdraw isolated from the Mainnet profile', () => {
    const mainnet = resolveNetworkProfile({}).profile;
    expect(() => buildDevnetFullWithdrawInstructions(signer, 1n, mainnet)).toThrow(/Devnet profile/);
  });

  it('requires the configured Circle Devnet USDC account and enough balance before deposit', () => {
    expect(() => assertDevnetDepositBalance(null, 1_000_000n)).toThrow(/token account/i);
    expect(() => assertDevnetDepositBalance(999_999n, 1_000_000n)).toThrow(/not enough/i);
    expect(() => assertDevnetDepositBalance(1_000_000n, 1_000_000n)).not.toThrow();
  });
});
