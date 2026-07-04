import { describe, expect, it } from 'vitest'
import {
  AAVE_V3_CHAIN_IDS,
  AAVE_V4_CHAIN_IDS,
  isAaveMainnetChain,
  getAaveProtocolVersion,
} from './aaveChains'

describe('aaveChains', () => {
  describe('AAVE_V3_CHAIN_IDS', () => {
    it('contains all 21 V3 mainnet chain IDs', () => {
      const expected = [
        1, 42161, 43114, 56, 8453, 42220, 100, 59144, 5000,
        1088, 10, 137, 534352, 1868, 146, 196, 324, 57073,
        4326, 9745, 143,
      ]
      expect(AAVE_V3_CHAIN_IDS).toHaveLength(expected.length)
      for (const id of expected) {
        expect(AAVE_V3_CHAIN_IDS, `missing V3 chain ${id}`).toContain(id)
      }
    })

    it('excludes testnet chain IDs', () => {
      expect(AAVE_V3_CHAIN_IDS).not.toContain(11155111)
      expect(AAVE_V3_CHAIN_IDS).not.toContain(43113)
    })
  })

  describe('AAVE_V4_CHAIN_IDS', () => {
    it('contains only Ethereum mainnet', () => {
      expect(AAVE_V4_CHAIN_IDS).toEqual([1])
    })
  })

  describe('isAaveMainnetChain', () => {
    it('returns true for V3 chain', () => {
      expect(isAaveMainnetChain(137)).toBe(true)
    })

    it('returns true for V4 chain', () => {
      expect(isAaveMainnetChain(1)).toBe(true)
    })

    it('returns false for unknown chain', () => {
      expect(isAaveMainnetChain(999999)).toBe(false)
    })

    it('returns false for testnet chain', () => {
      expect(isAaveMainnetChain(11155111)).toBe(false)
    })
  })

  describe('getAaveProtocolVersion', () => {
    it('returns v3 for V3-only chain', () => {
      expect(getAaveProtocolVersion(137)).toBe('v3')
    })

    it('returns v4 for V4-only chain (none yet beyond eth)', () => {
      expect(getAaveProtocolVersion(1)).toBe('v4')
    })

    it('returns null for unsupported chain', () => {
      expect(getAaveProtocolVersion(999999)).toBeNull()
    })
  })
})
