import { type AccountInfo, PublicKey } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';

import {
  decodeDevnetLendingAccount,
  decodeDevnetLiquidityState,
  decodeDevnetSupplyPosition,
  DEVNET_EARN_ACCOUNTS,
  LiquidityStateStatus,
  SupplyPositionStatus,
} from './jupiterDevnetAccounts';
import { resolveNetworkProfile } from './networkProfile';

const profile = resolveNetworkProfile({ NEXT_PUBLIC_SOLANA_NETWORK_PROFILE: 'devnet' }).profile;
const lendingOwner = new PublicKey(profile.lendingProgram);
const liquidityOwner = new PublicKey(profile.liquidityProgram);

function account(data: Buffer, owner: PublicKey): AccountInfo<Buffer> {
  return { data, owner, executable: false, lamports: 1, rentEpoch: 0 };
}

function lendingFixture() {
  const data = Buffer.alloc(196);
  Buffer.from([135, 199, 82, 16, 249, 131, 182, 241]).copy(data, 0);
  new PublicKey(profile.usdcMint).toBuffer().copy(data, 8);
  new PublicKey(profile.fTokenMint).toBuffer().copy(data, 40);
  DEVNET_EARN_ACCOUNTS.rewardsModel.toBuffer().copy(data, 75);
  data.writeBigUInt64LE(1_010_307_223_087n, 115);
  DEVNET_EARN_ACCOUNTS.reserve.toBuffer().copy(data, 131);
  DEVNET_EARN_ACCOUNTS.supplyPosition.toBuffer().copy(data, 163);
  return data;
}

function liquidityFixture(status: number) {
  const data = Buffer.alloc(74);
  Buffer.from([54, 252, 249, 226, 137, 172, 121, 58]).copy(data, 0);
  data[72] = status;
  return data;
}

function supplyFixture(status: number) {
  const data = Buffer.alloc(124);
  Buffer.from([202, 219, 136, 118, 61, 177, 21, 146]).copy(data, 0);
  DEVNET_EARN_ACCOUNTS.lending.toBuffer().copy(data, 8);
  new PublicKey(profile.usdcMint).toBuffer().copy(data, 40);
  data[123] = status;
  return data;
}

describe('version-locked Devnet Anchor account decoders', () => {
  it('reads underlyingAssets exchange price only after exact validation', () => {
    expect(decodeDevnetLendingAccount(account(lendingFixture(), lendingOwner), profile).tokenExchangePrice)
      .toBe(1_010_307_223_087n);
  });

  it.each([
    ['truncated', lendingFixture().subarray(0, 195), lendingOwner, /version\/length/],
    ['oversized', Buffer.concat([lendingFixture(), Buffer.from([0])]), lendingOwner, /version\/length/],
    ['wrong owner', lendingFixture(), liquidityOwner, /owner/],
  ])('rejects a %s lending account', (_name, data, owner, message) => {
    expect(() => decodeDevnetLendingAccount(account(data, owner), profile)).toThrow(message);
  });

  it('rejects wrong discriminator and therefore unknown account versions', () => {
    const data = lendingFixture();
    data[0] ^= 0xff;
    expect(() => decodeDevnetLendingAccount(account(data, lendingOwner), profile)).toThrow(/discriminator/);
  });

  it('maps liquidity false/unlocked and rejects locked and unknown states', () => {
    expect(decodeDevnetLiquidityState(account(liquidityFixture(0), liquidityOwner), profile))
      .toBe(LiquidityStateStatus.Unlocked);
    expect(() => decodeDevnetLiquidityState(account(liquidityFixture(1), liquidityOwner), profile))
      .toThrow(/locked/);
    expect(() => decodeDevnetLiquidityState(account(liquidityFixture(2), liquidityOwner), profile))
      .toThrow(/unknown/i);
  });

  it('maps all known supply states and fails closed for unknown state', () => {
    expect(decodeDevnetSupplyPosition(account(supplyFixture(0), liquidityOwner), profile))
      .toBe(SupplyPositionStatus.Active);
    expect(() => decodeDevnetSupplyPosition(account(supplyFixture(1), liquidityOwner), profile))
      .toThrow(/paused/);
    expect(() => decodeDevnetSupplyPosition(account(supplyFixture(2), liquidityOwner), profile))
      .toThrow(/not configured/);
    expect(() => decodeDevnetSupplyPosition(account(supplyFixture(3), liquidityOwner), profile))
      .toThrow(/unknown/i);
  });
});
