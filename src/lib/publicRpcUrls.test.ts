import { describe, expect, it } from 'vitest'
import {
  getPublicRpcUrls,
  PUBLIC_RPC_URLS,
  AAVE_CHAIN_IDS,
} from './publicRpcUrls'

describe('publicRpcUrls', () => {
  describe('PUBLIC_RPC_URLS', () => {
    it('covers all Aave mainnet chain IDs', () => {
      const expectedChainIds = [
        1, 10, 56, 100, 137, 146, 196, 324, 1868, 42220,
        5000, 8453, 1088, 59144, 42161, 43114, 534352,
      ]
      for (const chainId of expectedChainIds) {
        expect(
          PUBLIC_RPC_URLS[chainId],
          `missing public RPC for chain ${chainId}`,
        ).toBeDefined()
        expect(PUBLIC_RPC_URLS[chainId].length).toBeGreaterThanOrEqual(1)
      }
    })

    it('every URL is a valid public HTTP(S) endpoint (no API keys)', () => {
      for (const [chainId, urls] of Object.entries(PUBLIC_RPC_URLS)) {
        for (const url of urls) {
          expect(
            url.startsWith('http://') || url.startsWith('https://'),
            `chain ${chainId}: invalid URL scheme "${url}"`,
          ).toBe(true)
          expect(
            url,
            `chain ${chainId}: URL contains API key placeholder "${url}"`,
          ).not.toContain('${')
        }
      }
    })
  })

  describe('getPublicRpcUrls', () => {
    it('returns URLs for a known chain', () => {
      const urls = getPublicRpcUrls(1)
      expect(urls.length).toBeGreaterThanOrEqual(1)
      expect(urls[0]).toBe('https://ethereum-rpc.publicnode.com')
    })

    it('returns empty array for unknown chain', () => {
      expect(getPublicRpcUrls(999999)).toEqual([])
    })
  })

  describe('AAVE_CHAIN_IDS', () => {
    it('contains all V3 mainnet chain IDs', () => {
      const v3ChainIds = [
        1, 42161, 43114, 56, 8453, 42220, 1, 100, 59144, 5000,
        1088, 10, 137, 534352, 1868, 146, 196, 324,
      ]
      for (const id of v3ChainIds) {
        expect(AAVE_CHAIN_IDS, `missing V3 chain ${id}`).toContain(id)
      }
    })

    it('contains V4 Ethereum chain ID', () => {
      expect(AAVE_CHAIN_IDS).toContain(1)
    })

    it('excludes testnet chain IDs', () => {
      expect(AAVE_CHAIN_IDS).not.toContain(11155111) // Sepolia
      expect(AAVE_CHAIN_IDS).not.toContain(43113) // Fuji
    })

    it('has no duplicates', () => {
      expect(AAVE_CHAIN_IDS.length).toBe(new Set(AAVE_CHAIN_IDS).size)
    })
  })
})
