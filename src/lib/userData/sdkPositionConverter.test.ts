// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import {
  convertSdkSuppliesToWalletPositions,
  convertSdkBorrowsToWalletPositions,
} from '@/lib/userData/sdkPositionConverter'
import { buildReserveMap, buildReserveLookupByChainAndToken } from '@/lib/reserveKey'
import type { ReserveWithSpread } from '@/types/aave'

const SPOKE_V3 = '0x87870bca3f3fd6b5bb36c0221bcc5c4c1f7c69c6' as `0x${string}`
const SPOKE_V4 = '0x794a61358d682efdc006d42ba3808ad9c1fa5d07' as `0x${string}`
const ETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' as `0x${string}`
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as `0x${string}`

const mockReserves = [
  {
    reserveId: `1:${SPOKE_V3}:${ETH}`,
    tokenSymbol: 'ETH',
    tokenAddress: ETH,
    chainId: 1,
    tokenPrice: 3000,
    decimals: 18,
  },
  {
    reserveId: `1:${SPOKE_V3}:${USDC}`,
    tokenSymbol: 'USDC',
    tokenAddress: USDC,
    chainId: 1,
    tokenPrice: 1,
    decimals: 6,
  },
  {
    reserveId: `1:${SPOKE_V4}:${USDC}:Core`,
    tokenSymbol: 'USDC',
    tokenAddress: USDC,
    chainId: 1,
    tokenPrice: 1,
    decimals: 6,
  },
] as unknown as ReserveWithSpread[]

const reserveMap = buildReserveMap(mockReserves)
const chainTokenLookupMap = buildReserveLookupByChainAndToken(mockReserves)

describe('sdkPositionConverter', () => {
  describe('convertSdkSuppliesToWalletPositions', () => {
    it('matches via reserveId when spokeAddress provided', () => {
      const supplies = [
        {
          reserve: {
            id: 'v3-eth',
            symbol: 'ETH',
            decimals: 18,
            underlyingAsset: { address: ETH, chain: { id: '1' } },
            spokeAddress: SPOKE_V3,
          },
          balance: {
            amount: { value: '1.5', onChainValue: 1500000000000000000n, decimals: 18 },
          },
          isCollateral: true,
        },
      ]

      const result = convertSdkSuppliesToWalletPositions(supplies, reserveMap, chainTokenLookupMap)
      expect(result).toHaveLength(1)
      expect(result[0].reserveId).toBe(`1:${SPOKE_V3}:${ETH}`)
      expect(result[0].tokenSymbol).toBe('ETH')
      expect(result[0].side).toBe('supply')
      expect(result[0].isOrphan).toBe(false)
      expect(result[0].amountWad).toBe(1500000000000000000n)
    })

    it('matches V4 with hubName', () => {
      const supplies = [
        {
          reserve: {
            id: 'v4-usdc',
            symbol: 'USDC',
            decimals: 6,
            underlyingAsset: { address: USDC, chain: { id: '1' } },
            spokeAddress: SPOKE_V4,
            hubName: 'Core',
          },
          balance: {
            amount: { value: '500', onChainValue: 500000000n, decimals: 6 },
          },
          isCollateral: false,
        },
      ]

      const result = convertSdkSuppliesToWalletPositions(supplies, reserveMap, chainTokenLookupMap)
      expect(result[0].reserveId).toBe(`1:${SPOKE_V4}:${USDC}:Core`)
      expect(result[0].isOrphan).toBe(false)
    })

    it('falls back to chainToken lookup when no spokeAddress', () => {
      const supplies = [
        {
          reserve: {
            id: 'v3-usdc-no-pool',
            symbol: 'USDC',
            decimals: 6,
            underlyingAsset: { address: USDC, chain: { id: '1' } },
          },
          balance: {
            amount: { value: '100', onChainValue: 100000000n, decimals: 6 },
          },
          isCollateral: false,
        },
      ]

      const result = convertSdkSuppliesToWalletPositions(supplies, reserveMap, chainTokenLookupMap)
      expect(result[0].isOrphan).toBe(false)
      expect(result[0].tokenSymbol).toBe('USDC')
    })

    it('marks orphan when reserve not found', () => {
      const supplies = [
        {
          reserve: {
            id: 'unknown',
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

      const result = convertSdkSuppliesToWalletPositions(supplies, reserveMap, chainTokenLookupMap)
      expect(result[0].isOrphan).toBe(true)
      expect(result[0].tokenSymbol).toBe('UNKNOWN')
    })
  })

  describe('convertSdkBorrowsToWalletPositions', () => {
    it('converts a borrow with reserveId match', () => {
      const borrows = [
        {
          reserve: {
            id: 'v3-usdc',
            symbol: 'USDC',
            decimals: 6,
            underlyingAsset: { address: USDC, chain: { id: '1' } },
            spokeAddress: SPOKE_V3,
          },
          debt: {
            amount: { value: '1000', onChainValue: 1000000000n, decimals: 6 },
          },
        },
      ]

      const result = convertSdkBorrowsToWalletPositions(borrows, reserveMap, chainTokenLookupMap)
      expect(result).toHaveLength(1)
      expect(result[0].side).toBe('borrow')
      expect(result[0].isCollateral).toBe(false)
      expect(result[0].source).toBe('sdk')
      expect(result[0].tokenSymbol).toBe('USDC')
      expect(result[0].isOrphan).toBe(false)
    })

    it('marks orphan borrow when not found', () => {
      const borrows = [
        {
          reserve: {
            id: 'ghost',
            symbol: 'GHOST',
            decimals: 18,
            underlyingAsset: {
              address: '0x0000000000000000000000000000000000000001' as `0x${string}`,
              chain: { id: '999' },
            },
          },
          debt: {
            amount: { value: '0', onChainValue: 0n, decimals: 18 },
          },
        },
      ]

      const result = convertSdkBorrowsToWalletPositions(borrows, reserveMap, chainTokenLookupMap)
      expect(result[0].isOrphan).toBe(true)
    })
  })
})
