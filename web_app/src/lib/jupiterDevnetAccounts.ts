import { type AccountInfo, Connection, PublicKey } from '@solana/web3.js';

import type { SolanaNetworkProfile } from './networkProfile';

const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const UPGRADEABLE_LOADER = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');

export const DEVNET_EARN_ACCOUNTS = {
  rewardsProgram: new PublicKey('68LHLkpgjAvo6Lgd9FT6KYEX4FWn1911EohSXxHYMFjc'),
  lendingAdmin: new PublicKey('DeF2BVMjWdCamK71nqBZ7uzQkLeW9MJ6C7zoCKLJXEmW'),
  lending: new PublicKey('98Uy7eonumvRbhQvP5Jt7B3WjNqpndioMF99xvR7sDVa'),
  reserve: new PublicKey('644Eh222dNe1V6sSRkYHBcdpxfjtxBBptAJ6mZujRRNo'),
  supplyPosition: new PublicKey('B5JAZXGKaZfWsUrauprZVNQM7HwXN8AfKVTt25qtDKYV'),
  rateModel: new PublicKey('CpSRFppSpkdPw7juvRpSxwVyZMN3y8g7cHXCbrc3MBUs'),
  liquidity: new PublicKey('DFHSbFzMU67yHK9yLsLBLso7aEnzrB4ZQR7KBujmSU3M'),
  rewardsModel: new PublicKey('GGtryeuwjcWoG6zg4Xi1vUJN1xRhypms4xt129BKTUxt'),
  claimAccount: new PublicKey('dUnUR9XxaVWZo5FUi5DGqsMWfAzYPdtgkuiDbPLLtYX'),
} as const;

export enum LiquidityStateStatus {
  Unlocked = 0,
  Locked = 1,
}

export enum SupplyPositionStatus {
  Active = 0,
  Paused = 1,
  NotSet = 2,
}

const CURRENT_LAYOUTS = {
  lending: { length: 196, discriminator: [135, 199, 82, 16, 249, 131, 182, 241] },
  lendingAdmin: { length: 431, discriminator: [42, 8, 33, 220, 163, 40, 210, 5] },
  rewardsModel: { length: 89, discriminator: [166, 72, 71, 131, 172, 74, 166, 181] },
  liquidity: { length: 74, discriminator: [54, 252, 249, 226, 137, 172, 121, 58] },
  reserve: { length: 192, discriminator: [21, 18, 59, 135, 120, 20, 31, 12] },
  supplyPosition: { length: 124, discriminator: [202, 219, 136, 118, 61, 177, 21, 146] },
  rateModel: { length: 53, discriminator: [94, 3, 203, 219, 107, 137, 4, 162] },
  claimAccount: { length: 80, discriminator: [228, 142, 195, 181, 228, 147, 32, 209] },
} as const;

function requireAccount(info: AccountInfo<Uint8Array> | null, label: string): AccountInfo<Uint8Array> {
  if (!info) throw new Error(`Devnet ${label} account is unavailable.`);
  return info;
}

function assertOwner(info: AccountInfo<Uint8Array>, owner: PublicKey, label: string) {
  if (!info.owner.equals(owner)) throw new Error(`Invalid Devnet ${label} owner.`);
}

