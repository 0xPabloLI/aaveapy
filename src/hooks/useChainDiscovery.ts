import { useEffect, useRef } from 'react'
import { useAaveMarkets } from './useAaveMarkets'
import { discoverUnregisteredChains } from '@/lib/userData/chainDiscovery'

/**
 * Hook that triggers runtime chain discovery after reserves load.
 *
 * When the backend returns reserves for chains NOT in the static registry,
 * this hook fetches RPC URLs from public chain lists (chainid.network +
 * chainlist.org) and merges them into the in-memory RPC pool.
 */
export function useChainDiscovery(): void {
  const { data, isLoading, error } = useAaveMarkets()
  const discoveryTriggered = useRef(false)

  useEffect(() => {
    if (!data?.reserves || isLoading || error || discoveryTriggered.current) return

    discoveryTriggered.current = true

    const chainIds = [...new Set(data.reserves.map((r) => r.chainId))]
    discoverUnregisteredChains(chainIds).catch((err) => {
      console.error('[chain-discovery] Discovery failed:', err)
    })
  }, [data?.reserves, isLoading, error])
}
