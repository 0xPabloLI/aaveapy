import * as ab from '@aave-dao/aave-address-book'


type CallResult<T> =
  | { status: 'success'; result: T; error?: undefined }
  | { status: 'failure'; result?: undefined; error: Error }

export interface V4SpokeEntry {
  name: string
  address: `0x${string}`
}

export interface V4HubEntry {
  name: string
  address: `0x${string}`
}

// ---------------------------------------------------------------------------
// Auto-discover V4 spoke/hub addresses from address book.
// When a new V4 chain is added to the address book, it's immediately available.
// ---------------------------------------------------------------------------

interface V4AbModule {
  CHAIN_ID: number
  SPOKES: Record<string, string>
  HUBS: Record<string, string>
}

function isV4Module(name: string, mod: unknown): mod is V4AbModule {
  if (!name.startsWith('AaveV4')) return false
  if (name === 'AaveV4') return false // base module
  if (name.includes('Sepolia') || name.includes('Fuji') || name.includes('Testnet')) return false
  const m = mod as V4AbModule
  return typeof m?.CHAIN_ID === 'number' && !!m?.SPOKES && typeof m?.SPOKES === 'object'
}

export const V4_SPOKE_ADDRESSES: Record<number, V4SpokeEntry[]> = Object.fromEntries(
  Object.entries(ab)
    .filter(([name, mod]) => isV4Module(name, mod))
    .map(([, mod]) => {
      const m = mod as V4AbModule
      return [
        m.CHAIN_ID,
        Object.entries(m.SPOKES)
          .filter(([name]) => !name.endsWith('_ORACLE') && name !== 'TREASURY_SPOKE')
          .map(([name, address]) => ({ name, address: address as `0x${string}` })),
      ]
    }),
)

export const V4_HUB_ADDRESSES: Record<number, V4HubEntry[]> = Object.fromEntries(
  Object.entries(ab)
    .filter(([name, mod]) => isV4Module(name, mod))
    .map(([, mod]) => {
      const m = mod as V4AbModule
      return [
        m.CHAIN_ID,
        Object.entries(m.HUBS)
          .map(([name, address]) => ({ name, address: address as `0x${string}` })),
      ]
    }),
)

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
  /** Canonical matching key — address book raw key (e.g. MAIN_SPOKE) ≠ SDK spoke.name (e.g. Main). Use spokeAddress for cross-system matching. (AAV-1253 P7) */
  spokeAddress: `0x${string}`
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
} from 'viem'
import { createClientWithRpcRotation } from './rpcResilience'

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
  const publicClient = client ?? (await createClientWithRpcRotation(chainId))
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
  const multicall = publicClient.multicall as unknown as (args: Record<string, unknown>) => Promise<unknown[]>
  const results = await multicall({
    contracts: allCalls,
    multicallAddress: MULTICALL3_ADDRESS,
    allowFailure: true,
  })

  const CALLS_PER_RESERVE = 3
  const positions: V4UserPosition[] = []

  for (let i = 0; i < reserves.length; i++) {
    const baseIdx = i * CALLS_PER_RESERVE
    const suppliedResult = results[baseIdx] as CallResult<bigint>
    const debtResult = results[baseIdx + 1] as CallResult<readonly [bigint, bigint]>
    const statusResult = results[baseIdx + 2] as CallResult<readonly [boolean, boolean]>

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
  const accountResult = results[reserveCalls.length] as CallResult<{ healthFactor: bigint; totalCollateralValue: bigint; totalDebtValueRay: bigint }>
  if (accountResult.status === 'success' && accountResult.result) {
    const r = accountResult.result
    accountSummaries.push({
      chainId,
      spokeName,
      spokeAddress,
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
      console.error(`[onchain-v4] Spoke ${filteredSpokes[i].name} on chain ${chainId} failed:`, outcome.reason)
      errors.push({ chainId, spokeName: filteredSpokes[i].name, error: outcome.reason })
    }
  }

  return { results, errors }
}
