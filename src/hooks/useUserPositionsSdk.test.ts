import { describe, it, expect } from 'vitest'
import {
  enrichV3SupplyPositions,
  enrichV3BorrowPositions,
  enrichV4SupplyPositions,
  enrichV4BorrowPositions,
} from './useUserPositionsSdk'
import { composeReserveId } from '@/lib/reserveKey'

const POOL = '0x87870bca3f3fd6b5bb36c0221bcc5c4c1f7c69c6' as `0x${string}`
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as `0x${string}`
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' as `0x${string}`
const SPOKE = '0x794a61358d682efdc006d42ba3808ad9c1fa5d07' as `0x${string}`
const HUB = '0xcca852bc40e560adc3b1cc58ca5b55638ce826c9' as `0x${string}`

describe('enrichV3SupplyPositions', () => {
  it('extracts spokeAddress from market.address', () => {
    const result = enrichV3SupplyPositions([{
      market: { address: POOL, chain: { chainId: 1 } },
      currency: { address: USDC, symbol: 'USDC', decimals: 6, chainId: 1 },
      balance: { amount: { value: '100', raw: '100000000', decimals: 6 } },
      isCollateral: true,
    }])
    expect(result).toHaveLength(1)
    expect(result[0].reserve.spokeAddress).toBe(POOL)
    expect(result[0].reserve.underlyingAsset.address).toBe(USDC)
    expect(result[0].reserve.symbol).toBe('USDC')
    expect(result[0].reserve.decimals).toBe(6)
    expect(result[0].isCollateral).toBe(true)
  })

  it('constructs reserve.id via composeReserveId (lowercase consistent)', () => {
    const result = enrichV3SupplyPositions([{
      market: { address: POOL, chain: { chainId: 1 } },
      currency: { address: USDC, symbol: 'USDC', decimals: 6, chainId: 1 },
      balance: { amount: { value: '0', raw: '0', decimals: 6 } },
      isCollateral: false,
    }])
    expect(result[0].reserve.id).toBe(composeReserveId(1, POOL, USDC))
  })
})

describe('enrichV3BorrowPositions', () => {
  it('extracts spokeAddress from market.address', () => {
    const result = enrichV3BorrowPositions([{
      market: { address: POOL, chain: { chainId: 1 } },
      currency: { address: WETH, symbol: 'WETH', decimals: 18, chainId: 1 },
      debt: { amount: { value: '0.5', raw: '500000000000000000', decimals: 18 } },
    }])
    expect(result).toHaveLength(1)
    expect(result[0].reserve.spokeAddress).toBe(POOL)
    expect(result[0].reserve.underlyingAsset.address).toBe(WETH)
  })
})

describe('enrichV4SupplyPositions', () => {
  it('extracts spokeAddress, hubName, and hubAddresses from spoke', () => {
    const result = enrichV4SupplyPositions([{
      id: 'v4-supply-1',
      reserve: {
        id: 'v4-reserve',
        spoke: { address: SPOKE, chain: { chainId: 42161 }, connectedHubs: [{ hub: { name: 'Core', address: HUB } }] },
        summary: { supplied: { token: { address: USDC, info: { symbol: 'USDC', decimals: 6 } } } },
      },
      balance: { amount: { value: '500', onChainValue: 500000000n, decimals: 6 } },
      isCollateral: false,
    }])
    expect(result).toHaveLength(1)
    expect(result[0].reserve.spokeAddress).toBe(SPOKE)
    expect(result[0].reserve.hubName).toBe('Core')
    expect(result[0].reserve.hubAddresses).toEqual([HUB])
    expect(result[0].reserve.underlyingAsset.address).toBe(USDC)
  })

  it('handles missing connectedHubs (no hubName, no hubAddresses)', () => {
    const result = enrichV4SupplyPositions([{
      id: 'v4-supply-2',
      reserve: {
        id: 'v4-reserve-2',
        spoke: { address: SPOKE, chain: { chainId: 1 } },
        summary: { supplied: { token: { address: WETH, info: { symbol: 'WETH', decimals: 18 } } } },
      },
      balance: { amount: { value: '1', onChainValue: 1000000000000000000n, decimals: 18 } },
      isCollateral: true,
    }])
    expect(result[0].reserve.hubName).toBeUndefined()
    expect(result[0].reserve.hubAddresses).toBeUndefined()
  })
})

describe('enrichV4BorrowPositions', () => {
  it('extracts spokeAddress, hubName, and hubAddresses from spoke', () => {
    const result = enrichV4BorrowPositions([{
      id: 'v4-borrow-1',
      reserve: {
        id: 'v4-reserve-3',
        spoke: { address: SPOKE, chain: { chainId: 1 }, connectedHubs: [{ hub: { name: 'Plus', address: HUB } }] },
        summary: { borrowed: { token: { address: USDC, info: { symbol: 'USDC', decimals: 6 } } } },
      },
      principal: { amount: { value: '1000', onChainValue: 1000000000n, decimals: 6 } },
    }])
    expect(result).toHaveLength(1)
    expect(result[0].reserve.spokeAddress).toBe(SPOKE)
    expect(result[0].reserve.hubName).toBe('Plus')
    expect(result[0].reserve.hubAddresses).toEqual([HUB])
    expect(result[0].reserve.underlyingAsset.address).toBe(USDC)
  })
})
