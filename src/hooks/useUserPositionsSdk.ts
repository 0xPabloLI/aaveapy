import { useEffect, useMemo } from 'react'
import { useWallet } from './useWallet'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useUserSupplies as useV4UserSupplies,
  useUserBorrows as useV4UserBorrows,
  useAaveClient as useV4AaveClient,
} from '@aave/react'
import {
  useUserSupplies as useV3UserSupplies,
  useUserBorrows as useV3UserBorrows,
  useAaveClient as useV3AaveClient,
} from '@aave/react-v3'
import {
  UserSuppliesQuery as V4UserSuppliesQuery,
  UserBorrowsQuery as V4UserBorrowsQuery,
} from '@aave/graphql'
// `@aave/react-v3` ships its own bundled copy of `@aave/graphql` (V3 schema),
// so the V3 urql client tracks the V3 document — not the V4 one. We must
// pass the matching document to `refreshQueryWhere` or the query hash will
// not match any active operation. The V3 docs are reached through a
// project-local Vite alias (see `vite.config.ts`) because Vite blocks deep
// `node_modules/...` paths via the `@aave/react` `exports` field.
// See ADR-0015 §S4.
import {
  UserSuppliesQuery as V3UserSuppliesQuery,
  UserBorrowsQuery as V3UserBorrowsQuery,
} from '@aave/react-v3/graphql-queries'
import { evmAddress, chainId } from '@aave/types'
import { type V3AssetsByMarket, V3_POOL_ADDRESSES } from '@/lib/userData/aaveV3UserClient'
import { V4_SPOKE_ADDRESSES } from '@/lib/userData/aaveV4UserClient'
import { getProtocolVersion } from '@/lib/protocolVersion'
import { fetchFallbackPositions, type FallbackPositionsConfig, type FallbackLabels } from '@/lib/userData/fallbackPositions'
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
import { composeReserveId } from '@/lib/reserveKey'
import { isInfrastructureFailure } from '@/lib/userData/rpcResilience'
import { computeGapChainIds, type SdkCoverage } from '@/lib/userData/gapChainComputation'
import { useGapFallbackQuery } from '@/lib/userData/gapFallbackQuery'
import { mergeAndDedupPositions, mergeFailedSources } from '@/lib/userData/positionMerge'
import { subscribeRefetch } from '@/lib/userData/refetchEvent'

interface SdkQueryResult {
  loading: boolean
  error?: unknown
  data?: unknown
}

interface RefreshableClient {
  refreshQueryWhere: (document: unknown, predicate: (variables: never) => boolean) => unknown
}

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
import { FALLBACK_STALE_TIME, FALLBACK_GC_TIME } from '@/lib/userData/fallbackConstants'

export function enrichV3SupplyPositions(
  positions: { market: { address: `0x${string}`; chain: { chainId: number; [k: string]: unknown }; [k: string]: unknown }; currency: { address: `0x${string}`; symbol: string; decimals: number; chainId: number; [k: string]: unknown }; balance: { amount: { value: string; raw: string; decimals: number; [k: string]: unknown }; [k: string]: unknown }; isCollateral: boolean; [k: string]: unknown }[],
): SdkSupplyPosition[] {
  return positions.map(p => ({
    reserve: {
      id: composeReserveId(p.market.chain.chainId, p.market.address, p.currency.address) ?? '',
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
      id: composeReserveId(p.market.chain.chainId, p.market.address, p.currency.address) ?? '',
      symbol: p.currency.symbol,
      decimals: p.currency.decimals,
      underlyingAsset: { address: p.currency.address, chain: { id: String(p.currency.chainId) } },
      spokeAddress: p.market.address,
    },
    debt: { amount: { value: p.debt.amount.value, onChainValue: BigInt(p.debt.amount.raw || '0'), decimals: p.debt.amount.decimals } },
  }))
}

