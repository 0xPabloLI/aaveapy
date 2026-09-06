/**
 * useOnchainHealthFactor — Fetches on-chain Health Factor baseline per pool/spoke.
 *
 * When a wallet is connected and portfolio entries exist, this hook multicalls
 * `getUserAccountData()` on each V3 Pool / V4 Spoke where the user has positions.
 * The result is a Map<poolKey, OnchainHfBaseline> that can be passed to
 * `simulatePortfolioFromEntries` as the `onchainHfMap` parameter.
 *
 * AAV-1253 (P7) — on-chain HF baseline for current → after → delta display.
 */
import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createPublicClient, http, type PublicClient } from 'viem'
import type { ReserveWithSpread } from '@/types/aave'
import type { PortfolioReserveEntry } from '@/types/portfolio'
import { getProtocolVersion } from '@/lib/protocolVersion'
import { V3_POOL_ADDRESSES, POOL_ABI, MULTICALL3_ADDRESS } from '@/lib/userData/aaveV3UserClient'
import { V4_SPOKE_ADDRESSES, SPOKE_ABI, MULTICALL3_ADDRESS as V4_MULTICALL3_ADDRESS } from '@/lib/userData/aaveV4UserClient'
import { createClientWithRpcRotation } from '@/lib/userData/rpcResilience'
import { wadToHf, type OnchainHfMap, type OnchainHfBaseline } from '@/lib/userData/onchainHealthFactor'
import { subscribeRefetch } from '@/lib/userData/refetchEvent'
import { QUERY_STALE_TIMES } from '@/config/queryStaleTimes'

export interface UseOnchainHealthFactorArgs {
  address: `0x${string}` | undefined
  entries: PortfolioReserveEntry[]
  reserves: ReserveWithSpread[]
}

export interface UseOnchainHealthFactorResult {
  onchainHfMap: OnchainHfMap | undefined
  isLoading: boolean
}

interface V3PoolTarget {
  chainId: number
  marketName: string
  poolAddress: `0x${string}`
}

interface V4SpokeTarget {
  chainId: number
  spokeAddress: `0x${string}`
  marketName: string
}

interface PoolTargets {
  v3Pools: V3PoolTarget[]
  v4Spokes: V4SpokeTarget[]
}

/**
 * Extract unique V3 pools and V4 spokes from portfolio entries + reserves.
 * Exported for unit testing (C5/C7/C17/C20).
 */
export function extractPoolTargets(
  entries: PortfolioReserveEntry[],
  reserves: ReserveWithSpread[],
): PoolTargets {
  const reserveMap = new Map(reserves.map(r => [r.reserveId, r]))
  const v3Seen = new Set<string>()
  const v4Seen = new Set<string>()
  const v3Pools: V3PoolTarget[] = []
  const v4Spokes: V4SpokeTarget[] = []

  for (const entry of entries) {
    if (entry.hidden || entry.isOrphan) continue
    const reserve = reserveMap.get(entry.reserveId)
    if (!reserve) continue

    const version = getProtocolVersion(reserve.marketName)
    const poolKey = `${reserve.chainId}:${reserve.marketName}`

    if (version === 'v3') {
      if (v3Seen.has(poolKey)) continue
      const poolAddress = V3_POOL_ADDRESSES[reserve.chainId]
      if (!poolAddress) continue
      v3Seen.add(poolKey)
      v3Pools.push({
        chainId: reserve.chainId,
        marketName: reserve.marketName,
        poolAddress: poolAddress as `0x${string}`,
      })
    } else {
      // V4 — match by spokeAddress
      if (!reserve.spokeAddress) continue
      if (v4Seen.has(poolKey)) continue
      v4Seen.add(poolKey)
      v4Spokes.push({
        chainId: reserve.chainId,
        spokeAddress: reserve.spokeAddress as `0x${string}`,
        marketName: reserve.marketName,
      })
    }
  }

  return { v3Pools, v4Spokes }
}

/** Minimal multicall result shape — viem returns positional tuples for multi-output calls. */
type BigintTupleResult =
  | { status: 'success'; result: readonly bigint[] }
  | { status: 'failure'; result?: undefined }

/** Call multicall without depending on viem's deeply-inferred parameter types. */
async function multicallBigintTuples(
  publicClient: PublicClient,
  params: Record<string, unknown>,
): Promise<BigintTupleResult[]> {
  const run = publicClient.multicall as unknown as (p: Record<string, unknown>) => Promise<unknown>
  return (await run(params)) as BigintTupleResult[]
}

/**
 * Fetch on-chain HF for a single V3 pool via getUserAccountData multicall.
 */
async function fetchV3PoolHf(
  target: V3PoolTarget,
  userAddress: `0x${string}`,
  client?: PublicClient,
): Promise<OnchainHfBaseline | null> {
  const publicClient = client ?? (await createClientWithRpcRotation(target.chainId))
  if (!publicClient) return null

  try {
    const results = await multicallBigintTuples(publicClient, {
      contracts: [{
        address: target.poolAddress,
        abi: POOL_ABI,
        functionName: 'getUserAccountData',
        args: [userAddress],
      }],
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: true,
    })

    const result = results[0]
    if (!result || result.status !== 'success' || !result.result) return null

    // getUserAccountData outputs: [totalCollateralBase, totalDebtBase, availableBorrowsBase,
    //                              currentLiquidationThreshold, ltv, healthFactor]
    const [totalCollateralBase, totalDebtBase, , , , healthFactor] = result.result
    return {
      healthFactor: wadToHf(healthFactor),
      totalCollateralUsd: Number(totalCollateralBase) / 1e8, // base units are 8 decimals (USD)
      totalDebtUsd: Number(totalDebtBase) / 1e8,
    }
  } catch (err) {
    console.error(`[onchain-hf] V3 pool ${target.marketName} (chain ${target.chainId}) failed:`, err)
    return null
  }
}

