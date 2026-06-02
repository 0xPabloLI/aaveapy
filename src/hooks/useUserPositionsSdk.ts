import { useMemo } from 'react'
import { useWallet } from './useWallet'
import { useQuery } from '@tanstack/react-query'
import { useUserSupplies as useV4UserSupplies, useUserBorrows as useV4UserBorrows } from '@aave/react'
import { useUserSupplies as useV3UserSupplies, useUserBorrows as useV3UserBorrows } from '@aave/react-v3'
import { getV3UserPositionsMultiChain, type V3AssetsByMarket } from '@/lib/userData/aaveV3UserClient'
import { getV4UserPositionsAllSpokes } from '@/lib/userData/aaveV4UserClient'
import {
  convertV3PositionsToWalletPositions,
  convertV4PositionsToWalletPositions,
  buildReserveLookupByChainAndToken,
} from '@/lib/userData/onchainPositionConverter'
import {
  convertSdkSuppliesToWalletPositions,
  convertSdkBorrowsToWalletPositions,
  buildReserveLookupByChainAndToken as buildSdkReserveLookup,
  buildReserveMap as buildSdkReserveMap,
} from '@/lib/userData/sdkPositionConverter'
import type { WalletPosition } from '@/lib/userData/userPositionMapper'
import type { SdkSupplyPosition, SdkBorrowPosition } from '@/lib/userData/sdkPositionConverter'
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

export function enrichV3SupplyPositions(
  positions: { market: { address: `0x${string}`; chain: { chainId: number; [k: string]: unknown }; [k: string]: unknown }; currency: { address: `0x${string}`; symbol: string; decimals: number; chainId: number; [k: string]: unknown }; balance: { amount: { value: string; raw: string; decimals: number; [k: string]: unknown }; [k: string]: unknown }; isCollateral: boolean; [k: string]: unknown }[],
): SdkSupplyPosition[] {
  return positions.map(p => ({
    reserve: {
      id: `${p.market.chain.chainId}:${p.market.address}:${p.currency.address}`,
      symbol: p.currency.symbol,
      decimals: p.currency.decimals,
      underlyingAsset: { address: p.currency.address, chain: { id: String(p.currency.chainId) } },
      spokeAddress: p.market.address,
    },
    balance: { amount: { value: p.balance.amount.value, onChainValue: BigInt(p.balance.amount.raw || '0'), decimals: p.balance.amount.decimals } },
    isCollateral: p.isCollateral,
  }))
}

export function enrichV3BorrowPositions(
  positions: { market: { address: `0x${string}`; chain: { chainId: number; [k: string]: unknown }; [k: string]: unknown }; currency: { address: `0x${string}`; symbol: string; decimals: number; chainId: number; [k: string]: unknown }; debt: { amount: { value: string; raw: string; decimals: number; [k: string]: unknown }; [k: string]: unknown }; [k: string]: unknown }[],
): SdkBorrowPosition[] {
  return positions.map(p => ({
    reserve: {
      id: `${p.market.chain.chainId}:${p.market.address}:${p.currency.address}`,
      symbol: p.currency.symbol,
      decimals: p.currency.decimals,
      underlyingAsset: { address: p.currency.address, chain: { id: String(p.currency.chainId) } },
      spokeAddress: p.market.address,
    },
    debt: { amount: { value: p.debt.amount.value, onChainValue: BigInt(p.debt.amount.raw || '0'), decimals: p.debt.amount.decimals } },
  }))
}

export function enrichV4SupplyPositions(
  positions: { id: string; reserve: { id: string; spoke: { address: `0x${string}`; chain: { chainId: number; [k: string]: unknown }; connectedHubs?: { hub: { name: string } }[]; [k: string]: unknown }; summary: { supplied: { token: { address: `0x${string}`; info: { symbol: string; decimals: number; [k: string]: unknown }; [k: string]: unknown }; [k: string]: unknown }; [k: string]: unknown }; [k: string]: unknown }; balance: { amount: { value: string; onChainValue: bigint; decimals: number; [k: string]: unknown }; [k: string]: unknown }; isCollateral: boolean; [k: string]: unknown }[],
): SdkSupplyPosition[] {
  return positions.map(p => ({
    reserve: {
      id: p.reserve.id,
      symbol: p.reserve.summary.supplied.token.info.symbol,
      decimals: p.reserve.summary.supplied.token.info.decimals,
      underlyingAsset: { address: p.reserve.summary.supplied.token.address, chain: { id: String(p.reserve.spoke.chain.chainId) } },
      spokeAddress: p.reserve.spoke.address,
      hubName: p.reserve.spoke.connectedHubs?.[0]?.hub.name,
    },
    balance: { amount: { value: p.balance.amount.value, onChainValue: p.balance.amount.onChainValue, decimals: p.balance.amount.decimals } },
    isCollateral: p.isCollateral,
  }))
}

