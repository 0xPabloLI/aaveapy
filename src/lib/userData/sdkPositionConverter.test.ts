// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import {
  convertSdkSuppliesToWalletPositions,
  convertSdkBorrowsToWalletPositions,
  buildReserveLookupByChainAndToken,
} from '@/lib/userData/sdkPositionConverter'
import type { ReserveWithSpread } from '@/types/aave'

const POOL_ADDR = '0x87870Bca3F3fD6b5bB36c0221BCC5C4c1F7C69c6' as `0x${string}`

const mockReserves = [
  {
    reserveId: `1:${POOL_ADDR}:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`,
    tokenSymbol: 'ETH',
    tokenAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`,
    chainId: 1,
    tokenPrice: 3000,
    decimals: 18,
  },
  {
    reserveId: `1:${POOL_ADDR}:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`,
    tokenSymbol: 'USDC',
    tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
    chainId: 1,
    tokenPrice: 1,
    decimals: 6,
  },
] as unknown as ReserveWithSpread[]

const lookupMap = buildReserveLookupByChainAndToken(mockReserves)

describe('sdkPositionConverter', () => {
  describe('convertSdkSuppliesToWalletPositions', () => {
    it('converts a single supply position', () => {
      const supplies = [
        {
          reserve: {
            id: 'v3-eth',
            symbol: 'ETH',
            decimals: 18,
            underlyingAsset: {
              address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`,
              chain: { id: '1' },
            },
          },
          balance: {
            amount: {
              value: '1.5',
              onChainValue: 1500000000000000000n,
              decimals: 18,
            },
          },
          isCollateral: true,
        },
      ]

      const result = convertSdkSuppliesToWalletPositions(supplies, lookupMap)

      expect(result).toHaveLength(1)
      expect(result[0].reserveId).toBe(`1:${POOL_ADDR}:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`)
      expect(result[0].tokenSymbol).toBe('ETH')
      expect(result[0].side).toBe('supply')
      expect(result[0].isCollateral).toBe(true)
      expect(result[0].source).toBe('sdk')
      expect(result[0].isOrphan).toBe(false)
      expect(result[0].chainId).toBe(1)
      expect(result[0].amountWad).toBe(1500000000000000000n)
    })

    it('marks orphan when reserve not found', () => {
      const supplies = [
        {
          reserve: {
            id: 'unknown-reserve',
            symbol: 'UNKNOWN',
            decimals: 18,
            underlyingAsset: {
              address: '0x000000000000000000000000000000000000dEaD' as `0x${string}`,
              chain: { id: '1' },
            },
          },
          balance: {
            amount: { value: '0', onChainValue: 0n, decimals: 18 },
          },
          isCollateral: false,
        },
      ]

      const result = convertSdkSuppliesToWalletPositions(supplies, lookupMap)
      expect(result[0].isOrphan).toBe(true)
      expect(result[0].tokenSymbol).toBe('UNKNOWN')
    })
  })

  describe('convertSdkBorrowsToWalletPositions', () => {
    it('converts a single borrow position', () => {
      const borrows = [
        {
          reserve: {
            id: 'v4-usdc',
            symbol: 'USDC',
            decimals: 6,
            underlyingAsset: {
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
              chain: { id: '1' },
            },
          },
          debt: {
            amount: {
              value: '1000',
              onChainValue: 1000000000n,
              decimals: 6,
            },
          },
        },
      ]

      const result = convertSdkBorrowsToWalletPositions(borrows, lookupMap)

      expect(result).toHaveLength(1)
      expect(result[0].side).toBe('borrow')
      expect(result[0].isCollateral).toBe(false)
      expect(result[0].source).toBe('sdk')
      expect(result[0].tokenSymbol).toBe('USDC')
    })
  })
})