/**
 * Fetch on-chain HF for a single V4 spoke via getUserAccountData multicall.
 */
async function fetchV4SpokeHf(
  target: V4SpokeTarget,
  userAddress: `0x${string}`,
  client?: PublicClient,
): Promise<OnchainHfBaseline | null> {
  const publicClient = client ?? (await createClientWithRpcRotation(target.chainId))
  if (!publicClient) return null

  try {
    const results = await multicallBigintTuples(publicClient, {
      contracts: [{
        address: target.spokeAddress,
        abi: SPOKE_ABI,
        functionName: 'getUserAccountData',
        args: [userAddress],
      }],
      multicallAddress: V4_MULTICALL3_ADDRESS,
      allowFailure: true,
    })

    const result = results[0]
    if (!result || result.status !== 'success' || !result.result) return null

    // getUserAccountData outputs: [riskPremium, avgCollateralFactor, healthFactor,
    //                              totalCollateralValue, totalDebtValueRay, ...]
    const [, , healthFactor, totalCollateralValue, totalDebtValueRay] = result.result
    return {
      healthFactor: wadToHf(healthFactor),
      // V4 totalCollateralValue is in base units (8 decimals USD), totalDebtValueRay is in RAY
      totalCollateralUsd: Number(totalCollateralValue) / 1e8,
      totalDebtUsd: Number(totalDebtValueRay) / 1e27,
    }
  } catch (err) {
    console.error(`[onchain-hf] V4 spoke ${target.marketName} (chain ${target.chainId}) failed:`, err)
    return null
  }
}

/**
 * Fetch all on-chain HF baselines for the given pool targets.
 */
async function fetchOnchainHfBaselines(
  address: `0x${string}`,
  targets: PoolTargets,
): Promise<OnchainHfMap> {
  const map: OnchainHfMap = new Map()

  // Group V3 pools by chainId to share RPC clients
  const v3ByChain = new Map<number, V3PoolTarget[]>()
  for (const pool of targets.v3Pools) {
    const arr = v3ByChain.get(pool.chainId) ?? []
    arr.push(pool)
    v3ByChain.set(pool.chainId, arr)
  }

  // Group V4 spokes by chainId to share RPC clients
  const v4ByChain = new Map<number, V4SpokeTarget[]>()
  for (const spoke of targets.v4Spokes) {
    const arr = v4ByChain.get(spoke.chainId) ?? []
    arr.push(spoke)
    v4ByChain.set(spoke.chainId, arr)
  }

  // Fetch all in parallel
  const allChainIds = new Set([...v3ByChain.keys(), ...v4ByChain.keys()])
  const fetchPromises: Promise<void>[] = []

  for (const chainId of allChainIds) {
    const clientPromise = createClientWithRpcRotation(chainId)

    fetchPromises.push((async () => {
      const client = await clientPromise
      if (!client) return

      // V3 pools on this chain
      const v3Pools = v3ByChain.get(chainId) ?? []
      for (const pool of v3Pools) {
        const baseline = await fetchV3PoolHf(pool, address, client)
        if (baseline) {
          const poolKey = `${pool.chainId}:${pool.marketName}`
          map.set(poolKey, baseline)
        }
      }

      // V4 spokes on this chain
      const v4Spokes = v4ByChain.get(chainId) ?? []
      for (const spoke of v4Spokes) {
        const baseline = await fetchV4SpokeHf(spoke, address, client)
        if (baseline) {
          const poolKey = `${spoke.chainId}:${spoke.marketName}`
          map.set(poolKey, baseline)
        }
      }
    })())
  }

  await Promise.allSettled(fetchPromises)
  return map
}

/**
 * Simple hash of pool keys for React Query key.
 */
function hashPoolKeys(targets: PoolTargets): string {
  const keys = [
    ...targets.v3Pools.map(p => `${p.chainId}:${p.marketName}`),
    ...targets.v4Spokes.map(s => `${s.chainId}:${s.marketName}`),
  ].sort()
  return keys.join(',')
}

export function useOnchainHealthFactor({
  address,
  entries,
  reserves,
}: UseOnchainHealthFactorArgs): UseOnchainHealthFactorResult {
  const queryClient = useQueryClient()

  const targets = useMemo(() => extractPoolTargets(entries, reserves), [entries, reserves])
  const hasTargets = targets.v3Pools.length > 0 || targets.v4Spokes.length > 0
  const poolKeysHash = useMemo(() => hashPoolKeys(targets), [targets])

  const query = useQuery({
    queryKey: ['onchain-hf', address ?? 'no-wallet', poolKeysHash],
    queryFn: async () => {
      if (!address || !hasTargets) return undefined as OnchainHfMap | undefined
      return fetchOnchainHfBaselines(address, targets)
    },
    enabled: !!address && hasTargets,
    staleTime: QUERY_STALE_TIMES.default,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // Subscribe to refetch events (F5 / Refresh button / Watch Mode)
  useEffect(() => {
    if (!address) return () => undefined
    return subscribeRefetch(() => {
      void queryClient.invalidateQueries({ queryKey: ['onchain-hf', address] })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, queryClient])

  return {
    onchainHfMap: query.data,
    isLoading: query.isLoading,
  }
}
