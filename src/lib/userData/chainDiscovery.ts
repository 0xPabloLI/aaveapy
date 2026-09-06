/**
 * Runtime chain discovery — detects chains present in reserves that are NOT
 * in the static registry, fetches their RPC URLs from public chain lists,
 * and makes them available for on-chain fallback.
 *
 * RPC URL resolution priority (highest → lowest):
 *   1. chainRegistry.ts — curated RPC URLs (multiple, load-balanced)
 *   2. chainid.network/chains.json — bulk EVM chain registry (runtime fetch)
 *   3. chainlist.org/rpcs.json — bulk RPC list with rich metadata (runtime fetch)
 *
 * Sources 2-3 only provide bulk endpoints (no per-chain JSON API).
 * The bulk data is fetched once, cached with a long TTL, and searched locally.
 */

export interface DiscoveredChainInfo {
  chainId: number
  name: string
  nativeCurrency?: { name: string; symbol: string; decimals: number }
  rpcUrls: string[]
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface ChainIdNetworkEntry { chainId: number; name: string; rpc: string[]; nativeCurrency?: { name: string; symbol: string; decimals: number } }
interface ChainlistOrgEntry { chainId: number; name: string; rpc: Array<{ url: string } | string> }

interface BulkCache {
  chainIdNetworkMap: Map<number, ChainIdNetworkEntry> | null
  chainlistOrgMap: Map<number, ChainlistOrgEntry> | null
  fetchedAt: number
}

const discoveredChains = new Map<number, DiscoveredChainInfo>()
let bulkCache: BulkCache = { chainIdNetworkMap: null, chainlistOrgMap: null, fetchedAt: 0 }
let bulkCachePromise: Promise<void> | null = null

let checkRegistered: ((chainId: number) => boolean) = () => false
let getStaticRpcUrls: ((chainId: number) => string[]) = () => []
let getWagmiChainRpcUrls: ((chainId: number) => string[]) = () => []

export function setRegistryChecker(check: (chainId: number) => boolean): void {
  checkRegistered = check
}

export function setStaticRpcUrlGetter(getter: (chainId: number) => string[]): void {
  getStaticRpcUrls = getter
}

export function setWagmiChainRpcUrlGetter(getter: (chainId: number) => string[]): void {
  getWagmiChainRpcUrls = getter
}

function isRegisteredChain(chainId: number): boolean {
  return checkRegistered(chainId)
}

function isCacheValid(): boolean {
  return bulkCache.fetchedAt > 0 && Date.now() - bulkCache.fetchedAt < CACHE_TTL_MS
}

async function ensureBulkCache(): Promise<void> {
  if (isCacheValid()) return
  if (bulkCachePromise) return bulkCachePromise

  bulkCachePromise = (async () => {
    try {
      const [chainIdResult, chainlistResult] = await Promise.allSettled([
        fetch('https://chainid.network/chains.json').then(async (res) => {
          if (!res.ok) return null
          return res.json()
        }),
        fetch('https://chainlist.org/rpcs.json').then(async (res) => {
          if (!res.ok) return null
          return res.json()
        }),
      ])

      const chainIdData = chainIdResult.status === 'fulfilled' && chainIdResult.value
      const chainlistData = chainlistResult.status === 'fulfilled' && chainlistResult.value

      bulkCache = {
        chainIdNetworkMap: Array.isArray(chainIdData)
          ? new Map(chainIdData.map((e: ChainIdNetworkEntry) => [e.chainId, e]))
          : null,
        chainlistOrgMap: Array.isArray(chainlistData)
          ? new Map(chainlistData.map((e: ChainlistOrgEntry) => [e.chainId, e]))
          : null,
        fetchedAt: Date.now(),
      }
    } finally {
      bulkCachePromise = null
    }
  })()

  return bulkCachePromise
}

function extractHttpsRpcs(rpc: unknown): string[] {
  if (!Array.isArray(rpc)) return []
  const urls: string[] = []
  for (const item of rpc) {
    if (typeof item === 'string' && item.startsWith('https://')) {
      urls.push(item)
    } else if (item && typeof item === 'object' && 'url' in item && typeof (item as { url: string }).url === 'string') {
      const url = (item as { url: string }).url
      if (url.startsWith('https://')) urls.push(url)
    }
  }
  return urls
}

function findInBulkCache(chainId: number): { rpcUrls: string[]; name: string; nativeCurrency?: { name: string; symbol: string; decimals: number } } | null {
  let rpcUrls: string[] = []
  let name = `chain-${chainId}`
  let nativeCurrency: { name: string; symbol: string; decimals: number } | undefined

  if (bulkCache.chainIdNetworkMap) {
    const entry = bulkCache.chainIdNetworkMap.get(chainId)
    if (entry) {
      rpcUrls = extractHttpsRpcs(entry.rpc)
      name = entry.name
      nativeCurrency = entry.nativeCurrency
    }
  }

  if (bulkCache.chainlistOrgMap) {
    const entry = bulkCache.chainlistOrgMap.get(chainId)
    if (entry) {
      const chainlistUrls = extractHttpsRpcs(entry.rpc)
      for (const url of chainlistUrls) {
        if (!rpcUrls.includes(url)) rpcUrls.push(url)
      }
      if (name === `chain-${chainId}`) name = entry.name
    }
  }

  if (rpcUrls.length === 0) return null
  return { rpcUrls, name, nativeCurrency }
}

function mergeRpcUrls(staticUrls: string[], ...discoveredUrls: string[][]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const url of staticUrls) {
    if (!seen.has(url)) {
      seen.add(url)
      result.push(url)
    }
  }

