import { useQuery } from '@tanstack/react-query'
import { getV3UserPositionsMultiChain, type V3AssetsByMarket } from './aaveV3UserClient'
import { getV4UserPositionsAllSpokes } from './aaveV4UserClient'
import {
  convertV3PositionsToWalletPositions,
  convertV4PositionsToWalletPositions,
  buildReserveLookupByChainAndToken,
} from './onchainPositionConverter'
import type { WalletPosition } from './userPositionMapper'
import type { ReserveWithSpread } from '@/types/aave'
import type { GapChainIds } from './gapChainComputation'
import { withTimeout } from './rpcResilience'
import { FALLBACK_TIMEOUT_MS, FALLBACK_STALE_TIME, FALLBACK_GC_TIME } from './fallbackConstants'

export interface FetchGapPositionsParams {
  gapChainIds: GapChainIds
  address: `0x${string}`
  reserves: ReserveWithSpread[]
  v3AssetsByMarket: Record<string, V3AssetsByMarket>
  v4ReservesBySpoke: Record<string, { reserveId: bigint; asset: `0x${string}` }[]>
}

export async function fetchGapPositions(
  params: FetchGapPositionsParams,
): Promise<{ positions: WalletPosition[]; failedSources: string[] }> {
  const { gapChainIds, address, reserves, v3AssetsByMarket, v4ReservesBySpoke } = params
  const positions: WalletPosition[] = []
  const failedSources: string[] = []

  if (gapChainIds.v3Gap.length > 0) {
    const v3Result = await fetchGapV3Positions(gapChainIds.v3Gap, address, reserves, v3AssetsByMarket)
    positions.push(...v3Result.positions)
    failedSources.push(...v3Result.failedSources)
  }

  if (gapChainIds.v4Gap.length > 0) {
    const v4Result = await fetchGapV4Positions(gapChainIds.v4Gap, address, reserves, v4ReservesBySpoke)
    positions.push(...v4Result.positions)
    failedSources.push(...v4Result.failedSources)
  }

  return { positions, failedSources }
}

async function fetchGapV3Positions(
  gapChainIds: readonly number[],
  userAddress: `0x${string}`,
  reserves: ReserveWithSpread[],
  v3AssetsByMarket: Record<string, V3AssetsByMarket>,
): Promise<{ positions: WalletPosition[]; failedSources: string[] }> {
  const positions: WalletPosition[] = []
  const failedSources: string[] = []
  const gapSet = new Set(gapChainIds)

  const gapAssetsByMarket: Record<string, V3AssetsByMarket> = {}
  for (const [marketName, entry] of Object.entries(v3AssetsByMarket)) {
    if (gapSet.has(entry.chainId)) {
      gapAssetsByMarket[marketName] = entry
    }
  }

  if (Object.keys(gapAssetsByMarket).length === 0) return { positions, failedSources }

  const lookupMap = buildReserveLookupByChainAndToken(reserves)
  try {
    const v3Response = await withTimeout(
      getV3UserPositionsMultiChain(userAddress, gapAssetsByMarket),
      FALLBACK_TIMEOUT_MS,
      'gap-v3',
    )
    for (const result of v3Response.results) {
      positions.push(...convertV3PositionsToWalletPositions(result.positions, lookupMap))
    }
    for (const err of v3Response.errors) {
      failedSources.push(`gap-v3-chain-${err.chainId}`)
    }
  } catch (err) {
    console.error('[gap-v3] Failed to fetch V3 gap positions:', err)
    failedSources.push('gap-v3')
  }

  return { positions, failedSources }
}

async function fetchGapV4Positions(
  gapChainIds: readonly number[],
  userAddress: `0x${string}`,
  reserves: ReserveWithSpread[],
  v4ReservesBySpoke: Record<string, { reserveId: bigint; asset: `0x${string}` }[]>,
): Promise<{ positions: WalletPosition[]; failedSources: string[] }> {
  const positions: WalletPosition[] = []
  const failedSources: string[] = []

  if (gapChainIds.length === 0) return { positions, failedSources }

  const lookupMap = buildReserveLookupByChainAndToken(reserves)
  const settled = await Promise.allSettled(
    gapChainIds.map(chainId =>
      withTimeout(
        getV4UserPositionsAllSpokes(chainId, userAddress, v4ReservesBySpoke),
        FALLBACK_TIMEOUT_MS,
        `gap-v4-chain-${chainId}`,
      ),
    ),
  )

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i]
    const chainId = gapChainIds[i]
    if (outcome.status === 'fulfilled') {
      for (const result of outcome.value.results) {
        positions.push(...convertV4PositionsToWalletPositions(result.positions, lookupMap))
      }
      for (const err of outcome.value.errors) {
        failedSources.push(`gap-v4-chain-${err.chainId}-spoke-${err.spokeName ?? 'unknown'}`)
      }
    } else {
      console.error(`[gap-v4] Chain ${chainId} failed:`, outcome.reason)
      failedSources.push(`gap-v4-chain-${chainId}`)
    }
  }

  return { positions, failedSources }
}

export function useGapFallbackQuery(
  params: Omit<FetchGapPositionsParams, 'address'> & { address: `0x${string}` | undefined; enabled?: boolean },
) {
  const { gapChainIds, address, enabled = true, ...rest } = params
  const hasGap = gapChainIds.v3Gap.length > 0 || gapChainIds.v4Gap.length > 0

  return useQuery({
    queryKey: ['gap-fallback-positions', gapChainIds, address],
    queryFn: () =>
      fetchGapPositions({ gapChainIds, address: address!, ...rest }),
    enabled: hasGap && !!address && enabled,
    staleTime: FALLBACK_STALE_TIME,
    gcTime: FALLBACK_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
