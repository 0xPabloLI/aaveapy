import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  setRegistryChecker,
  setStaticRpcUrlGetter,
  setWagmiChainRpcUrlGetter,
  discoverUnregisteredChains,
  getAllRpcUrls,
  getDiscoveredChain,
  getDiscoveredChainIds,
  __resetDiscoveryCache,
} from './chainDiscovery'

beforeEach(() => {
  setRegistryChecker(() => false)
  setStaticRpcUrlGetter(() => [])
  setWagmiChainRpcUrlGetter(() => [])
  __resetDiscoveryCache()
})

function mockBulkChainIdNetwork(chains: Array<{ chainId: number; name: string; rpc: string[] }>) {
  return {
    ok: true,
    json: async () => chains,
  }
}

function mockBulkChainlistOrg(chains: Array<{ chainId: number; name: string; rpc: Array<{ url: string } | string> }>) {
  return {
    ok: true,
    json: async () => chains,
  }
}

describe('discoverUnregisteredChains (bulk API)', () => {
  it('skips registered chains and discovers unregistered ones from bulk endpoint', async () => {
    setRegistryChecker((chainId) => chainId === 1)
    setStaticRpcUrlGetter((chainId) => {
      if (chainId === 1) return ['https://eth-rpc.example.com']
      return []
    })

    global.fetch = vi.fn().mockResolvedValueOnce(
      mockBulkChainIdNetwork([
        { chainId: 4326, name: 'MegaETH', rpc: ['https://mainnet.megaeth.com/rpc'] },
      ]),
    ).mockResolvedValueOnce(
      mockBulkChainlistOrg([
        { chainId: 4326, name: 'MegaETH', rpc: [{ url: 'https://megaeth.drpc.org' }] },
      ]),
    )

    await discoverUnregisteredChains([1, 4326])

    const discovered = getDiscoveredChain(4326)
    expect(discovered).not.toBeNull()
    expect(discovered!.chainId).toBe(4326)
    expect(discovered!.name).toBe('MegaETH')
    expect(discovered!.rpcUrls).toContain('https://mainnet.megaeth.com/rpc')
    expect(discovered!.rpcUrls).toContain('https://megaeth.drpc.org')

    expect(getDiscoveredChain(1)).toBeNull()
  })

  it('uses cached bulk data for subsequent calls (no repeat fetch)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      mockBulkChainIdNetwork([
        { chainId: 4326, name: 'MegaETH', rpc: ['https://mainnet.megaeth.com/rpc'] },
      ]),
    ).mockResolvedValueOnce(
      mockBulkChainlistOrg([
        { chainId: 4326, name: 'MegaETH', rpc: [{ url: 'https://megaeth.drpc.org' }] },
      ]),
    )
    global.fetch = fetchMock

    await discoverUnregisteredChains([4326])
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await discoverUnregisteredChains([4326])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('merges static RPC URLs with discovered ones (static first, deduplicated)', async () => {
    setRegistryChecker(() => false)
    setStaticRpcUrlGetter((chainId) => {
      if (chainId === 4326) return ['https://static-rpc.megaeth.com', 'https://mainnet.megaeth.com/rpc']
      return []
    })

    global.fetch = vi.fn().mockResolvedValueOnce(
      mockBulkChainIdNetwork([
        { chainId: 4326, name: 'MegaETH', rpc: ['https://mainnet.megaeth.com/rpc', 'https://megaeth.drpc.org', 'https://static-rpc.megaeth.com'] },
      ]),
    ).mockResolvedValueOnce(
      mockBulkChainlistOrg([
        { chainId: 4326, name: 'MegaETH', rpc: [{ url: 'https://megaeth.drpc.org' }, { url: 'https://mainnet.megaeth.com/rpc' }] },
      ]),
    )

    await discoverUnregisteredChains([4326])

    const urls = getAllRpcUrls(4326)
    expect(urls[0]).toBe('https://static-rpc.megaeth.com')
    expect(urls[1]).toBe('https://mainnet.megaeth.com/rpc')
    expect(urls).toContain('https://megaeth.drpc.org')
    const uniqueUrls = new Set(urls)
    expect(urls.length).toBe(uniqueUrls.size)
  })

  it('handles bulk fetch failure gracefully (both sources fail)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })

    await discoverUnregisteredChains([999999])
    expect(getDiscoveredChainIds()).toEqual([])
  })

  it('handles chain not found in bulk data', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      mockBulkChainIdNetwork([]),
    ).mockResolvedValueOnce(
      mockBulkChainlistOrg([]),
    )

    await discoverUnregisteredChains([999999])
    expect(getDiscoveredChainIds()).toEqual([])
    expect(getAllRpcUrls(999999)).toEqual([])
  })

  it('falls back to static + wagmi RPC URLs when chain is registered', async () => {
    setRegistryChecker((chainId) => chainId === 1)
    setStaticRpcUrlGetter((chainId) => {
      if (chainId === 1) return ['https://eth-rpc.example.com']
      return []
    })
    setWagmiChainRpcUrlGetter((chainId) => {
      if (chainId === 1) return ['https://eth.llamarpc.com']
      return []
    })

    await discoverUnregisteredChains([1])
    expect(getDiscoveredChainIds()).toEqual([])
    const urls = getAllRpcUrls(1)
    expect(urls).toContain('https://eth-rpc.example.com')
    expect(urls).toContain('https://eth.llamarpc.com')
  })

  it('filters out non-https RPC URLs from chainid.network bulk data', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      mockBulkChainIdNetwork([
        { chainId: 4326, name: 'MegaETH', rpc: ['https://mainnet.megaeth.com/rpc', 'wss://mainnet.megaeth.com/ws'] },
      ]),
    ).mockResolvedValueOnce(
      mockBulkChainlistOrg([]),
    )

    await discoverUnregisteredChains([4326])

    const discovered = getDiscoveredChain(4326)
    expect(discovered!.rpcUrls).toEqual(['https://mainnet.megaeth.com/rpc'])
  })

  it('extracts RPC URLs from chainlist.org object format', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      mockBulkChainIdNetwork([]),
    ).mockResolvedValueOnce(
      mockBulkChainlistOrg([
        {
          chainId: 4326,
          name: 'MegaETH',
          rpc: [
            { url: 'https://megaeth.drpc.org' },
            { url: 'https://mainnet.megaeth.com/rpc' },
            'https://rpc-megaeth-mainnet.globalstake.io',
          ],
        },
      ]),
    )

    await discoverUnregisteredChains([4326])

    const discovered = getDiscoveredChain(4326)
    expect(discovered!.rpcUrls).toContain('https://megaeth.drpc.org')
    expect(discovered!.rpcUrls).toContain('https://mainnet.megaeth.com/rpc')
    expect(discovered!.rpcUrls).toContain('https://rpc-megaeth-mainnet.globalstake.io')
  })

  it('handles non-JSON response from bulk endpoint', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => { throw new Error('Not JSON') } })
      .mockResolvedValueOnce({ ok: false })

    await discoverUnregisteredChains([4326])
    expect(getDiscoveredChainIds()).toEqual([])
  })

  it('falls back to wagmi/chains RPC URLs when static and bulk are empty', async () => {
    setWagmiChainRpcUrlGetter((chainId) => {
      if (chainId === 4326) return ['https://mainnet.megaeth.com/rpc']
      return []
    })

    global.fetch = vi.fn().mockResolvedValue({ ok: false })

    await discoverUnregisteredChains([4326])

    const discovered = getDiscoveredChain(4326)
    expect(discovered).not.toBeNull()
    expect(discovered!.rpcUrls).toContain('https://mainnet.megaeth.com/rpc')
  })

  it('getAllRpcUrls falls back to wagmi/chains when no static URLs', () => {
    setWagmiChainRpcUrlGetter((chainId) => {
      if (chainId === 4326) return ['https://mainnet.megaeth.com/rpc']
      return []
    })

    expect(getAllRpcUrls(4326)).toEqual(['https://mainnet.megaeth.com/rpc'])
  })

  it('getAllRpcUrls merges static URLs with wagmi/chains (static first)', () => {
    setStaticRpcUrlGetter((chainId) => {
      if (chainId === 4326) return ['https://static-rpc.megaeth.com']
      return []
    })
    setWagmiChainRpcUrlGetter((chainId) => {
      if (chainId === 4326) return ['https://mainnet.megaeth.com/rpc']
      return []
    })

    const urls = getAllRpcUrls(4326)
    expect(urls[0]).toBe('https://static-rpc.megaeth.com')
    expect(urls[1]).toBe('https://mainnet.megaeth.com/rpc')
  })

  it('merges wagmi/chains RPC URLs with bulk data (static > wagmi > bulk)', async () => {
    setStaticRpcUrlGetter((chainId) => {
      if (chainId === 4326) return ['https://static-rpc.megaeth.com']
      return []
    })
    setWagmiChainRpcUrlGetter((chainId) => {
      if (chainId === 4326) return ['https://mainnet.megaeth.com/rpc']
      return []
    })

    global.fetch = vi.fn().mockResolvedValueOnce(
      mockBulkChainIdNetwork([
        { chainId: 4326, name: 'MegaETH', rpc: ['https://megaeth.drpc.org'] },
      ]),
    ).mockResolvedValueOnce(
      mockBulkChainlistOrg([]),
    )

    await discoverUnregisteredChains([4326])

    const urls = getAllRpcUrls(4326)
    expect(urls[0]).toBe('https://static-rpc.megaeth.com')
    expect(urls[1]).toBe('https://mainnet.megaeth.com/rpc')
    expect(urls[2]).toBe('https://megaeth.drpc.org')
  })
})
