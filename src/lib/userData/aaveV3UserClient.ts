import { V3_POOL_ADDRESSES, V3_PROTOCOL_DATA_PROVIDER_ADDRESSES } from '../chainRegistry';

export { V3_POOL_ADDRESSES, V3_PROTOCOL_DATA_PROVIDER_ADDRESSES };

// Canonical Multicall3 (EIP-55 checksummed). The previous value here was a
// 39-hex-char truncated transcription — viem rejected it with
// InvalidAddressError before any RPC left the process, which made every
// multicall in the on-chain fallback path fail unconditionally.
export const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

export function getV3PoolAddress(chainId: number): `0x${string}` | undefined {
  return V3_POOL_ADDRESSES[chainId] as `0x${string}` | undefined;
}

export function getV3ProtocolDataProviderAddress(chainId: number): `0x${string}` | undefined {
  return V3_PROTOCOL_DATA_PROVIDER_ADDRESSES[chainId] as `0x${string}` | undefined;
}

type CallResult<T> =
  { status: 'success'; result: T; error?: undefined } | { status: 'failure'; result?: undefined; error: Error };

export interface V3UserReserveData {
  currentATokenBalance: bigint;
  currentStableDebt: bigint;
  currentVariableDebt: bigint;
  usageAsCollateralEnabled: boolean;
}

export interface V3UserAccountData {
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  availableBorrowsBase: bigint;
  currentLiquidationThreshold: bigint;
  ltv: bigint;
  healthFactor: bigint;
}

export interface V3UserPosition {
  chainId: number;
  marketName: string;
  asset: `0x${string}`;
  supplyWad: bigint;
  stableBorrowWad: bigint;
  variableBorrowWad: bigint;
  isCollateral: boolean;
}

export interface V3AccountSummary {
  chainId: number;
  /** Market name for poolKey construction (e.g. "AaveV3Ethereum"). (AAV-1253 P7) */
  marketName: string;
  totalCollateralBaseWad: bigint;
  totalDebtBaseWad: bigint;
  availableBorrowsBaseWad: bigint;
  currentLiquidationThresholdWad: bigint;
  ltvWad: bigint;
  healthFactorWad: bigint;
}

