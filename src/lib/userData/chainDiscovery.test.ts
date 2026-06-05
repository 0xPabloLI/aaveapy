import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  setRegistryChecker,
  setStaticRpcUrlGetter,
  discoverUnregisteredChains,
  getAllRpcUrls,
  getDiscoveredChain,
  getDiscoveredChainIds,
  __resetDiscoveryCache,
} from './chainDiscovery'

beforeEach(() => {
  // Reset injected dependencies and discovery cache
  setRegistryChecker(() => false)
  setStaticRpcUrlGetter(() => [])
  __resetDiscoveryCache()
})

describe('discoverUnregisteredChains', () => {
  it('skips registered chains and fetches unregistered ones', async () => {
    // Chain 1 is "registered", chain 4326 (MegaEth) is not
    setRegistryChecker((chainId) => chainId === 1)
    setStaticRpcUrlGetter((chainId) => {
      if (chainId === 1) return ['https://eth-rpc.example.com']
      return []
    })

    const mockChainData = {
      chainId: 4326,
      name: 'MegaETH',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpc: ['https://rpc.megaeth.com/rpc', 'https://megaeth.drpc.org'],
    }

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockChainData,
      })
      .mockResolvedValueOnce({
        ok: false,
      })

    await discoverUnregisteredChains([1, 4326])

    // Should have discovered chain 4326
    const discovered = getDiscoveredChain(4326)
    expect(discovered).not.toBeNull()
    expect(discovered!.chainId).toBe(4326)
    expect(discovered!.name).toBe('MegaETH')
    expect(discovered!.rpcUrls).toContain('https://rpc.megaeth.com/rpc')
    expect(discovered!.rpcUrls).toContain('https://megaeth.drpc.org')

    // Chain 1 should NOT be discovered (it's registered)
    expect(getDiscoveredChain(1)).toBeNull()
  })

  it('merges static RPC URLs with discovered ones (static first, then deduplicated)', async () => {
    setRegistryChecker(() => false)
    setStaticRpcUrlGetter((chainId) => {
      if (chainId === 4326) return ['https://static-rpc.megaeth.com', 'https://rpc.megaeth.com/rpc']
      return []
    })

    const mockChainData = {
      chainId: 4326,
      name: 'MegaETH',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpc: ['https://rpc.megaeth.com/rpc', 'https://megaeth.drpc.org', 'https://static-rpc.megaeth.com'],
    }

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockChainData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockChainData, // same data from second source
      })

    await discoverUnregisteredChains([4326])

    const urls = getAllRpcUrls(4326)
    // Static URLs come first
    expect(urls[0]).toBe('https://static-rpc.megaeth.com')
    expect(urls[1]).toBe('https://rpc.megaeth.com/rpc')
    // Then discovered URLs (deduplicated)
    expect(urls).toContain('https://megaeth.drpc.org')
    // No duplicates
    const uniqueUrls = new Set(urls)
    expect(urls.length).toBe(uniqueUrls.size)
  })

  it('falls back to static RPC URLs when chain is registered', async () => {
    setRegistryChecker((chainId) => chainId === 1)
    setStaticRpcUrlGetter((chainId) => {
      if (chainId === 1) return ['https://eth-rpc.example.com']
      return []
    })

    // No fetch needed — chain 1 is registered
    await discoverUnregisteredChains([1])

    expect(getDiscoveredChainIds()).toEqual([])
    expect(getAllRpcUrls(1)).toEqual(['https://eth-rpc.example.com'])
  })

  it('handles fetch failures gracefully', async () => {
    setRegistryChecker(() => false)
    setStaticRpcUrlGetter(() => [])

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
    })

    await discoverUnregisteredChains([999999])

    // No chains discovered (both sources failed)
    expect(getDiscoveredChainIds()).toEqual([])
  })

  it('returns empty array for unknown chain via getAllRpcUrls', () => {
    setStaticRpcUrlGetter(() => [])
    expect(getAllRpcUrls(999999)).toEqual([])
  })
})
