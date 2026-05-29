import {
  AaveV3Ethereum,
  AaveV3Arbitrum,
  AaveV3Avalanche,
  AaveV3BNB,
  AaveV3Base,
  AaveV3Celo,
  AaveV3Gnosis,
  AaveV3Linea,
  AaveV3Mantle,
  AaveV3Metis,
  AaveV3Optimism,
  AaveV3Polygon,
  AaveV3Scroll,
  AaveV3Soneium,
  AaveV3Sonic,
  AaveV3XLayer,
  AaveV3ZkSync,
} from '@aave-dao/aave-address-book'

export const V3_POOL_ADDRESSES: Record<number, `0x${string}`> = {
  [AaveV3Ethereum.CHAIN_ID]: AaveV3Ethereum.POOL,
  [AaveV3Arbitrum.CHAIN_ID]: AaveV3Arbitrum.POOL,
  [AaveV3Avalanche.CHAIN_ID]: AaveV3Avalanche.POOL,
  [AaveV3BNB.CHAIN_ID]: AaveV3BNB.POOL,
  [AaveV3Base.CHAIN_ID]: AaveV3Base.POOL,
  [AaveV3Celo.CHAIN_ID]: AaveV3Celo.POOL,
  [AaveV3Gnosis.CHAIN_ID]: AaveV3Gnosis.POOL,
  [AaveV3Linea.CHAIN_ID]: AaveV3Linea.POOL,
  [AaveV3Mantle.CHAIN_ID]: AaveV3Mantle.POOL,
  [AaveV3Metis.CHAIN_ID]: AaveV3Metis.POOL,
  [AaveV3Optimism.CHAIN_ID]: AaveV3Optimism.POOL,
  [AaveV3Polygon.CHAIN_ID]: AaveV3Polygon.POOL,
  [AaveV3Scroll.CHAIN_ID]: AaveV3Scroll.POOL,
  [AaveV3Soneium.CHAIN_ID]: AaveV3Soneium.POOL,
  [AaveV3Sonic.CHAIN_ID]: AaveV3Sonic.POOL,
  [AaveV3XLayer.CHAIN_ID]: AaveV3XLayer.POOL,
  [AaveV3ZkSync.CHAIN_ID]: AaveV3ZkSync.POOL,
}

export const MULTICALL3_ADDRESS = '0xcA11bde05977b7Ac6400656eDA8769A2C45a8c3' as const

export function getV3PoolAddress(chainId: number): `0x${string}` | undefined {
  return V3_POOL_ADDRESSES[chainId]
}

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
  asset: `0x${string}`
  supplyWad: bigint
  stableBorrowWad: bigint
  variableBorrowWad: bigint
  isCollateral: boolean
}

export interface V3AccountSummary {
  chainId: number
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
  type MulticallResponse,
} from 'viem'
import { getPublicRpcUrls } from '../publicRpcUrls'

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

function createClientWithRetry(chainId: number): PublicClient | null {
  const rpcUrls = getPublicRpcUrls(chainId)
  if (rpcUrls.length === 0) return null
  const chain = { id: chainId, name: `chain-${chainId}`, nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: rpcUrls } } }
  return createPublicClient({ chain, transport: http(rpcUrls[0]), batch: { multicall: true } })
}

export async function getV3UserPositionsOnChain(
  chainId: number,
  userAddress: `0x${string}`,
  reserveIds: `0x${string}`[],
  client?: PublicClient,
): Promise<V3OnchainResult> {
  const poolAddress = getV3PoolAddress(chainId)
  if (!poolAddress) return { positions: [], accountSummary: null }

  const publicClient = client ?? createClientWithRetry(chainId)
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

  const results = await publicClient.multicall({
    contracts: allCalls,
    multicallAddress: MULTICALL3_ADDRESS,
    allowFailure: true,
  })

  const reserveResults = results.slice(0, reserveIds.length) as MulticallResponse<typeof POOL_ABI, 'getUserReserveData'>[]
  const accountResult = results[reserveIds.length] as MulticallResponse<typeof POOL_ABI, 'getUserAccountData'>

  const positions: V3UserPosition[] = []
  for (let i = 0; i < reserveIds.length; i++) {
    const res = reserveResults[i]
    if (res.status === 'failure' || !res.result) continue
    const { currentATokenBalance, currentStableDebt, currentVariableDebt, usageAsCollateralEnabled } = res.result
    if (currentATokenBalance === 0n && currentStableDebt === 0n && currentVariableDebt === 0n) continue
    positions.push({
      chainId,
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

export async function getV3UserPositionsMultiChain(
  userAddress: `0x${string}`,
  reserveIdsByChain: Record<number, `0x${string}`[]>,
): Promise<V3OnchainResponse> {
  const chainIds = Object.keys(reserveIdsByChain).map(Number)
  const settled = await Promise.allSettled(
    chainIds.map((chainId) =>
      getV3UserPositionsOnChain(chainId, userAddress, reserveIdsByChain[chainId]),
    ),
  )

  const results: V3OnchainResult[] = []
  const errors: V3OnchainError[] = []

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i]
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value)
    } else {
      errors.push({ chainId: chainIds[i], error: outcome.reason })
    }
  }

  return { results, errors }
}
