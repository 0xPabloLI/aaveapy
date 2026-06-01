import { useWallet } from './useWallet'
import { useQuery } from '@tanstack/react-query'
import { getV3UserPositionsMultiChain, type V3AssetsByMarket } from '@/lib/userData/aaveV3UserClient'
import { getV4UserPositionsAllSpokes } from '@/lib/userData/aaveV4UserClient'
import {
  convertV3PositionsToWalletPositions,
  convertV4PositionsToWalletPositions,
  buildReserveLookupByChainAndToken,
} from '@/lib/userData/onchainPositionConverter'
import type { WalletPosition } from '@/lib/userData/userPositionMapper'
import type { ReserveWithSpread } from '@/types/aave'
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes'

export type WalletLoadState = 'idle' | 'loading' | 'success-empty' | 'success' | 'error'

export interface UserPositionsData {
  positions: WalletPosition[]
  failedSources: string[]
}

export type DegradedResult =
  | { status: 'success'; data: UserPositionsData }
  | { status: 'partial'; data: UserPositionsData; retry: () => void }
  | { status: 'error'; error: Error; retry: () => void }

const STALE_TIME = QUERY_STALE_TIMES.default

interface FetchPositionsParams {
  userAddress: `0x${string}`
  reserves: ReserveWithSpread[]
  v3AssetsByMarket: Record<string, V3AssetsByMarket>
  v4ReservesBySpoke: Record<string, { reserveId: bigint; asset: `0x${string}` }[]>
}

async function fetchOnchainPositions(params: FetchPositionsParams): Promise<UserPositionsData> {
  const { userAddress, reserves, v3AssetsByMarket, v4ReservesBySpoke } = params
  const lookupMap = buildReserveLookupByChainAndToken(reserves)
  const positions: WalletPosition[] = []
  const failedSources: string[] = []

  const v3MarketNames = Object.keys(v3AssetsByMarket)
  if (v3MarketNames.length > 0) {
    try {
      const v3Response = await getV3UserPositionsMultiChain(userAddress, v3AssetsByMarket)
      for (const result of v3Response.results) {
        positions.push(...convertV3PositionsToWalletPositions(result.positions, lookupMap))
      }
      for (const err of v3Response.errors) {
        failedSources.push(`onchain-v3-chain-${err.chainId}`)
      }
    } catch (e) {
      failedSources.push('onchain-v3')
    }
  }

  const v4ChainIds = [1]
  for (const chainId of v4ChainIds) {
    try {
      const v4Response = await getV4UserPositionsAllSpokes(chainId, userAddress, v4ReservesBySpoke)
      for (const result of v4Response.results) {
        positions.push(...convertV4PositionsToWalletPositions(result.positions, lookupMap))
      }
      for (const err of v4Response.errors) {
        failedSources.push(`onchain-v4-chain-${err.chainId}-spoke-${err.spokeName ?? 'unknown'}`)
      }
    } catch (e) {
      failedSources.push('onchain-v4')
    }
  }

  return { positions, failedSources }
}

export function useUserPositions(
  reserves: ReserveWithSpread[],
  v3AssetsByMarket: Record<string, V3AssetsByMarket>,
  v4ReservesBySpoke: Record<string, { reserveId: bigint; asset: `0x${string}` }[]>,
) {
  const { address, isConnected } = useWallet()

  const query = useQuery({
    queryKey: ['user-positions', address ?? 'no-wallet'],
    queryFn: () => fetchOnchainPositions({
      userAddress: address!,
      reserves,
      v3AssetsByMarket,
      v4ReservesBySpoke,
    }),
    enabled: isConnected && !!address,
    staleTime: STALE_TIME,
  })

  const retry = () => query.refetch()

  let walletLoadState: WalletLoadState
  if (!isConnected || !address) {
    walletLoadState = 'idle'
  } else if (query.isLoading) {
    walletLoadState = 'loading'
  } else if (query.isError) {
    walletLoadState = 'error'
  } else if (query.data && query.data.positions.length === 0 && query.data.failedSources.length === 0) {
    walletLoadState = 'success-empty'
  } else {
    walletLoadState = 'success'
  }

  let result: DegradedResult
  if (query.isError) {
    result = { status: 'error', error: query.error as Error, retry }
  } else if (query.data) {
    if (query.data.failedSources.length > 0) {
      result = { status: 'partial', data: query.data, retry }
    } else {
      result = { status: 'success', data: query.data }
    }
  } else {
    result = { status: 'error', error: new Error('No data'), retry }
  }

  return {
    ...query,
    walletLoadState,
    result,
  }
}
