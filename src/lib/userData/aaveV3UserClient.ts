import { V3_POOL_ADDRESSES } from '../chainRegistry'

export { V3_POOL_ADDRESSES }

export const MULTICALL3_ADDRESS = '0xcA11bde05977b7Ac6400656eDA8769A2C45a8c3' as const

export function getV3PoolAddress(chainId: number): `0x${string}` | undefined {
  return V3_POOL_ADDRESSES[chainId] as `0x${string}` | undefined
}

type CallResult<T> =
  | { status: 'success'; result: T; error?: undefined }
  | { status: 'failure'; result?: undefined; error: Error }

export interface V3UserReserveData {
  currentATokenBalance: bigint
  currentStableDebt: bigint
  currentVariableDebt: bigint
  usageAsCollateralEnabled: boolean
}

export interface V3UserAccountData {
  totalCollateralBase: bigint
  totalDebtBase: bigint
  availableBorrowsBase: bigint
  currentLiquidationThreshold: bigint
  ltv: bigint
  healthFactor: bigint
}

export interface V3UserPosition {
  chainId: number
  marketName: string
  asset: `0x${string}`
  supplyWad: bigint
  stableBorrowWad: bigint
  variableBorrowWad: bigint
  isCollateral: boolean
}

export interface V3AccountSummary {
  chainId: number
  /** Market name for poolKey construction (e.g. "AaveV3Ethereum"). (AAV-1253 P7) */
  marketName: string
  totalCollateralBaseWad: bigint
  totalDebtBaseWad: bigint
  availableBorrowsBaseWad: bigint
  currentLiquidationThresholdWad: bigint
  ltvWad: bigint
  healthFactorWad: bigint
}

export const POOL_ABI = [
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
      { name: 'scaledVariableDebt', type: 'uint256' },
      { name: 'usageAsCollateralEnabled', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
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
] as const

import {
  createPublicClient,
  http,
  type PublicClient,
} from 'viem'
import { createClientWithRpcRotation } from './rpcResilience'

export interface V3OnchainResult {
  positions: V3UserPosition[]
  accountSummary: V3AccountSummary | null
}

export interface V3OnchainError {
  chainId: number
  error: Error
}

export interface V3OnchainResponse {
  results: V3OnchainResult[]
  errors: V3OnchainError[]
}

export async function getV3UserPositionsOnChain(
  chainId: number,
  userAddress: `0x${string}`,
  reserveIds: `0x${string}`[],
  marketName: string,
  client?: PublicClient,
): Promise<V3OnchainResult> {
  const poolAddress = getV3PoolAddress(chainId)
  if (!poolAddress) return { positions: [], accountSummary: null }

  const publicClient = client ?? (await createClientWithRpcRotation(chainId))
  if (!publicClient) return { positions: [], accountSummary: null }

  const reserveCalls = reserveIds.map((asset) => ({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: 'getUserReserveData' as const,
    args: [asset, userAddress] as const,
  }))

  const accountCall = {
    address: poolAddress,
    abi: POOL_ABI,
    functionName: 'getUserAccountData' as const,
    args: [userAddress] as const,
  }

  const allCalls = [...reserveCalls, accountCall]

  const multicall = publicClient.multicall as unknown as (args: Record<string, unknown>) => Promise<unknown[]>
  const results = await multicall({
    contracts: allCalls,
    multicallAddress: MULTICALL3_ADDRESS,
    allowFailure: true,
  })

  const reserveResults = results.slice(0, reserveIds.length) as CallResult<{ currentATokenBalance: bigint; currentStableDebt: bigint; currentVariableDebt: bigint; usageAsCollateralEnabled: boolean }>[]
  const accountResult = results[reserveIds.length] as CallResult<{ totalCollateralBase: bigint; totalDebtBase: bigint; availableBorrowsBase: bigint; currentLiquidationThreshold: bigint; ltv: bigint; healthFactor: bigint }>

  const positions: V3UserPosition[] = []
  for (let i = 0; i < reserveIds.length; i++) {
    const res = reserveResults[i]
    if (res.status === 'failure' || !res.result) continue
    const { currentATokenBalance, currentStableDebt, currentVariableDebt, usageAsCollateralEnabled } = res.result
    if (currentATokenBalance === 0n && currentStableDebt === 0n && currentVariableDebt === 0n) continue
    positions.push({
      chainId,
      marketName,
      asset: reserveIds[i],
      supplyWad: currentATokenBalance,
      stableBorrowWad: currentStableDebt,
      variableBorrowWad: currentVariableDebt,
      isCollateral: usageAsCollateralEnabled,
    })
  }

  let accountSummary: V3AccountSummary | null = null
  if (accountResult.status === 'success' && accountResult.result) {
    const r = accountResult.result
    accountSummary = {
      chainId,
      marketName,
      totalCollateralBaseWad: r.totalCollateralBase,
      totalDebtBaseWad: r.totalDebtBase,
      availableBorrowsBaseWad: r.availableBorrowsBase,
      currentLiquidationThresholdWad: r.currentLiquidationThreshold,
      ltvWad: r.ltv,
      healthFactorWad: r.healthFactor,
    }
  }

  return { positions, accountSummary }
}

export interface V3AssetsByMarket {
  chainId: number
  assets: `0x${string}`[]
}

export async function getV3UserPositionsMultiChain(
  userAddress: `0x${string}`,
  assetsByMarket: Record<string, V3AssetsByMarket>,
): Promise<V3OnchainResponse> {
  const marketNames = Object.keys(assetsByMarket)
  const settled = await Promise.allSettled(
    marketNames.map((marketName) => {
      const { chainId, assets } = assetsByMarket[marketName]
      return getV3UserPositionsOnChain(chainId, userAddress, assets, marketName)
    }),
  )

  const results: V3OnchainResult[] = []
  const errors: V3OnchainError[] = []

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i]
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value)
    } else {
      const { chainId } = assetsByMarket[marketNames[i]]
      console.error(`[onchain-v3] Chain ${chainId} (${marketNames[i]}) failed:`, outcome.reason)
      errors.push({ chainId, error: outcome.reason })
    }
  }

  return { results, errors }
}
