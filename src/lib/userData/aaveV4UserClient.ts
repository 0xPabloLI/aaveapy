import { AaveV4Ethereum } from '@aave-dao/aave-address-book'

export interface V4SpokeEntry {
  name: string
  address: `0x${string}`
}

export interface V4HubEntry {
  name: string
  address: `0x${string}`
}

export const V4_SPOKE_ADDRESSES: Record<number, V4SpokeEntry[]> = {
  [AaveV4Ethereum.CHAIN_ID]: Object.entries(AaveV4Ethereum.SPOKES)
    .filter(([name]) => !name.endsWith('_ORACLE') && name !== 'TREASURY_SPOKE')
    .map(([name, address]) => ({ name, address: address as `0x${string}` })),
}

export const V4_HUB_ADDRESSES: Record<number, V4HubEntry[]> = {
  [AaveV4Ethereum.CHAIN_ID]: Object.entries(AaveV4Ethereum.HUBS)
    .map(([name, address]) => ({ name, address: address as `0x${string}` })),
}

export function getV4SpokeAddresses(chainId: number): V4SpokeEntry[] | undefined {
  return V4_SPOKE_ADDRESSES[chainId]
}

export function getV4HubAddresses(chainId: number): V4HubEntry[] | undefined {
  return V4_HUB_ADDRESSES[chainId]
}

export const MULTICALL3_ADDRESS = '0xcA11bde05977b7Ac6400656eDA8769A2C45a8c3' as const

export interface V4UserPosition {
  chainId: number
  spokeName: string
  reserveId: bigint
  asset: `0x${string}`
  suppliedAssets: bigint
  stableDebt: bigint
  variableDebt: bigint
  isCollateral: boolean
}

export interface V4AccountSummary {
  chainId: number
  spokeName: string
  healthFactor: bigint
  totalCollateralValue: bigint
  totalDebtValueRay: bigint
}

export interface V4OnchainResult {
  positions: V4UserPosition[]
  accountSummaries: V4AccountSummary[]
}

export interface V4OnchainError {
  chainId: number
  spokeName: string
  error: Error
}

export interface V4OnchainResponse {
  results: V4OnchainResult[]
  errors: V4OnchainError[]
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
] as const

import {
  createPublicClient,
  http,
  type PublicClient,
  type MulticallResponse,
} from 'viem'
import { getPublicRpcUrls } from '../publicRpcUrls'

function createClientWithRetry(chainId: number): PublicClient | null {
  const rpcUrls = getPublicRpcUrls(chainId)
  if (rpcUrls.length === 0) return null
  const chain = {
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: rpcUrls } },
  }
  return createPublicClient({ chain, transport: http(rpcUrls[0]), batch: { multicall: true } })
}

export interface V4ReserveInfo {
  reserveId: bigint
  asset: `0x${string}`
}

export async function getV4UserPositionsOnChain(
  chainId: number,
  spokeName: string,
  spokeAddress: `0x${string}`,
  userAddress: `0x${string}`,
  reserves: V4ReserveInfo[],
  client?: PublicClient,
): Promise<V4OnchainResult> {
  const publicClient = client ?? createClientWithRetry(chainId)
  if (!publicClient) return { positions: [], accountSummaries: [] }

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
  ])

  const accountCall = {
    address: spokeAddress,
    abi: SPOKE_ABI,
    functionName: 'getUserAccountData' as const,
    args: [userAddress] as const,
  }

  const allCalls = [...reserveCalls, accountCall]
  const results = await publicClient.multicall({
    contracts: allCalls,
    multicallAddress: MULTICALL3_ADDRESS,
    allowFailure: true,
  })

  const CALLS_PER_RESERVE = 3
  const positions: V4UserPosition[] = []

  for (let i = 0; i < reserves.length; i++) {
    const baseIdx = i * CALLS_PER_RESERVE
    const suppliedResult = results[baseIdx] as MulticallResponse<typeof SPOKE_ABI, 'getUserSuppliedAssets'>
    const debtResult = results[baseIdx + 1] as MulticallResponse<typeof SPOKE_ABI, 'getUserDebt'>
    const statusResult = results[baseIdx + 2] as MulticallResponse<typeof SPOKE_ABI, 'getUserReserveStatus'>

    if (
      suppliedResult.status === 'failure' ||
      debtResult.status === 'failure' ||
      statusResult.status === 'failure' ||
      !suppliedResult.result ||
      !debtResult.result ||
      !statusResult.result
    ) continue

    const [stableDebt, variableDebt] = debtResult.result
    const [isCollateral] = statusResult.result

    if (suppliedResult.result === 0n && stableDebt === 0n && variableDebt === 0n) continue

    positions.push({
      chainId,
      spokeName,
      reserveId: reserves[i].reserveId,
      asset: reserves[i].asset,
      suppliedAssets: suppliedResult.result,
      stableDebt,
      variableDebt,
      isCollateral,
    })
  }

  const accountSummaries: V4AccountSummary[] = []
  const accountResult = results[reserveCalls.length] as MulticallResponse<typeof SPOKE_ABI, 'getUserAccountData'>
  if (accountResult.status === 'success' && accountResult.result) {
    const r = accountResult.result
    accountSummaries.push({
      chainId,
      spokeName,
      healthFactor: r.healthFactor,
      totalCollateralValue: r.totalCollateralValue,
      totalDebtValueRay: r.totalDebtValueRay,
    })
  }

  return { positions, accountSummaries }
}

export async function getV4UserPositionsAllSpokes(
  chainId: number,
  userAddress: `0x${string}`,
  reservesBySpoke: Record<string, V4ReserveInfo[]>,
  client?: PublicClient,
): Promise<V4OnchainResponse> {
  const spokes = getV4SpokeAddresses(chainId)
  if (!spokes) return { results: [], errors: [] }

  const settled = await Promise.allSettled(
    spokes
      .filter((s) => reservesBySpoke[s.name] && reservesBySpoke[s.name].length > 0)
      .map((spoke) =>
        getV4UserPositionsOnChain(
          chainId,
          spoke.name,
          spoke.address,
          userAddress,
          reservesBySpoke[spoke.name],
          client,
        ),
      ),
  )

  const results: V4OnchainResult[] = []
  const errors: V4OnchainError[] = []
  const filteredSpokes = spokes.filter((s) => reservesBySpoke[s.name] && reservesBySpoke[s.name].length > 0)

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i]
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value)
    } else {
      errors.push({ chainId, spokeName: filteredSpokes[i].name, error: outcome.reason })
    }
  }

  return { results, errors }
}