  for (const urls of discoveredUrls) {
    for (const url of urls) {
      if (!seen.has(url)) {
        seen.add(url)
        result.push(url)
      }
    }
  }

  return result
}

export async function discoverUnregisteredChains(
  chainIds: number[],
): Promise<void> {
  const unregisteredChainIds = chainIds.filter(
    (chainId) => !isRegisteredChain(chainId),
  )

  if (unregisteredChainIds.length === 0) return

  console.log(`[chain-discovery] Found ${unregisteredChainIds.length} unregistered chain(s) in reserves:`, unregisteredChainIds) // nosemgrep: unsafe-formatstring — template literal interpolation, not a printf-style format string

  try {
    await ensureBulkCache()
  } catch {
    console.warn('[chain-discovery] Failed to fetch bulk chain data')
  }

  for (const chainId of unregisteredChainIds) {
    const staticRpcUrls = getStaticRpcUrls(chainId)
    const wagmiRpcUrls = getWagmiChainRpcUrls(chainId)
    const bulkResult = findInBulkCache(chainId)

    const rpcUrls = mergeRpcUrls(
      staticRpcUrls,
      wagmiRpcUrls,
      bulkResult ? bulkResult.rpcUrls : [],
    )

    if (rpcUrls.length === 0) {
      console.warn(`[chain-discovery] No RPC URLs found for chain ${chainId}`)
      continue
    }

    const name = bulkResult?.name ?? `chain-${chainId}`
    const nativeCurrency = bulkResult?.nativeCurrency

    const info: DiscoveredChainInfo = {
      chainId,
      name,
      nativeCurrency,
      rpcUrls,
    }

    discoveredChains.set(chainId, info)
    console.log(`[chain-discovery] Discovered chain ${chainId} (${name}) with ${rpcUrls.length} RPC URLs`)
  }
}

export function getDiscoveredChain(chainId: number): DiscoveredChainInfo | null {
  return discoveredChains.get(chainId) ?? null
}

export function getAllRpcUrls(chainId: number): string[] {
  const discovered = discoveredChains.get(chainId)
  if (discovered) return discovered.rpcUrls
  const staticUrls = getStaticRpcUrls(chainId)
  const wagmiUrls = getWagmiChainRpcUrls(chainId)
  if (staticUrls.length > 0) return mergeRpcUrls(staticUrls, wagmiUrls)
  return wagmiUrls
}

export function getDiscoveredChainIds(): number[] {
  return [...discoveredChains.keys()]
}

export function __resetDiscoveryCache(): void {
  discoveredChains.clear()
  bulkCache = { chainIdNetworkMap: null, chainlistOrgMap: null, fetchedAt: 0 }
  bulkCachePromise = null
}
