import * as ab from '@aave-dao/aave-address-book';
import { toV4SpokeKey } from '@/lib/reserveKey';
import {
  MulticallAllCallsFailedError,
  isSuccessfulRead,
  type MulticallCallResult as CallResult,
} from './multicallFailure';

interface V4AddressEntry {
  /** Diagnostic label, unique within the chain. Prefixed with the module name only on collision. */
  name: string;
  /** Raw address-book key, e.g. `MAIN_SPOKE` / `CORE_HUB`. */
  rawName: string;
  address: `0x${string}`;
}

export type V4SpokeEntry = V4AddressEntry;
export type V4HubEntry = V4AddressEntry;

/** Data fields of an address-book V4 module. */
export interface V4ModuleData {
  CHAIN_ID: number;
  SPOKES: Record<string, string>;
  /** Hubs are optional: a module with spokes but no hub data still contributes spokes. */
  HUBS?: Record<string, string>;
}

/** Address-book V4 module with its export key as `name`. */
export interface V4ModuleSource extends V4ModuleData {
  name: string;
}

export interface V4AddressUnion {
  spokes: V4SpokeEntry[];
  hubs: V4HubEntry[];
}

// ---------------------------------------------------------------------------
// Auto-discover V4 spoke/hub addresses from address book.
// When a new V4 chain is added to the address book, it's immediately available.
// ---------------------------------------------------------------------------

function isV4Module(name: string, mod: unknown): mod is V4ModuleData {
  if (!name.startsWith('AaveV4')) return false;
  if (name === 'AaveV4') return false; // base module
  if (name.includes('Sepolia') || name.includes('Fuji') || name.includes('Testnet')) return false;
  const m = mod as V4ModuleData;
  return typeof m?.CHAIN_ID === 'number' && !!m?.SPOKES && typeof m?.SPOKES === 'object';
}

interface RawEntry {
  rawName: string;
  moduleName: string;
  address: `0x${string}`;
}

/**
 * Collect one entry per address across every module of a chain.
 *
 * Modules arrive sorted by name so the result does not depend on address-book
 * enumeration order, and the first module wins when two modules export the same
 * address. Malformed addresses are skipped: they could never match a reserve key
 * or name a real contract, so keeping them only adds dead diagnostics.
 */
function collectUniqueEntries(
  modules: readonly V4ModuleSource[],
  entriesOf: (module: V4ModuleSource) => Record<string, string>,
  include: (rawName: string) => boolean = () => true,
): RawEntry[] {
  const seen = new Set<string>();
  const entries: RawEntry[] = [];

  for (const module of modules) {
    for (const [rawName, rawAddress] of Object.entries(entriesOf(module))) {
      if (!include(rawName)) continue;
      const key = toV4SpokeKey(rawAddress);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      entries.push({ rawName, moduleName: module.name, address: rawAddress as `0x${string}` });
    }
  }

  return entries;
}

/**
 * Label entries by raw name, adding the module prefix only where the raw name repeats.
 *
 * Two modules can name different spokes the same (`BLUECHIP_SPOKE` exists on Ethereum
 * base and on Sentora with different addresses). The join key is the address, so both
 * entries stay; the label only needs to distinguish them in diagnostics/failure
 * sources. Unique names keep their historical raw form, so existing labels do not move.
 */
function labelEntries(entries: RawEntry[]): V4AddressEntry[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.rawName, (counts.get(entry.rawName) ?? 0) + 1);
  }

  return entries.map((entry) => ({
    name: (counts.get(entry.rawName) ?? 0) > 1 ? `${entry.moduleName}:${entry.rawName}` : entry.rawName,
    rawName: entry.rawName,
    address: entry.address,
  }));
}