export function enrichV4SupplyPositions(
  positions: { id: string; reserve: { id: string; spoke: { address: `0x${string}`; chain: { chainId: number; [k: string]: unknown }; connectedHubs?: { hub: { name: string; address?: string } }[]; [k: string]: unknown }; summary: { supplied: { token: { address: `0x${string}`; info: { symbol: string; decimals: number; [k: string]: unknown }; [k: string]: unknown }; [k: string]: unknown }; [k: string]: unknown }; [k: string]: unknown }; balance: { amount: { value: string; onChainValue: bigint; decimals: number; [k: string]: unknown }; [k: string]: unknown }; isCollateral: boolean; [k: string]: unknown }[],
): SdkSupplyPosition[] {
  return positions.map(p => ({
    reserve: {
      // SDK reserve.id is Base64-encoded opaque ID, not usable for reserveMap lookup
      id: p.reserve.id,
      symbol: p.reserve.summary.supplied.token.info.symbol,
      decimals: p.reserve.summary.supplied.token.info.decimals,
      underlyingAsset: { address: p.reserve.summary.supplied.token.address, chain: { id: String(p.reserve.spoke.chain.chainId) } },
      spokeAddress: p.reserve.spoke.address,
      hubName: p.reserve.spoke.connectedHubs?.[0]?.hub.name,
      hubAddresses: p.reserve.spoke.connectedHubs?.map(h => h.hub.address) as `0x${string}`[] | undefined,
    },
    balance: { amount: { value: p.balance.amount.value, onChainValue: p.balance.amount.onChainValue, decimals: p.balance.amount.decimals } },
    isCollateral: p.isCollateral,
  }))
}

export function enrichV4BorrowPositions(
  positions: { id: string; reserve: { id: string; spoke: { address: `0x${string}`; chain: { chainId: number; [k: string]: unknown }; connectedHubs?: { hub: { name: string; address?: string } }[]; [k: string]: unknown }; summary: { borrowed: { token: { address: `0x${string}`; info: { symbol: string; decimals: number; [k: string]: unknown }; [k: string]: unknown }; [k: string]: unknown }; [k: string]: unknown }; [k: string]: unknown }; principal: { amount: { value: string; onChainValue: bigint; decimals: number; [k: string]: unknown }; [k: string]: unknown }; [k: string]: unknown }[],
): SdkBorrowPosition[] {
  return positions.map(p => ({
    reserve: {
      // SDK reserve.id is Base64-encoded opaque ID, not usable for reserveMap lookup
      id: p.reserve.id,
      symbol: p.reserve.summary.borrowed.token.info.symbol,
      decimals: p.reserve.summary.borrowed.token.info.decimals,
      underlyingAsset: { address: p.reserve.summary.borrowed.token.address, chain: { id: String(p.reserve.spoke.chain.chainId) } },
      spokeAddress: p.reserve.spoke.address,
      hubName: p.reserve.spoke.connectedHubs?.[0]?.hub.name,
      hubAddresses: p.reserve.spoke.connectedHubs?.map(h => h.hub.address) as `0x${string}`[] | undefined,
    },
    debt: { amount: { value: p.principal.amount.value, onChainValue: p.principal.amount.onChainValue, decimals: p.principal.amount.decimals } },
  }))
}

async function fetchOnchainFallback(
  userAddress: `0x${string}`,
  reserves: ReserveWithSpread[],
  v3AssetsByMarket: Record<string, V3AssetsByMarket>,
  v4ReservesBySpoke: Record<string, { reserveId: bigint; asset: `0x${string}` }[]>,
): Promise<{ positions: WalletPosition[]; failedSources: string[] }> {
  const config: FallbackPositionsConfig = {
    userAddress,
    reserves,
    v3AssetsByMarket,
    v4ReservesBySpoke,
    v4ChainIds: Object.keys(V4_SPOKE_ADDRESSES).map(Number),
  }
  const labels: FallbackLabels = {
    v3Prefix: 'onchain-v3',
    v4Prefix: 'onchain-v4',
  }
  return fetchFallbackPositions(config, {}, labels)
}

