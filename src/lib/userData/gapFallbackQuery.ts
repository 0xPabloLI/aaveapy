import { useQuery } from '@tanstack/react-query'
import type { V3AssetsByMarket } from './aaveV3UserClient'
import type { WalletPosition } from './userPositionMapper'
import type { ReserveWithSpread } from '@/types/aave'
import type { GapChainIds } from './gapChainComputation'
import { fetchFallbackPositions, type FallbackPositionsConfig, type ChainFilter, type FallbackLabels } from './fallbackPositions'
import { V4_SPOKE_ADDRESSES } from './aaveV4UserClient'
import { FALLBACK_STALE_TIME, FALLBACK_GC_TIME } from './fallbackConstants'

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

  const config: FallbackPositionsConfig = {
    userAddress: address,
    reserves,
    v3AssetsByMarket,
    v4ReservesBySpoke,
    v4ChainIds: Object.keys(V4_SPOKE_ADDRESSES).map(Number),
  }

  const chainFilter: ChainFilter = {
    v3ChainIds: new Set(gapChainIds.v3Gap),
    v4ChainIds: [...gapChainIds.v4Gap],
  }

  const labels: FallbackLabels = {
    v3Prefix: 'gap-v3',
    v4Prefix: 'gap-v4',
  }

  return fetchFallbackPositions(config, chainFilter, labels)
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