export function enrichV4BorrowPositions(
  positions: { id: string; reserve: { id: string; spoke: { address: `0x${string}`; chain: { chainId: number; [k: string]: unknown }; connectedHubs?: { hub: { name: string } }[]; [k: string]: unknown }; summary: { borrowed: { token: { address: `0x${string}`; info: { symbol: string; decimals: number; [k: string]: unknown }; [k: string]: unknown }; [k: string]: unknown }; [k: string]: unknown }; [k: string]: unknown }; principal: { amount: { value: string; onChainValue: bigint; decimals: number; [k: string]: unknown }; [k: string]: unknown }; [k: string]: unknown }[],
): SdkBorrowPosition[] {
  return positions.map(p => ({
    reserve: {
      id: p.reserve.id,
      symbol: p.reserve.summary.borrowed.token.info.symbol,
      decimals: p.reserve.summary.borrowed.token.info.decimals,
      underlyingAsset: { address: p.reserve.summary.borrowed.token.address, chain: { id: String(p.reserve.spoke.chain.chainId) } },
      spokeAddress: p.reserve.spoke.address,
      hubName: p.reserve.spoke.connectedHubs?.[0]?.hub.name,
    },
    debt: { amount: { value: p.principal.amount.value, onChainValue: p.principal.amount.onChainValue, decimals: p.principal.amount.decimals } },
  }))
}

interface FetchFallbackParams {
  userAddress: `0x${string}`
  reserves: ReserveWithSpread[]
  v3AssetsByMarket: Record<string, V3AssetsByMarket>
  v4ReservesBySpoke: Record<string, { reserveId: bigint; asset: `0x${string}` }[]>
}

async function fetchV3Fallback(
  userAddress: `0x${string}`,
  reserves: ReserveWithSpread[],
  v3AssetsByMarket: Record<string, V3AssetsByMarket>,
): Promise<{ positions: WalletPosition[]; failedSources: string[] }> {
  const positions: WalletPosition[] = []
  const failedSources: string[] = []
  const v3MarketNames = Object.keys(v3AssetsByMarket)
  if (v3MarketNames.length === 0) return { positions, failedSources }

  const lookupMap = buildReserveLookupByChainAndToken(reserves)
  try {
    const v3Response = await getV3UserPositionsMultiChain(userAddress, v3AssetsByMarket)
    for (const result of v3Response.results) {
      positions.push(...convertV3PositionsToWalletPositions(result.positions, lookupMap))
    }
    for (const err of v3Response.errors) {
      failedSources.push(`onchain-v3-chain-${err.chainId}`)
    }
  } catch {
    failedSources.push('onchain-v3')
  }
  return { positions, failedSources }
}

async function fetchV4Fallback(
  userAddress: `0x${string}`,
  reserves: ReserveWithSpread[],
  v4ReservesBySpoke: Record<string, { reserveId: bigint; asset: `0x${string}` }[]>,
): Promise<{ positions: WalletPosition[]; failedSources: string[] }> {
  const positions: WalletPosition[] = []
  const failedSources: string[] = []

  const lookupMap = buildReserveLookupByChainAndToken(reserves)
  try {
    const v4Response = await getV4UserPositionsAllSpokes(1, userAddress, v4ReservesBySpoke)
    for (const result of v4Response.results) {
      positions.push(...convertV4PositionsToWalletPositions(result.positions, lookupMap))
    }
    for (const err of v4Response.errors) {
      failedSources.push(`onchain-v4-chain-${err.chainId}-spoke-${err.spokeName ?? 'unknown'}`)
    }
  } catch {
    failedSources.push('onchain-v4')
  }
  return { positions, failedSources }
}