/**
 * Union every V4 address-book module of a chain, keyed by address (AAV-1356).
 *
 * The address book ships several modules per chain: a base module plus curated
 * variants (`AaveV4Ethereum` and `AaveV4EthereumSentoraCurated` are both `CHAIN_ID: 1`).
 * Picking one module silently dropped the other's spokes from the on-chain fallback:
 * before this union, only Ethereum's base module was queried, and a later base-only
 * bump still missed the curated `Gold Correlated` spoke. Since the join key is the
 * spoke address, merging is safe — same-address entries dedupe, and same-name entries
 * remain separate (see `labelEntries`).
 *
 * Spokes only: `_ORACLE` helper entries and `TREASURY_SPOKE` are not position spokes.
 * Hubs are unioned too because strategy discovery walks them.
 */
export function unionV4ModuleAddresses(modules: readonly V4ModuleSource[]): Map<number, V4AddressUnion> {
  const sorted = [...modules].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const byChain = new Map<number, V4ModuleSource[]>();
  for (const module of sorted) {
    const group = byChain.get(module.CHAIN_ID);
    if (group) group.push(module);
    else byChain.set(module.CHAIN_ID, [module]);
  }

  const union = new Map<number, V4AddressUnion>();
  for (const [chainId, group] of byChain) {
    union.set(chainId, {
      spokes: labelEntries(
        collectUniqueEntries(
          group,
          (module) => module.SPOKES,
          (rawName) => !rawName.endsWith('_ORACLE') && rawName !== 'TREASURY_SPOKE',
        ),
      ),
      hubs: labelEntries(collectUniqueEntries(group, (module) => module.HUBS ?? {})),
    });
  }
  return union;
}

const V4_MODULES: V4ModuleSource[] = [];
for (const [name, mod] of Object.entries(ab)) {
  if (isV4Module(name, mod)) V4_MODULES.push({ name, ...mod });
}

const V4_ADDRESS_UNION = unionV4ModuleAddresses(V4_MODULES);

export const V4_SPOKE_ADDRESSES: Record<number, V4SpokeEntry[]> = Object.fromEntries(
  [...V4_ADDRESS_UNION].map(([chainId, union]) => [chainId, union.spokes]),
);

export const V4_HUB_ADDRESSES: Record<number, V4HubEntry[]> = Object.fromEntries(
  [...V4_ADDRESS_UNION].map(([chainId, union]) => [chainId, union.hubs]),
);

export function getV4SpokeAddresses(chainId: number): V4SpokeEntry[] | undefined {
  return V4_SPOKE_ADDRESSES[chainId];
}

export function getV4HubAddresses(chainId: number): V4HubEntry[] | undefined {
  return V4_HUB_ADDRESSES[chainId];
}

// Canonical Multicall3 (EIP-55 checksummed) — must stay 20 bytes / 40 hex
// chars, or viem's multicall rejects it with InvalidAddressError before any
// RPC is attempted (kept in sync with aaveV3UserClient.ts).
export const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

export interface V4UserPosition {
  chainId: number;
  spokeName: string;
  reserveId: bigint;
  asset: `0x${string}`;
  suppliedAssets: bigint;
  stableDebt: bigint;
  variableDebt: bigint;
  isCollateral: boolean;
}

export interface V4AccountSummary {
  chainId: number;
  spokeName: string;
  /** Canonical matching key — address book raw key (e.g. MAIN_SPOKE) ≠ SDK spoke.name (e.g. Main). Use spokeAddress for cross-system matching. (AAV-1253 P7) */
  spokeAddress: `0x${string}`;
  healthFactor: bigint;
  totalCollateralValue: bigint;
  totalDebtValueRay: bigint;
}

export interface V4OnchainResult {
  positions: V4UserPosition[];
  accountSummaries: V4AccountSummary[];
}

export interface V4OnchainError {
  chainId: number;
  spokeName: string;
  error: Error;
}

export interface V4OnchainResponse {
  results: V4OnchainResult[];
  errors: V4OnchainError[];
}