// Reserve-level user data: Aave V3.2+ removed `getUserReserveData` from the
// Pool (raw eth_call reverts on every wallet), so per-reserve reads target
// AAVE_PROTOCOL_DATA_PROVIDER. Output shape differs from the old Pool entry —
// 9 fields, with `usageAsCollateralEnabled` moving from index 4 to index 8;
// viem decodes positionally against this list, so the order must match the
// deployed contract exactly (verified against aave-v3-core IPoolDataProvider
// and a live Celo position decode — see docs/specs/aav-1305-v3-dataprovider-migration.md).
export const DATA_PROVIDER_ABI = [
  {
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'user', type: 'address' },
    ],
    name: 'getUserReserveData',
    outputs: [
      { name: 'currentATokenBalance', type: 'uint256' },
      { name: 'currentStableDebt', type: 'uint256' },
      { name: 'currentVariableDebt', type: 'uint256' },
      { name: 'principalStableDebt', type: 'uint256' },
      { name: 'scaledVariableDebt', type: 'uint256' },
      { name: 'stableBorrowRate', type: 'uint256' },
      { name: 'liquidityRate', type: 'uint256' },
      { name: 'stableRateLastUpdated', type: 'uint40' },
      { name: 'usageAsCollateralEnabled', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Account-level aggregate only exists on the Pool (and stays there).
export const POOL_ABI = [
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserAccountData',
    outputs: [
      { name: 'totalCollateralBase', type: 'uint256' },
      { name: 'totalDebtBase', type: 'uint256' },
      { name: 'availableBorrowsBase', type: 'uint256' },
      { name: 'currentLiquidationThreshold', type: 'uint256' },
      { name: 'ltv', type: 'uint256' },
      { name: 'healthFactor', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

import { createPublicClient, http, type PublicClient } from 'viem';
import { createClientWithRpcRotation } from './rpcResilience';

export interface V3OnchainResult {
  positions: V3UserPosition[];
  accountSummary: V3AccountSummary | null;
}

export interface V3OnchainError {
  chainId: number;
  error: Error;
}

export interface V3OnchainResponse {
  results: V3OnchainResult[];
  errors: V3OnchainError[];
}

interface MulticallContract {
  address: `0x${string}`;
  abi: typeof DATA_PROVIDER_ABI | typeof POOL_ABI;
  functionName: 'getUserReserveData' | 'getUserAccountData';
  args: readonly `0x${string}`[];
}

export async function getV3UserPositionsOnChain(
  chainId: number,
  userAddress: `0x${string}`,
  reserveIds: `0x${string}`[],
  marketName: string,
  client?: PublicClient,
): Promise<V3OnchainResult> {
  const providerAddress = getV3ProtocolDataProviderAddress(chainId);
  const poolAddress = getV3PoolAddress(chainId);
  if (!providerAddress && !poolAddress) return { positions: [], accountSummary: null };

  const publicClient = client ?? (await createClientWithRpcRotation(chainId));
  if (!publicClient) return { positions: [], accountSummary: null };

  // Reserve-level reads target the DataProvider; the account-level aggregate
  // targets the Pool. Either side degrades independently when its address is
  // unknown (no real chain today lacks either — see the registry canaries).
  const allCalls: MulticallContract[] = [];
  if (providerAddress) {
    for (const asset of reserveIds) {
      allCalls.push({
        address: providerAddress,
        abi: DATA_PROVIDER_ABI,
        functionName: 'getUserReserveData',
        args: [asset, userAddress],
      });
    }
  }
  const accountCallIndex = allCalls.length;
  if (poolAddress) {
    allCalls.push({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'getUserAccountData',
      args: [userAddress],
    });
  }

  const multicall = publicClient.multicall as unknown as (args: Record<string, unknown>) => Promise<unknown[]>;
  const results = await multicall({
    contracts: allCalls,
    multicallAddress: MULTICALL3_ADDRESS,
    allowFailure: true,
  });

  const positions: V3UserPosition[] = [];
  if (providerAddress) {
    const reserveResults = results.slice(0, reserveIds.length) as CallResult<readonly unknown[]>[];
    for (let i = 0; i < reserveIds.length; i++) {
      const res = reserveResults[i];
      // viem decodes multi-output calls as positional tuples, not named
      // objects (same pattern as fetchV3PoolHf in useOnchainHealthFactor).
      // Field order is the DATA_PROVIDER_ABI output order above.
      if (res.status === 'failure' || !Array.isArray(res.result)) continue;
      const [currentATokenBalance, currentStableDebt, currentVariableDebt] = res.result as bigint[];
      const usageAsCollateralEnabled = res.result[8] === true;
      if (currentATokenBalance === 0n && currentStableDebt === 0n && currentVariableDebt === 0n) continue;
      positions.push({
        chainId,
        marketName,
        asset: reserveIds[i],
        supplyWad: currentATokenBalance,
        stableBorrowWad: currentStableDebt,
        variableBorrowWad: currentVariableDebt,
        isCollateral: usageAsCollateralEnabled,
      });
    }
  }

  let accountSummary: V3AccountSummary | null = null;
  const accountResult = results[accountCallIndex] as CallResult<readonly unknown[]> | undefined;
  if (poolAddress && accountResult && accountResult.status === 'success' && Array.isArray(accountResult.result)) {
    const [totalCollateralBase, totalDebtBase, availableBorrowsBase, currentLiquidationThreshold, ltv, healthFactor] =
      accountResult.result as bigint[];
    accountSummary = {
      chainId,
      marketName,
      totalCollateralBaseWad: totalCollateralBase,
      totalDebtBaseWad: totalDebtBase,
      availableBorrowsBaseWad: availableBorrowsBase,
      currentLiquidationThresholdWad: currentLiquidationThreshold,
      ltvWad: ltv,
      healthFactorWad: healthFactor,
    };
  }

  return { positions, accountSummary };
}

export interface V3AssetsByMarket {
  chainId: number;
  assets: `0x${string}`[];
}

export async function getV3UserPositionsMultiChain(
  userAddress: `0x${string}`,
  assetsByMarket: Record<string, V3AssetsByMarket>,
): Promise<V3OnchainResponse> {
  const marketNames = Object.keys(assetsByMarket);
  const settled = await Promise.allSettled(
    marketNames.map((marketName) => {
      const { chainId, assets } = assetsByMarket[marketName];
      return getV3UserPositionsOnChain(chainId, userAddress, assets, marketName);
    }),
  );

  const results: V3OnchainResult[] = [];
  const errors: V3OnchainError[] = [];

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value);
    } else {
      const { chainId } = assetsByMarket[marketNames[i]];
      console.error(`[onchain-v3] Chain ${chainId} (${marketNames[i]}) failed:`, outcome.reason); // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string
      errors.push({ chainId, error: outcome.reason });
    }
  }

  return { results, errors };
}
