import { getV3UserPositionsMultiChain, type V3AssetsByMarket } from './aaveV3UserClient'
import { getV4UserPositionsAllSpokes } from './aaveV4UserClient'
import {
  convertV3PositionsToWalletPositions,
  convertV4PositionsToWalletPositions,
  buildReserveLookupByChainAndToken,
} from './onchainPositionConverter'
import type { WalletPosition, WalletPositionSource } from './userPositionMapper'
import type { ReserveWithSpread } from '@/types/aave'
import { withTimeout } from './rpcResilience'
import { FALLBACK_TIMEOUT_MS } from './fallbackConstants'

export interface FallbackPositionsConfig {
  userAddress: `0x${string}`
  reserves: ReserveWithSpread[]
  v3AssetsByMarket: Record<string, V3AssetsByMarket>
  v4ReservesBySpoke: Record<string, { reserveId: bigint; asset: `0x${string}` }[]>
  v4ChainIds: number[]
}

export interface ChainFilter {
  v3ChainIds?: Set<number>
  v4ChainIds?: number[]
}

export interface FallbackLabels {
  v3Prefix: string
  v4Prefix: string
}

export async function fetchFallbackPositions(
  config: FallbackPositionsConfig,
  chainFilter: ChainFilter,
  labels: FallbackLabels,
): Promise<{ positions: WalletPosition[]; failedSources: string[] }> {
  const { userAddress, reserves, v3AssetsByMarket, v4ReservesBySpoke, v4ChainIds } = config
  const { v3Prefix, v4Prefix } = labels
  const positions: WalletPosition[] = []
  const failedSources: string[] = []

  const filteredV3Assets = chainFilter.v3ChainIds
    ? filterV3AssetsByChainIds(v3AssetsByMarket, chainFilter.v3ChainIds)
    : v3AssetsByMarket

  if (Object.keys(filteredV3Assets).length > 0) {
    const v3Result = await fetchV3Positions(filteredV3Assets, userAddress, reserves, v3Prefix)
    positions.push(...v3Result.positions)
    failedSources.push(...v3Result.failedSources)
  }

  const filteredV4ChainIds = chainFilter.v4ChainIds ?? v4ChainIds

  if (filteredV4ChainIds.length > 0) {
    const v4Result = await fetchV4Positions(filteredV4ChainIds, userAddress, reserves, v4ReservesBySpoke, v4Prefix)
    positions.push(...v4Result.positions)
    failedSources.push(...v4Result.failedSources)
  }

  return { positions, failedSources }
}

function filterV3AssetsByChainIds(
  v3AssetsByMarket: Record<string, V3AssetsByMarket>,
  chainIds: Set<number>,
): Record<string, V3AssetsByMarket> {
  const filtered: Record<string, V3AssetsByMarket> = {}
  for (const [marketName, entry] of Object.entries(v3AssetsByMarket)) {
    if (chainIds.has(entry.chainId)) {
      filtered[marketName] = entry
    }
  }
  return filtered
}

async function fetchV3Positions(
  assetsByMarket: Record<string, V3AssetsByMarket>,
  userAddress: `0x${string}`,
  reserves: ReserveWithSpread[],
  prefix: string,
): Promise<{ positions: WalletPosition[]; failedSources: string[] }> {
  const positions: WalletPosition[] = []
  const failedSources: string[] = []

  const source: WalletPositionSource = prefix as WalletPositionSource
  const lookupMap = buildReserveLookupByChainAndToken(reserves)
  try {
    const v3Response = await withTimeout(
      getV3UserPositionsMultiChain(userAddress, assetsByMarket),
      FALLBACK_TIMEOUT_MS,
      prefix,
    )
    for (const result of v3Response.results) {
      positions.push(...convertV3PositionsToWalletPositions(result.positions, lookupMap, source))
    }
    for (const err of v3Response.errors) {
      failedSources.push(`${prefix}-chain-${err.chainId}`)
    }
  } catch (err) {
    console.error(`[${prefix}] Failed to fetch V3 positions:`, err) // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string
    failedSources.push(prefix)
  }

  return { positions, failedSources }
}

async function fetchV4Positions(
  chainIds: number[],
  userAddress: `0x${string}`,
  reserves: ReserveWithSpread[],
  v4ReservesBySpoke: Record<string, { reserveId: bigint; asset: `0x${string}` }[]>,
  prefix: string,
): Promise<{ positions: WalletPosition[]; failedSources: string[] }> {
  const positions: WalletPosition[] = []
  const failedSources: string[] = []

  const source: WalletPositionSource = prefix as WalletPositionSource
  const lookupMap = buildReserveLookupByChainAndToken(reserves)
  const settled = await Promise.allSettled(
    chainIds.map(chainId =>
      withTimeout(
        getV4UserPositionsAllSpokes(chainId, userAddress, v4ReservesBySpoke),
        FALLBACK_TIMEOUT_MS,
        `${prefix}-chain-${chainId}`,
      ),
    ),
  )

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i]
    const chainId = chainIds[i]
    if (outcome.status === 'fulfilled') {
      for (const result of outcome.value.results) {
        positions.push(...convertV4PositionsToWalletPositions(result.positions, lookupMap, source))
      }
      for (const err of outcome.value.errors) {
        failedSources.push(`${prefix}-chain-${err.chainId}-spoke-${err.spokeName ?? 'unknown'}`)
      }
    } else {
      console.error(`[${prefix}] Chain ${chainId} failed:`, outcome.reason) // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string
      failedSources.push(`${prefix}-chain-${chainId}`)
    }
  }

  return { positions, failedSources }
}
