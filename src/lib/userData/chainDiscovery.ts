/**
 * Runtime chain discovery — detects chains present in reserves that are NOT
 * in the static registry, fetches their RPC URLs from public chain lists,
 * and makes them available for on-chain fallback.
 *
 * Data sources (merged + deduplicated):
 *   1. chainRegistry.ts — curated RPC URLs (first priority)
 *   2. chainid.network / chainlist.org — public EVM chain registry (fallback)
 *
 * Flow: reserves arrive → extract chainIds → check registry → fetch unknown
 * chains from public lists → merge RPC URLs → store in memory.
 */

export interface DiscoveredChainInfo {
  chainId: number
  name: string
  nativeCurrency?: { name: string; symbol: string; decimals: number }
  rpcUrls: string[]
}

// In-memory cache for discovered chains
const discoveredChains = new Map<number, DiscoveredChainInfo>()

// Dependency injection — set by chainRegistry on init to avoid circular imports
let checkRegistered: ((chainId: number) => boolean) = () => false
let getStaticRpcUrls: ((chainId: number) => string[]) = () => []

/** Called by chainRegistry to wire up the registry checker. */
export function setRegistryChecker(check: (chainId: number) => boolean): void {
  checkRegistered = check
}

/** Called by chainRegistry to wire up static RPC URL lookup. */
export function setStaticRpcUrlGetter(getter: (chainId: number) => string[]): void {
  getStaticRpcUrls = getter
}

function isRegisteredChain(chainId: number): boolean {
  return checkRegistered(chainId)
}

// ---- Public chain list fetchers ----

/** Fetch a single chain's data from chainid.network */
async function fetchChainFromChainIdNetwork(chainId: number): Promise<DiscoveredChainInfo | null> {
  const res = await fetch(`https://chainid.network/chains/${chainId}.json`)
  if (!res.ok) return null
  const data = await res.json()
  const rpcUrls = (data.rpc ?? []).filter((url: string) => url.startsWith('https://'))
  if (rpcUrls.length === 0) return null
  return {
    chainId: data.chainId,
    name: data.name,
    nativeCurrency: data.nativeCurrency,
    rpcUrls,
  }
}

/** Fetch a single chain's data from chainlist.org */
async function fetchChainFromChainList(chainId: number): Promise<DiscoveredChainInfo | null> {
  const res = await fetch(`https://chainlist.org/rpcs/${chainId}.json`)
  if (!res.ok) return null
  const data = await res.json()
  const rpcUrls = (data.rpc ?? []).filter((url: string) => url.startsWith('https://'))
  if (rpcUrls.length === 0) return null
  return {
    chainId: data.chainId,
    name: data.name,
    nativeCurrency: data.nativeCurrency,
    rpcUrls,
  }
}

/** Deduplicate and merge RPC URLs from multiple sources */
function mergeRpcUrls(staticUrls: string[], ...discoveredUrls: string[][]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  // Prefer static registry URLs first (curated & known-good)
  for (const url of staticUrls) {
    if (!seen.has(url)) {
      seen.add(url)
      result.push(url)
    }
  }

  // Then add discovered URLs (deduplicated)
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

/**
 * Discover RPC URLs for chains NOT in the static registry.
 * Fetches from public chain lists and stores in memory.
 *
 * Called after reserves load; only processes chains that appear in reserves.
 */
export async function discoverUnregisteredChains(
  chainIds: number[],
): Promise<void> {
  // Find chains NOT in static registry
  const unregisteredChainIds = chainIds.filter(
    (chainId) => !isRegisteredChain(chainId),
  )

  if (unregisteredChainIds.length === 0) return

  console.log(`[chain-discovery] Found ${unregisteredChainIds.length} unregistered chain(s) in reserves:`, unregisteredChainIds)

  // Fetch each unregistered chain from both sources in parallel
  const fetchPromises = unregisteredChainIds.map(async (chainId) => {
    const [fromChainIdNetwork, fromChainList] = await Promise.allSettled([
      fetchChainFromChainIdNetwork(chainId),
      fetchChainFromChainList(chainId),
    ])

    const staticRpcUrls = getStaticRpcUrls(chainId)
    const rpcUrls = mergeRpcUrls(
      staticRpcUrls,
      fromChainIdNetwork.status === 'fulfilled' && fromChainIdNetwork.value
        ? fromChainIdNetwork.value.rpcUrls
        : [],
      fromChainList.status === 'fulfilled' && fromChainList.value
        ? fromChainList.value.rpcUrls
        : [],
    )

    if (rpcUrls.length === 0) {
      console.warn(`[chain-discovery] No RPC URLs found for chain ${chainId}`)
      return
    }

    const name =
      fromChainIdNetwork.status === 'fulfilled' && fromChainIdNetwork.value
        ? fromChainIdNetwork.value.name
        : fromChainList.status === 'fulfilled' && fromChainList.value
          ? fromChainList.value.name
          : `chain-${chainId}`

    const nativeCurrency =
      fromChainIdNetwork.status === 'fulfilled' && fromChainIdNetwork.value
        ? fromChainIdNetwork.value.nativeCurrency
        : fromChainList.status === 'fulfilled' && fromChainList.value
          ? fromChainList.value.nativeCurrency
          : undefined

    const info: DiscoveredChainInfo = {
      chainId,
      name,
      nativeCurrency,
      rpcUrls,
    }

    discoveredChains.set(chainId, info)
    console.log(`[chain-discovery] Discovered chain ${chainId} (${name}) with ${rpcUrls.length} RPC URLs`)
  })

  await Promise.allSettled(fetchPromises)
}

/**
 * Get discovered chain info for a given chainId.
 */
export function getDiscoveredChain(chainId: number): DiscoveredChainInfo | null {
  return discoveredChains.get(chainId) ?? null
}

/**
 * Get all RPC URLs for a chain, combining static registry + discovered sources.
 * Falls back to static registry if discovery hasn't found the chain.
 */
export function getAllRpcUrls(chainId: number): string[] {
  const discovered = discoveredChains.get(chainId)
  if (discovered) return discovered.rpcUrls
  return getStaticRpcUrls(chainId)
}

/**
 * Get all discovered chain IDs (not in static registry).
 */
export function getDiscoveredChainIds(): number[] {
  return [...discoveredChains.keys()]
}

/** Reset all discovered chains. Used for testing. */
export function __resetDiscoveryCache(): void {
  discoveredChains.clear()
}