export function useUserPositionsSdk(
  reserves: ReserveWithSpread[],
  v3AssetsByMarket: Record<string, V3AssetsByMarket>,
  v4ReservesBySpoke: Record<string, { reserveId: bigint; asset: `0x${string}` }[]>,
) {
  const { address, isConnected } = useWallet()

  const enabled = isConnected && !!address
  const account = (enabled ? address : undefined) as `0x${string}`

  const v3Supplies = useV3UserSupplies({ account }, { enabled })
  const v3Borrows = useV3UserBorrows({ account }, { enabled })
  const v4Supplies = useV4UserSupplies({ account }, { enabled })
  const v4Borrows = useV4UserBorrows({ account }, { enabled })

  const sdkLoading = v3Supplies.loading || v3Borrows.loading || v4Supplies.loading || v4Borrows.loading
  const v3SdkFailed = !!v3Supplies.error || !!v3Borrows.error
  const v4SdkFailed = !!v4Supplies.error || !!v4Borrows.error

  const fallbackQuery = useQuery({
    queryKey: ['user-positions-fallback', address ?? 'no-wallet', v3SdkFailed, v4SdkFailed],
    queryFn: async () => {
      if (!address) return { positions: [], failedSources: [] }
      const positions: WalletPosition[] = []
      const failedSources: string[] = []

      if (v3SdkFailed) {
        const v3 = await fetchV3Fallback(address, reserves, v3AssetsByMarket)
        positions.push(...v3.positions)
        failedSources.push(...v3.failedSources, 'sdk-v3-fallback')
      }
      if (v4SdkFailed) {
        const v4 = await fetchV4Fallback(address, reserves, v4ReservesBySpoke)
        positions.push(...v4.positions)
        failedSources.push(...v4.failedSources, 'sdk-v4-fallback')
      }
      return { positions, failedSources }
    },
    enabled: enabled && (v3SdkFailed || v4SdkFailed) && !sdkLoading,
    staleTime: STALE_TIME,
  })

  const allPositions: WalletPosition[] = []
  const allFailedSources: string[] = []

  const sdkLookupMap = useMemo(() => buildSdkReserveLookup(reserves), [reserves])
  const sdkReserveMap = useMemo(() => buildSdkReserveMap(reserves), [reserves])

  if (!v3SdkFailed && v3Supplies.data && v3Borrows.data) {
    allPositions.push(...convertSdkSuppliesToWalletPositions(enrichV3SupplyPositions(v3Supplies.data), sdkReserveMap, sdkLookupMap, 'sdk'))
    allPositions.push(...convertSdkBorrowsToWalletPositions(enrichV3BorrowPositions(v3Borrows.data), sdkReserveMap, sdkLookupMap, 'sdk'))
  } else if (v3SdkFailed) {
    allFailedSources.push('sdk-v3')
    if (fallbackQuery.data) {
      allPositions.push(...fallbackQuery.data.positions.filter(p => p.source === 'onchain-v3'))
      allFailedSources.push(...fallbackQuery.data.failedSources.filter(s => s.startsWith('onchain-v3') || s.startsWith('sdk-v3')))
    }
  }

  if (!v4SdkFailed && v4Supplies.data && v4Borrows.data) {
    allPositions.push(...convertSdkSuppliesToWalletPositions(enrichV4SupplyPositions(v4Supplies.data), sdkReserveMap, sdkLookupMap, 'sdk'))
    allPositions.push(...convertSdkBorrowsToWalletPositions(enrichV4BorrowPositions(v4Borrows.data), sdkReserveMap, sdkLookupMap, 'sdk'))
  } else if (v4SdkFailed) {
    allFailedSources.push('sdk-v4')
    if (fallbackQuery.data) {
      allPositions.push(...fallbackQuery.data.positions.filter(p => p.source === 'onchain-v4'))
      allFailedSources.push(...fallbackQuery.data.failedSources.filter(s => s.startsWith('onchain-v4') || s.startsWith('sdk-v4')))
    }
  }

  const isLoading = sdkLoading || fallbackQuery.isLoading
  const isError = !isLoading && allPositions.length === 0 && allFailedSources.length > 0
  const retry = () => fallbackQuery.refetch()

  let walletLoadState: WalletLoadState
  if (!isConnected || !address) {
    walletLoadState = 'idle'
  } else if (isLoading) {
    walletLoadState = 'loading'
  } else if (isError) {
    walletLoadState = 'error'
  } else if (allPositions.length === 0 && allFailedSources.length === 0) {
    walletLoadState = 'success-empty'
  } else {
    walletLoadState = 'success'
  }

  let result: DegradedResult
  if (isError) {
    result = { status: 'error', error: new Error('All sources failed'), retry }
  } else if (allFailedSources.length > 0) {
    result = { status: 'partial', data: { positions: allPositions, failedSources: allFailedSources }, retry }
  } else if (allPositions.length > 0 || walletLoadState === 'success-empty') {
    result = { status: 'success', data: { positions: allPositions, failedSources: allFailedSources } }
  } else {
    result = { status: 'error', error: new Error('No data'), retry }
  }

  return {
    walletLoadState,
    result,
    v3SdkFailed,
    v4SdkFailed,
    isLoading,
  }
}
