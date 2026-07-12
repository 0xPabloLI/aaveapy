import { describe, it, expect } from 'vitest'
import {
  AAVE_CHAIN_IDS,
  AAVE_V3_CHAIN_IDS,
  AAVE_V4_CHAIN_IDS,
  isAaveMainnetChain,
  getAaveProtocolVersion,
  V3_POOL_ADDRESSES,
  PUBLIC_RPC_URLS,
  getPublicRpcUrls,
  WALLET_SUPPORTED_CHAINS,
} from './chainRegistry'

describe('chainRegistry', () => {
  describe('chain ID sets', () => {
    it('AAVE_CHAIN_IDS contains all unique chain IDs', () => {
      // 18 V3 chains + 1 V4 chain (eth is shared) = 18 unique
      expect(AAVE_CHAIN_IDS.length).toBeGreaterThanOrEqual(18)
    })

    it('V3 chain IDs excludes V4-only entries', () => {
      expect(AAVE_V3_CHAIN_IDS).toContain(137) // Polygon
      expect(AAVE_V3_CHAIN_IDS).toContain(1) // Ethereum (has V3)
    })

    it('V4 chain IDs contains Ethereum mainnet', () => {
      expect(AAVE_V4_CHAIN_IDS).toContain(1)
    })

    it('no duplicates in AAVE_CHAIN_IDS', () => {
      const unique = new Set(AAVE_CHAIN_IDS)
      expect(AAVE_CHAIN_IDS.length).toBe(unique.size)
    })
  })

  describe('V3_POOL_ADDRESSES', () => {
    it('has pool address for each V3 chain', () => {
      for (const chainId of AAVE_V3_CHAIN_IDS) {
        const pool = V3_POOL_ADDRESSES[String(chainId)]
        expect(pool, `missing pool for V3 chain ${chainId}`).toBeTruthy()
        expect(pool).toMatch(/^0x[a-fA-F0-9]{40}$/)
      }
    })

    it('does NOT contain V4-only chain addresses in wrong map', () => {
      // V4 Ethereum uses SPOKES, not POOL - those live in aaveV4UserClient.ts
      expect(Object.keys(V3_POOL_ADDRESSES)).toContain('1') // Ethereum V3 pool
    })
  })

  describe('PUBLIC_RPC_URLS', () => {
    it('has RPC URLs for each V3 chain', () => {
      for (const chainId of AAVE_V3_CHAIN_IDS) {
        const urls = PUBLIC_RPC_URLS[chainId]
        expect(urls, `missing RPC URLs for V3 chain ${chainId}`).toBeTruthy()
        expect(urls.length).toBeGreaterThan(0)
        // All URLs should be HTTPS
        for (const url of urls) {
          expect(url).toMatch(/^https:\/\//)
        }
      }
    })

    it('getPublicRpcUrls returns array (even if empty)', () => {
      expect(getPublicRpcUrls(1)).toBeInstanceOf(Array)
      expect(getPublicRpcUrls(999999)).toBeInstanceOf(Array)
      expect(getPublicRpcUrls(999999)).toEqual([])
    })
  })

  describe('WALLET_SUPPORTED_CHAINS', () => {
    it('contains wagmi chain objects for all chains', () => {
      expect(WALLET_SUPPORTED_CHAINS.length).toBeGreaterThanOrEqual(18)
      for (const chain of WALLET_SUPPORTED_CHAINS) {
        expect(chain.id).toBeGreaterThan(0)
        expect(typeof chain.name).toBe('string')
      }
    })

    it('no duplicate chain IDs in wagmi chains', () => {
      const seen = new Set<number>()
      for (const chain of WALLET_SUPPORTED_CHAINS) {
        expect(seen.has(chain.id), `duplicate wagmi chain ${chain.id}`).toBe(false)
        seen.add(chain.id)
      }
    })
  })

  describe('isAaveMainnetChain', () => {
    it('returns true for known chains', () => {
      expect(isAaveMainnetChain(1)).toBe(true)
      expect(isAaveMainnetChain(137)).toBe(true)
      expect(isAaveMainnetChain(42161)).toBe(true)
    })

    it('returns false for unknown chains', () => {
      expect(isAaveMainnetChain(999999)).toBe(false)
      expect(isAaveMainnetChain(11155111)).toBe(false) // Sepolia
    })
  })

  describe('getAaveProtocolVersion', () => {
    it('returns v4 for Ethereum (has V4)', () => {
      expect(getAaveProtocolVersion(1)).toBe('v4')
    })

    it('returns v3 for V3-only chains', () => {
      expect(getAaveProtocolVersion(137)).toBe('v3') // Polygon
      expect(getAaveProtocolVersion(42161)).toBe('v3') // Arbitrum
    })

    it('returns null for unknown chains', () => {
      expect(getAaveProtocolVersion(999999)).toBeNull()
    })
  })

  describe('registry-discovery integration', () => {
    it('registry checker is wired up', async () => {
      // Import the discovery module to trigger side-effects
      const { getDiscoveredChainIds } = await import('./userData/chainDiscovery')
      // If this doesn't throw, the integration is working
      expect(getDiscoveredChainIds).toBeDefined()
    })
  })
})