export const SPOKE_ABI = [
  {
    inputs: [
      { name: 'reserveId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    name: 'getUserSuppliedAssets',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'reserveId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    name: 'getUserDebt',
    outputs: [
      { name: 'stableDebt', type: 'uint256' },
      { name: 'variableDebt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'reserveId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    name: 'getUserReserveStatus',
    outputs: [
      { name: 'isCollateral', type: 'bool' },
      { name: 'isBorrowing', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserAccountData',
    outputs: [
      { name: 'riskPremium', type: 'uint256' },
      { name: 'avgCollateralFactor', type: 'uint256' },
      { name: 'healthFactor', type: 'uint256' },
      { name: 'totalCollateralValue', type: 'uint256' },
      { name: 'totalDebtValueRay', type: 'uint256' },
      { name: 'activeCollateralCount', type: 'uint256' },
      { name: 'borrowCount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

import { createPublicClient, http, type PublicClient } from 'viem';
import { readFromHealthyRpc } from './rpcRead';
import type { RpcReadAttempt } from './rpcResilience';

export interface V4ReserveInfo {
  reserveId: bigint;
  asset: `0x${string}`;
}

/** supplied / debt / status — the three reads that make one reserve readable. */
const V4_CALLS_PER_RESERVE = 3;

/**
 * A reserve counts only when all three of its calls succeeded. The rotation
 * decision (`allCallsFailed`) and the all-failed error share this count so
 * they cannot drift apart; `0n` balances are successful reads (AAV-1314).
 */
function countReadableV4Reserves(results: readonly unknown[], reserveCount: number): number {
  let count = 0;
  for (let i = 0; i < reserveCount; i++) {
    const base = i * V4_CALLS_PER_RESERVE;
    if (
      isSuccessfulRead(results[base] as CallResult<unknown> | undefined) &&
      isSuccessfulRead(results[base + 1] as CallResult<unknown> | undefined) &&
      isSuccessfulRead(results[base + 2] as CallResult<unknown> | undefined)
    ) {
      count++;
    }
  }
  return count;
}

export async function getV4UserPositionsOnChain(
  chainId: number,
  spokeName: string,
  spokeAddress: `0x${string}`,
  userAddress: `0x${string}`,
  reserves: V4ReserveInfo[],
  client?: PublicClient,
): Promise<V4OnchainResult> {
  const reserveCalls = reserves.flatMap((reserve) => [
    {
      address: spokeAddress,
      abi: SPOKE_ABI,
      functionName: 'getUserSuppliedAssets' as const,
      args: [reserve.reserveId, userAddress] as const,
    },
    {
      address: spokeAddress,
      abi: SPOKE_ABI,
      functionName: 'getUserDebt' as const,
      args: [reserve.reserveId, userAddress] as const,
    },
    {
      address: spokeAddress,
      abi: SPOKE_ABI,
      functionName: 'getUserReserveStatus' as const,
      args: [reserve.reserveId, userAddress] as const,
    },
  ]);

  const accountCall = {
    address: spokeAddress,
    abi: SPOKE_ABI,
    functionName: 'getUserAccountData' as const,
    args: [userAddress] as const,
  };

  const allCalls = [...reserveCalls, accountCall];

  // One batch read against one endpoint. `allCallsFailed` shares its
  // definition with the all-failed error below so rotation and the domain
  // error cannot disagree (AAV-1387).
  const readBatch = async (publicClient: PublicClient): Promise<RpcReadAttempt<CallResult<unknown>[]>> => {
    const multicall = publicClient.multicall as unknown as (args: Record<string, unknown>) => Promise<unknown[]>;
    const batch = (await multicall({
      contracts: allCalls,
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: true,
    })) as CallResult<unknown>[];
    return {
      value: batch,
      allCallsFailed: reserves.length > 0 && countReadableV4Reserves(batch, reserves.length) === 0,
    };
  };

  // Explicit client (tests, health-factor path) bypasses rotation by
  // contract; otherwise the read goes through endpoint rotation (AAV-1387).
  const results = await readFromHealthyRpc(chainId, client, readBatch);
  if (!results) return { positions: [], accountSummaries: [] };

  const positions: V4UserPosition[] = [];
  const successfulReserves = countReadableV4Reserves(results, reserves.length);

  for (let i = 0; i < reserves.length; i++) {
    const baseIdx = i * V4_CALLS_PER_RESERVE;
    const suppliedResult = results[baseIdx] as CallResult<bigint> | undefined;
    const debtResult = results[baseIdx + 1] as CallResult<readonly [bigint, bigint]> | undefined;
    const statusResult = results[baseIdx + 2] as CallResult<readonly [boolean, boolean]> | undefined;

    // A reserve is readable only when all three calls succeeded. `0n` is a
    // valid balance: checking truthiness here used to drop borrow-only
    // reserves (zero supply, non-zero debt).
    if (!isSuccessfulRead(suppliedResult) || !isSuccessfulRead(debtResult) || !isSuccessfulRead(statusResult)) continue;

    const [stableDebt, variableDebt] = debtResult.result;
    const [isCollateral] = statusResult.result;

    if (suppliedResult.result === 0n && stableDebt === 0n && variableDebt === 0n) continue;

    positions.push({
      chainId,
      spokeName,
      reserveId: reserves[i].reserveId,
      asset: reserves[i].asset,
      suppliedAssets: suppliedResult.result,
      stableDebt,
      variableDebt,
      isCollateral,
    });
  }

  // Zero successful reserve reads on a healthy client is not "no positions".
  // Let it fail so getV4UserPositionsAllSpokes records the spoke in errors
  // (AAV-1314).
  if (reserves.length > 0 && successfulReserves === 0) {
    throw new MulticallAllCallsFailedError(chainId, spokeName, reserves.length * V4_CALLS_PER_RESERVE);
  }
  if (successfulReserves > 0 && successfulReserves < reserves.length) {
    console.warn(
      `[onchain-v4] partial multicall failure for ${spokeName} on chain ${chainId}: ` +
        `${reserves.length - successfulReserves}/${reserves.length} reserves had failed reads`,
    );
  }

  const accountSummaries: V4AccountSummary[] = [];
  const accountResult = results[reserveCalls.length] as
    | CallResult<{
        healthFactor: bigint;
        totalCollateralValue: bigint;
        totalDebtValueRay: bigint;
      }>
    | undefined;
  if (isSuccessfulRead(accountResult)) {
    const r = accountResult.result;
    accountSummaries.push({
      chainId,
      spokeName,
      spokeAddress,
      healthFactor: r.healthFactor,
      totalCollateralValue: r.totalCollateralValue,
      totalDebtValueRay: r.totalDebtValueRay,
    });
  } else {
    console.warn(
      `[onchain-v4] account-level read failed for ${spokeName} on chain ${chainId}; ` +
        'returning positions without account summary',
    );
  }

  return { positions, accountSummaries };
}

export async function getV4UserPositionsAllSpokes(
  chainId: number,
  userAddress: `0x${string}`,
  reservesBySpoke: Record<string, V4ReserveInfo[]>,
  client?: PublicClient,
): Promise<V4OnchainResponse> {
  const spokes = getV4SpokeAddresses(chainId);
  if (!spokes) return { results: [], errors: [] };

  // Looked up by spoke address: a map keyed by name — the address book's raw key or the
  // API's display name — matches nothing here, and the fallback then silently queries
  // zero spokes (AAV-1356). A single `targeted` array keeps each outcome aligned with
  // the spoke it belongs to, so a failure is never attributed to a neighbour.
  const targeted = spokes.flatMap((spoke) => {
    const key = toV4SpokeKey(spoke.address);
    const reserves = key ? reservesBySpoke[key] : undefined;
    return reserves && reserves.length > 0 ? [{ spoke, reserves }] : [];
  });

  const settled = await Promise.allSettled(
    targeted.map(({ spoke, reserves }) =>
      getV4UserPositionsOnChain(chainId, spoke.name, spoke.address, userAddress, reserves, client),
    ),
  );

  const results: V4OnchainResult[] = [];
  const errors: V4OnchainError[] = [];

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value);
    } else {
      console.error(`[onchain-v4] Spoke ${targeted[i].spoke.name} on chain ${chainId} failed:`, outcome.reason); // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string
      errors.push({ chainId, spokeName: targeted[i].spoke.name, error: outcome.reason });
    }
  }

  return { results, errors };
}