export function buildV3MarketInputs(
  reserves: ReserveWithSpread[],
): { address: ReturnType<typeof evmAddress>; chainId: ReturnType<typeof chainId> }[] {
  const seen = new Set<string>()
  const inputs: { address: ReturnType<typeof evmAddress>; chainId: ReturnType<typeof chainId> }[] = []
  for (const r of reserves) {
    if (getProtocolVersion(r.marketName) === 'v4') continue
    const pool = V3_POOL_ADDRESSES[r.chainId]
    if (!pool) continue
    const key = `${r.chainId}:${pool}`
    if (seen.has(key)) continue
    seen.add(key)
    inputs.push({ address: evmAddress(pool), chainId: chainId(r.chainId) })
  }
  return inputs
}

export function buildV4ChainIds(
  reserves: ReserveWithSpread[],
): number[] {
  const chainIdsSet = new Set<number>()
  for (const r of reserves) {
    if (getProtocolVersion(r.marketName) === 'v4') chainIdsSet.add(r.chainId)
  }
  return [...chainIdsSet]
}

export function buildV3SdkArgs(
  enabled: boolean,
  account: `0x${string}` | undefined,
  v3MarketInputs: ReturnType<typeof buildV3MarketInputs>,
) {
  if (!enabled || !account || v3MarketInputs.length === 0) {
    return { markets: [{ address: evmAddress('0x0000000000000000000000000000000000000000'), chainId: chainId(1) }], user: evmAddress('0x0000000000000000000000000000000000000000') }
  }
  return { markets: v3MarketInputs, user: evmAddress(account) }
}

export function buildV4SdkArgs(
  enabled: boolean,
  account: `0x${string}` | undefined,
  v4ChainIds: number[],
) {
  if (!enabled || !account || v4ChainIds.length === 0) {
    return { query: { userChains: { user: evmAddress('0x0000000000000000000000000000000000000000'), chainIds: [chainId(1)] } } }
  }
  return { query: { userChains: { user: evmAddress(account), chainIds: v4ChainIds.map(id => chainId(id)) } } }
}