function assertAnchorLayout(
  info: AccountInfo<Uint8Array>,
  owner: PublicKey,
  label: string,
  layout: { length: number; discriminator: readonly number[] },
) {
  assertOwner(info, owner, label);
  if (info.data.length !== layout.length) {
    throw new Error(`Unsupported Devnet ${label} account version/length.`);
  }
  if (!bytesEqual(info.data.subarray(0, 8), Uint8Array.from(layout.discriminator))) {
    throw new Error(`Invalid Devnet ${label} discriminator.`);
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array) {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

function readPublicKey(data: Uint8Array, offset: number, label: string) {
  if (offset < 0 || offset + 32 > data.length) throw new Error(`Truncated Devnet ${label} account.`);
  return new PublicKey(data.subarray(offset, offset + 32));
}

function readU64(data: Uint8Array, offset: number, label: string) {
  if (offset < 0 || offset + 8 > data.length) throw new Error(`Truncated Devnet ${label} account.`);
  return new DataView(data.buffer, data.byteOffset + offset, 8).getBigUint64(0, true);
}

export function decodeDevnetLendingAccount(
  info: AccountInfo<Uint8Array>,
  profile: SolanaNetworkProfile,
) {
  const program = new PublicKey(profile.lendingProgram);
  assertAnchorLayout(info, program, 'lending', CURRENT_LAYOUTS.lending);
  const mint = readPublicKey(info.data, 8, 'lending');
  const fTokenMint = readPublicKey(info.data, 40, 'lending');
  const rewardsModel = readPublicKey(info.data, 75, 'lending');
  const reserve = readPublicKey(info.data, 131, 'lending');
  const supplyPosition = readPublicKey(info.data, 163, 'lending');
  if (!mint.equals(new PublicKey(profile.usdcMint))) throw new Error('Devnet lending mint mismatch.');
  if (!fTokenMint.equals(new PublicKey(profile.fTokenMint))) throw new Error('Devnet lending fToken mint mismatch.');
  if (!rewardsModel.equals(DEVNET_EARN_ACCOUNTS.rewardsModel)) throw new Error('Devnet rewards model mismatch.');
  if (!reserve.equals(DEVNET_EARN_ACCOUNTS.reserve)) throw new Error('Devnet reserve mismatch.');
  if (!supplyPosition.equals(DEVNET_EARN_ACCOUNTS.supplyPosition)) throw new Error('Devnet supply position mismatch.');
  return { mint, fTokenMint, tokenExchangePrice: readU64(info.data, 115, 'lending') };
}

export function decodeDevnetLiquidityState(info: AccountInfo<Uint8Array>, profile: SolanaNetworkProfile) {
  assertAnchorLayout(info, new PublicKey(profile.liquidityProgram), 'liquidity', CURRENT_LAYOUTS.liquidity);
  const raw = info.data[72];
  if (raw !== LiquidityStateStatus.Unlocked && raw !== LiquidityStateStatus.Locked) {
    throw new Error('Unknown Devnet liquidity status.');
  }
  if (raw === LiquidityStateStatus.Locked) throw new Error('Devnet liquidity is locked.');
  return LiquidityStateStatus.Unlocked;
}

export function decodeDevnetSupplyPosition(info: AccountInfo<Uint8Array>, profile: SolanaNetworkProfile) {
  assertAnchorLayout(info, new PublicKey(profile.liquidityProgram), 'supply position', CURRENT_LAYOUTS.supplyPosition);
  const protocol = readPublicKey(info.data, 8, 'supply position');
  const mint = readPublicKey(info.data, 40, 'supply position');
  if (!protocol.equals(DEVNET_EARN_ACCOUNTS.lending)) throw new Error('Devnet supply position protocol mismatch.');
  if (!mint.equals(new PublicKey(profile.usdcMint))) throw new Error('Devnet supply position mint mismatch.');
  const status = info.data[123];
  if (status === SupplyPositionStatus.Paused) throw new Error('Devnet supply position is paused.');
  if (status === SupplyPositionStatus.NotSet) throw new Error('Devnet supply position is not configured.');
  if (status !== SupplyPositionStatus.Active) throw new Error('Unknown Devnet supply position status.');
  return SupplyPositionStatus.Active;
}

function assertProgram(info: AccountInfo<Uint8Array> | null, address: PublicKey, label: string) {
  const account = requireAccount(info, label);
  if (!account.executable || !account.owner.equals(UPGRADEABLE_LOADER)) {
    throw new Error(`Invalid Devnet ${label} program account.`);
  }
  return address;
}

function assertMint(info: AccountInfo<Uint8Array> | null, label: string, expectedAuthority?: PublicKey) {
  const account = requireAccount(info, label);
  assertOwner(account, TOKEN_PROGRAM, label);
  if (account.data.length !== 82) throw new Error(`Unsupported Devnet ${label} mint version/length.`);
  if (account.data[44] !== 6 || account.data[45] !== 1) throw new Error(`Invalid Devnet ${label} mint state.`);
  if (expectedAuthority) {
    if (new DataView(account.data.buffer, account.data.byteOffset, 4).getUint32(0, true) !== 1 ||
        !readPublicKey(account.data, 4, label).equals(expectedAuthority)) {
      throw new Error(`Invalid Devnet ${label} mint authority.`);
    }
  }
}

export async function assertDevnetEarnOperational(connection: Connection, profile: SolanaNetworkProfile) {
  if (profile.name !== 'devnet') throw new Error('Devnet account preflight requires the Devnet profile.');
  const lendingProgram = new PublicKey(profile.lendingProgram);
  const liquidityProgram = new PublicKey(profile.liquidityProgram);
  const addresses = [
    lendingProgram, liquidityProgram, DEVNET_EARN_ACCOUNTS.rewardsProgram,
    new PublicKey(profile.usdcMint), new PublicKey(profile.fTokenMint), new PublicKey(profile.earnVault),
    DEVNET_EARN_ACCOUNTS.lendingAdmin, DEVNET_EARN_ACCOUNTS.lending,
    DEVNET_EARN_ACCOUNTS.reserve, DEVNET_EARN_ACCOUNTS.supplyPosition,
    DEVNET_EARN_ACCOUNTS.rateModel, DEVNET_EARN_ACCOUNTS.liquidity,
    DEVNET_EARN_ACCOUNTS.rewardsModel, DEVNET_EARN_ACCOUNTS.claimAccount,
  ];
  const infos = await connection.getMultipleAccountsInfo(addresses, 'confirmed');
  assertProgram(infos[0], lendingProgram, 'lending');
  assertProgram(infos[1], liquidityProgram, 'liquidity');
  assertProgram(infos[2], DEVNET_EARN_ACCOUNTS.rewardsProgram, 'rewards');
  assertMint(infos[3], 'USDC');
  assertMint(infos[4], 'fToken', DEVNET_EARN_ACCOUNTS.lendingAdmin);

  const vault = requireAccount(infos[5], 'Earn vault');
  assertOwner(vault, TOKEN_PROGRAM, 'Earn vault');
  if (vault.data.length !== 165) throw new Error('Unsupported Devnet Earn vault version/length.');
  if (!readPublicKey(vault.data, 0, 'Earn vault').equals(new PublicKey(profile.usdcMint)) ||
      !readPublicKey(vault.data, 32, 'Earn vault').equals(DEVNET_EARN_ACCOUNTS.liquidity) ||
      vault.data[108] !== 1) throw new Error('Invalid Devnet Earn vault state.');

  const admin = requireAccount(infos[6], 'lending admin');
  assertAnchorLayout(admin, lendingProgram, 'lending admin', CURRENT_LAYOUTS.lendingAdmin);
  if (!readPublicKey(admin.data, 40, 'lending admin').equals(liquidityProgram)) {
    throw new Error('Devnet lending admin liquidity program mismatch.');
  }
  decodeDevnetLendingAccount(requireAccount(infos[7], 'lending'), profile);
  assertAnchorLayout(requireAccount(infos[8], 'reserve'), liquidityProgram, 'reserve', CURRENT_LAYOUTS.reserve);
  decodeDevnetSupplyPosition(requireAccount(infos[9], 'supply position'), profile);
  assertAnchorLayout(requireAccount(infos[10], 'rate model'), liquidityProgram, 'rate model', CURRENT_LAYOUTS.rateModel);
  decodeDevnetLiquidityState(requireAccount(infos[11], 'liquidity'), profile);
  assertAnchorLayout(requireAccount(infos[12], 'rewards model'), DEVNET_EARN_ACCOUNTS.rewardsProgram, 'rewards model', CURRENT_LAYOUTS.rewardsModel);
  assertAnchorLayout(requireAccount(infos[13], 'claim account'), liquidityProgram, 'claim account', CURRENT_LAYOUTS.claimAccount);
}