export function useUserPositionsSdk(
  reserves: ReserveWithSpread[],
  v3AssetsByMarket: Record<string, V3AssetsByMarket>,
  v4ReservesBySpoke: Record<string, { reserveId: bigint; asset: `0x${string}` }[]>,
) {
  const { address, isConnected } = useWallet()
  const queryClient = useQueryClient()
  // Both V3 and V4 AaveClient are provided via nested <AaveProvider> trees in
  // `AaveProviders`. Each client tracks its own urql query registry, so we
  // must call `refreshQueryWhere` on each one to invalidate every active
  // user-position query. See ADR-0015 §S4.
  const v3Client = useV3AaveClient() as unknown as RefreshableClient
  const v4Client = useV4AaveClient() as unknown as RefreshableClient

  const enabled = isConnected && !!address
  const account = (enabled ? address : undefined) as `0x${string}`

  const v3MarketInputs = useMemo(() => buildV3MarketInputs(reserves), [reserves])

  const v4ChainIds = useMemo(() => buildV4ChainIds(reserves), [reserves])

  const v3SdkArgs = useMemo(() => buildV3SdkArgs(enabled, account, v3MarketInputs), [enabled, account, v3MarketInputs])

  const v4SdkArgs = useMemo(() => buildV4SdkArgs(enabled, account, v4ChainIds), [enabled, account, v4ChainIds])

  const sdkCoverage = useMemo<SdkCoverage>(() => ({
    v3SdkChainIds: Object.keys(V3_POOL_ADDRESSES).map(Number),
    v4SdkChainIds: Object.keys(V4_SPOKE_ADDRESSES).map(Number),
  }), [])

  const gapChainIds = useMemo(
    () => computeGapChainIds(reserves, sdkCoverage),
    [reserves, sdkCoverage],
  )

  // The V3 package bundles its own copy of `@aave/types`, so the branded
  // `EvmAddress` nominal type differs from the root one. Structurally the
  // values are identical; cast to bridge the duplicated brand.
  const v3Supplies = useV3UserSupplies(v3SdkArgs as never) as unknown as SdkQueryResult
  const v3Borrows = useV3UserBorrows(v3SdkArgs as never) as unknown as SdkQueryResult
  const v4Supplies = useV4UserSupplies(v4SdkArgs)
  const v4Borrows = useV4UserBorrows(v4SdkArgs)

  const sdkLoading = v3Supplies.loading || v3Borrows.loading || v4Supplies.loading || v4Borrows.loading
  const v3SdkFailed = isInfrastructureFailure(v3Supplies.error) || isInfrastructureFailure(v3Borrows.error)
  const v4SdkFailed = isInfrastructureFailure(v4Supplies.error) || isInfrastructureFailure(v4Borrows.error)

  if (v3SdkFailed) {
    console.error('[sdk-v3] V3 SDK failed:', v3Supplies.error ?? v3Borrows.error)
  }
  if (v4SdkFailed) {
    console.error('[sdk-v4] V4 SDK failed:', v4Supplies.error ?? v4Borrows.error)
  }

  const onchainFallbackQuery = useQuery({
    queryKey: ['user-positions-onchain-fallback', address ?? 'no-wallet', v3SdkFailed, v4SdkFailed],
    queryFn: async () => {
      if (!address) return { positions: [] as WalletPosition[], failedSources: [] as string[] }
      const failedLabels: string[] = []
      if (v3SdkFailed) failedLabels.push('sdk-v3-fallback')
      if (v4SdkFailed) failedLabels.push('sdk-v4-fallback')
      console.info('[onchain-fallback] Fetching onchain fallback positions, reserves:', reserves.length)
      const result = await fetchOnchainFallback(address, reserves, v3AssetsByMarket, v4ReservesBySpoke)
      return { positions: result.positions, failedSources: [...result.failedSources, ...failedLabels] }
    },
    enabled: enabled && (v3SdkFailed || v4SdkFailed) && !sdkLoading,
    staleTime: FALLBACK_STALE_TIME,
    gcTime: FALLBACK_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const v3SdkSucceeded = !v3SdkFailed && !sdkLoading
  const v4SdkSucceeded = !v4SdkFailed && !sdkLoading
  const hasV3Gap = gapChainIds.v3Gap.length > 0 && v3SdkSucceeded
  const hasV4Gap = gapChainIds.v4Gap.length > 0 && v4SdkSucceeded

  const gapFallbackQuery = useGapFallbackQuery({
    gapChainIds,
    address: account,
    reserves,
    v3AssetsByMarket,
    v4ReservesBySpoke,
    enabled: enabled && !sdkLoading && (hasV3Gap || hasV4Gap),
  })

  // Subscribe to the unified `refetchEvent` emitter. On every bump (F5,
  // Refresh button, Watch Mode re-submit) we:
  //   1. Invalidate the onchain-fallback RQ key so the RPC fallback replays.
  //   2. Refetch the gap-fallback query (covers chains the SDK does not
  //      support).
  //   3. Call `refreshQueryWhere` on the V3 + V4 AaveClient to refresh the
  //      urql-tracked `UserSupplies` / `UserBorrows` queries. Without
  //      this, the SDK paths would still serve stale data because the urql
  //      cache is keyed by the (stale) `args` reference. See ADR-0015 §S4.
  //
  // The subscription is re-established on every address change so the
  // closure captures the current `address`. The returned unsubscribe is
  // called on unmount or before the next subscription is created.
  useEffect(() => {
    if (!address) return () => undefined
    return subscribeRefetch(() => {
      void queryClient.invalidateQueries({
        queryKey: ['user-positions-onchain-fallback', address],
      })
      void gapFallbackQuery.refetch()

      // V3: `request.user` is a branded EVM address. The brand may or may
      // not normalize the underlying hex (depends on the Aave SDK version),
      // and wagmi returns EIP-55 checksummed addresses, so we compare
      // case-insensitively to remove the ambiguity. A safe EOA address is
      // 42 chars; `toLowerCase` is a single pass and adds no measurable
      // cost over the predicate call.
      const v3Matches = (user: unknown) =>
        typeof user === 'string' && user.toLowerCase() === address.toLowerCase()
      void v3Client.refreshQueryWhere(
        V3UserSuppliesQuery,
        ((variables: { request: { user: unknown } }) => v3Matches(variables.request.user)) as never,
      )
      void v3Client.refreshQueryWhere(
        V3UserBorrowsQuery,
        ((variables: { request: { user: unknown } }) => v3Matches(variables.request.user)) as never,
      )

      // V4: `request.query` is a union of `userChains` and `userSpoke`.
      // The app always uses `userChains` (see `buildV4SdkArgs`), but we
      // still defensively check `userSpoke` to be future-proof.
      const matchesV4User = (
        variables: { request: { query: { userChains?: { user: unknown }; userSpoke?: { user: unknown } } } },
      ) => {
        const q = variables.request.query
        return v3Matches(q.userChains?.user) || v3Matches(q.userSpoke?.user)
      }
      void v4Client.refreshQueryWhere(V4UserSuppliesQuery, matchesV4User as never)
      void v4Client.refreshQueryWhere(V4UserBorrowsQuery, matchesV4User as never)
    })
    // Deps rationale:
    //   * `address` — must re-subscribe on wallet change so the captured
    //     `address` stays accurate and the predicate matches the new user.
    //   * `queryClient` — included for clarity; RQ clients are stable across
    //     renders in practice but we keep the dep so future refactors that
    //     swap the provider don't silently capture a stale client.
    //   * `gapFallbackQuery` / `v3Client` / `v4Client` — omitted: their
    //     `refetch` functions and urql client instances are stable refs
    //     held in module / provider scope. Including them would re-subscribe
    //     on every render with no behavioral change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, queryClient])

  const sdkPositions: WalletPosition[] = []
  const sdkFailed: string[] = []
  const fallbackPositions: WalletPosition[] = []
  const fallbackFailed: string[] = []

  const sdkLookupMap = useMemo(() => buildSdkReserveLookup(reserves), [reserves])
  const sdkReserveMap = useMemo(() => buildSdkReserveMap(reserves), [reserves])

  if (!v3SdkFailed && v3Supplies.data && v3Borrows.data) {
    sdkPositions.push(...convertSdkSuppliesToWalletPositions(enrichV3SupplyPositions(v3Supplies.data as unknown as Parameters<typeof enrichV3SupplyPositions>[0]), sdkReserveMap, sdkLookupMap, 'sdk'))
    sdkPositions.push(...convertSdkBorrowsToWalletPositions(enrichV3BorrowPositions(v3Borrows.data as unknown as Parameters<typeof enrichV3BorrowPositions>[0]), sdkReserveMap, sdkLookupMap, 'sdk'))
  } else if (v3SdkFailed) {
    sdkFailed.push('sdk-v3')
  }

  if (!v4SdkFailed && v4Supplies.data && v4Borrows.data) {
    sdkPositions.push(...convertSdkSuppliesToWalletPositions(enrichV4SupplyPositions(v4Supplies.data as unknown as Parameters<typeof enrichV4SupplyPositions>[0]), sdkReserveMap, sdkLookupMap, 'sdk'))
    sdkPositions.push(...convertSdkBorrowsToWalletPositions(enrichV4BorrowPositions(v4Borrows.data as unknown as Parameters<typeof enrichV4BorrowPositions>[0]), sdkReserveMap, sdkLookupMap, 'sdk'))
  } else if (v4SdkFailed) {
    sdkFailed.push('sdk-v4')
  }

  if ((v3SdkFailed || v4SdkFailed) && onchainFallbackQuery.data) {
    fallbackPositions.push(...onchainFallbackQuery.data.positions)
    fallbackFailed.push(...onchainFallbackQuery.data.failedSources)
  }

  const gapPositions = gapFallbackQuery.data?.positions ?? []
  const gapFailed = gapFallbackQuery.data?.failedSources ?? []

  const allPositions = mergeAndDedupPositions(sdkPositions, fallbackPositions, gapPositions)
  const allFailedSources = mergeFailedSources(sdkFailed, fallbackFailed, gapFailed)

  const isLoading = sdkLoading || onchainFallbackQuery.isLoading || gapFallbackQuery.isLoading
  const isError = !isLoading && allPositions.length === 0 && allFailedSources.length > 0
  const retry = () => { onchainFallbackQuery.refetch(); gapFallbackQuery.refetch() }

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
