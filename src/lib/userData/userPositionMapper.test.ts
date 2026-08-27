import { describe, it, expect } from 'vitest'
import {
  mapV3PositionToWalletPosition,
  mapV4PositionToWalletPosition,
  resolvePositionMeta,
  resolvePositionMetaByReserveId,
  buildReserveMapFromReserves,
  type WalletPosition,
  type WalletPositionSource,
  type PositionMeta,
} from './userPositionMapper'
import { buildReserveLookupByChainAndToken, type ReserveChainTokenMap, type ReserveMap } from '@/lib/reserveKey'
import type { V3UserPosition, V3AccountSummary } from './aaveV3UserClient'
import type { V4UserPosition, V4AccountSummary } from './aaveV4UserClient'
import type { ReserveWithSpread } from '@/types/aave'

const WAD = 10n ** 18n
const RAY = 10n ** 27n

describe('WalletPosition unified type', () => {
  it('has all required fields', () => {
    const pos: WalletPosition = {
      reserveId: '1:0xpool:0xabc',
      chainId: 1,
      asset: '0xabc' as `0x${string}`,
      tokenSymbol: 'USDC',
      side: 'supply',
      amountWad: 1000n * WAD,
      amountUsd: 1000,
      isCollateral: true,
      source: 'onchain-v3' as WalletPositionSource,
      isOrphan: false,
    }
    expect(pos.reserveId).toBe('1:0xpool:0xabc')
    expect(pos.side).toBe('supply')
    expect(pos.isOrphan).toBe(false)
  })
})

describe('mapV3PositionToWalletPosition', () => {
  const v3Pos: V3UserPosition = {
    chainId: 1,
    marketName: 'AaveV3Ethereum',
    asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
    supplyWad: 5000n * WAD,
    stableBorrowWad: 0n,
    variableBorrowWad: 2000n * WAD,
    isCollateral: true,
  }

  it('maps V3 supply position', () => {
    const result = mapV3PositionToWalletPosition(v3Pos, 'supply', {
      reserveId: '1:0xpool:0xA0b8',
      tokenSymbol: 'USDC',
      tokenPrice: 1,
      decimals: 6,
    }, 'onchain-v3')
    expect(result.reserveId).toBe('1:0xpool:0xA0b8')
    expect(result.side).toBe('supply')
    expect(result.amountWad).toBe(5000n * WAD)
    expect(result.amountUsd).toBe(5000)
    expect(result.isCollateral).toBe(true)
    expect(result.source).toBe('onchain-v3')
    expect(result.isOrphan).toBe(false)
  })

  it('maps V3 variable borrow position', () => {
    const result = mapV3PositionToWalletPosition(v3Pos, 'borrow', {
      reserveId: '1:0xpool:0xA0b8',
      tokenSymbol: 'USDC',
      tokenPrice: 1,
      decimals: 6,
    }, 'onchain-v3')
    expect(result.side).toBe('borrow')
    expect(result.amountWad).toBe(2000n * WAD)
    expect(result.amountUsd).toBe(2000)
  })

  it('maps V3 stable borrow position when stableBorrow > 0', () => {
    const v3Stable: V3UserPosition = {
      ...v3Pos,
      supplyWad: 0n,
      stableBorrowWad: 1000n * WAD,
      variableBorrowWad: 0n,
    }
    const result = mapV3PositionToWalletPosition(v3Stable, 'borrow', {
      reserveId: '1:0xpool:0xA0b8',
      tokenSymbol: 'USDC',
      tokenPrice: 1,
      decimals: 6,
    }, 'onchain-v3')
    expect(result.amountWad).toBe(1000n * WAD)
    expect(result.amountUsd).toBe(1000)
  })

  it('computes amountUsd from WAD amount and tokenPrice', () => {
    const result = mapV3PositionToWalletPosition(v3Pos, 'supply', {
      reserveId: '1:0xpool:0xC02a',
      tokenSymbol: 'WETH',
      tokenPrice: 3000,
      decimals: 18,
    }, 'onchain-v3')
    expect(result.amountUsd).toBe(5000 * 3000)
  })

  it('marks orphan when reserveId is undefined', () => {
    const result = mapV3PositionToWalletPosition(v3Pos, 'supply', {
      reserveId: undefined,
      tokenSymbol: 'USDC',
      tokenPrice: 1,
      decimals: 6,
    }, 'onchain-v3')
    expect(result.isOrphan).toBe(true)
    expect(result.reserveId).toBe('')
  })
})

describe('mapV4PositionToWalletPosition', () => {
  const v4Pos: V4UserPosition = {
    chainId: 1,
    spokeName: 'MAIN_SPOKE',
    reserveId: 1n,
    asset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`,
    suppliedAssets: 10n * WAD,
    stableDebt: 0n,
    variableDebt: 3n * WAD,
    isCollateral: true,
  }

  it('maps V4 supply position', () => {
    const result = mapV4PositionToWalletPosition(v4Pos, 'supply', {
      reserveId: '1:0xspoke:0xC02a:0xhub',
      tokenSymbol: 'WETH',
      tokenPrice: 3000,
      decimals: 18,
    }, 'onchain-v4')
    expect(result.reserveId).toBe('1:0xspoke:0xC02a:0xhub')
    expect(result.side).toBe('supply')
    expect(result.amountWad).toBe(10n * WAD)
    expect(result.amountUsd).toBe(10 * 3000)
    expect(result.source).toBe('onchain-v4')
    expect(result.isOrphan).toBe(false)
  })

  it('maps V4 borrow position', () => {
    const result = mapV4PositionToWalletPosition(v4Pos, 'borrow', {
      reserveId: '1:0xspoke:0xC02a:0xhub',
      tokenSymbol: 'WETH',
      tokenPrice: 3000,
      decimals: 18,
    }, 'onchain-v4')
    expect(result.side).toBe('borrow')
    expect(result.amountWad).toBe(3n * WAD)
    expect(result.amountUsd).toBe(3 * 3000)
  })

  it('marks orphan when reserveId is undefined', () => {
    const result = mapV4PositionToWalletPosition(v4Pos, 'supply', {
      reserveId: undefined,
      tokenSymbol: 'WETH',
      tokenPrice: 3000,
      decimals: 18,
    }, 'onchain-v4')
    expect(result.isOrphan).toBe(true)
  })
})

describe('WalletPositionSource type', () => {
  it('accepts all valid source values', () => {
    const sources: WalletPositionSource[] = ['sdk', 'onchain-v3', 'onchain-v4', 'gap-v3', 'gap-v4']
    expect(sources).toHaveLength(5)
  })
})

describe('resolvePositionMeta', () => {
  const USDC_ADDR = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`
  const WETH_ADDR = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`
  const UNKNOWN_ADDR = '0x000000000000000000000000000000000000dEaD' as `0x${string}`

  const reserves: ReserveWithSpread[] = [
    {
      marketName: 'Aave V3 Ethereum',
      chainName: 'Ethereum',
      chainId: 1,
      tokenName: 'USD Coin',
      tokenSymbol: 'USDC',
      tokenAddress: USDC_ADDR,
      reserveId: '1:0xpool1:0xA0b8',
      tokenPrice: 1,
      decimals: 6,
    },
    {
      marketName: 'Aave V3 Ethereum',
      chainName: 'Ethereum',
      chainId: 1,
      tokenName: 'Wrapped Ether',
      tokenSymbol: 'WETH',
      tokenAddress: WETH_ADDR,
      reserveId: '1:0xpool1:0xC02a',
      tokenPrice: 3000,
      decimals: 18,
    },
    {
      marketName: 'Aave V3 Arbitrum',
      chainName: 'Arbitrum',
      chainId: 42161,
      tokenName: 'USD Coin',
      tokenSymbol: 'USDC',
      tokenAddress: USDC_ADDR,
      reserveId: '42161:0xpool2:0xA0b8',
      tokenPrice: 1,
      decimals: 6,
    },
  ]

  const lookupMap = buildReserveLookupByChainAndToken(reserves)

  it('finds reserve by (chainId, tokenAddress) and returns PositionMeta', () => {
    const meta = resolvePositionMeta(1, USDC_ADDR, lookupMap)
    expect(meta.reserveId).toBe('1:0xpool1:0xA0b8')
    expect(meta.tokenSymbol).toBe('USDC')
    expect(meta.tokenPrice).toBe(1)
    expect(meta.decimals).toBe(6)
  })

  it('distinguishes same asset on different chains via (chainId, tokenAddress)', () => {
    const meta = resolvePositionMeta(42161, USDC_ADDR, lookupMap)
    expect(meta.reserveId).toBe('42161:0xpool2:0xA0b8')
    expect(meta.tokenSymbol).toBe('USDC')
  })

  it('returns orphan meta when (chainId, tokenAddress) not found in map', () => {
    const meta = resolvePositionMeta(1, UNKNOWN_ADDR, lookupMap)
    expect(meta.reserveId).toBeUndefined()
    expect(meta.tokenSymbol).toBe('')
    expect(meta.tokenPrice).toBe(0)
    expect(meta.decimals).toBe(0)
  })

  it('returns orphan meta when (chainId, tokenAddress) not found in empty map', () => {
    const meta = resolvePositionMeta(1, USDC_ADDR, new Map() as ReserveChainTokenMap)
    expect(meta.reserveId).toBeUndefined()
  })

  it('uses tokenPrice 0 when reserve has no tokenPrice', () => {
    const noPriceReserves: ReserveWithSpread[] = [
      {
        marketName: 'Test',
        chainName: 'Test',
        chainId: 1,
        tokenName: 'Token',
        tokenSymbol: 'TKN',
        tokenAddress: USDC_ADDR,
        reserveId: '1:0xpool:0xA0b8',
        decimals: 18,
      },
    ]
    const noPriceLookupMap = buildReserveLookupByChainAndToken(noPriceReserves)
    const meta = resolvePositionMeta(1, USDC_ADDR, noPriceLookupMap)
    expect(meta.tokenPrice).toBe(0)
  })

  it('defaults to 18 decimals when reserve has no decimals', () => {
    const noDecimalsReserves: ReserveWithSpread[] = [
      {
        marketName: 'Test',
        chainName: 'Test',
        chainId: 1,
        tokenName: 'Token',
        tokenSymbol: 'TKN',
        tokenAddress: USDC_ADDR,
        reserveId: '1:0xpool:0xA0b8',
        tokenPrice: 100,
      },
    ]
    const noDecimalsLookupMap = buildReserveLookupByChainAndToken(noDecimalsReserves)
    const meta = resolvePositionMeta(1, USDC_ADDR, noDecimalsLookupMap)
    expect(meta.decimals).toBe(18)
  })
})

describe('resolvePositionMetaByReserveId', () => {
  const USDC_ADDR = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`
  const WETH_ADDR = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`
  const POOL1 = '0x87870bca3f3fd6b5bb36c0221bcc5c4c1f7c69c6'
  const POOL2 = '0x0aa9f05a7b7b57b7b7b57b7b57b7b57b7b57b7b5'

  const reserves: ReserveWithSpread[] = [
    {
      marketName: 'Aave V3 Ethereum',
      chainName: 'Ethereum',
      chainId: 1,
      tokenName: 'USD Coin',
      tokenSymbol: 'USDC',
      tokenAddress: USDC_ADDR,
      reserveId: `1:${POOL1}:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`,
      tokenPrice: 1,
      decimals: 6,
    },
    {
      marketName: 'Aave V3 Ethereum',
      chainName: 'Ethereum',
      chainId: 1,
      tokenName: 'USD Coin',
      tokenSymbol: 'USDC',
      tokenAddress: USDC_ADDR,
      reserveId: `1:${POOL2}:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`,
      tokenPrice: 1,
      decimals: 6,
    },
    {
      marketName: 'Aave V4 Ethereum Core',
      chainName: 'Ethereum',
      chainId: 1,
      tokenName: 'Wrapped Ether',
      tokenSymbol: 'WETH',
      tokenAddress: WETH_ADDR,
      reserveId: `1:${POOL1}:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2:Core`,
      tokenPrice: 3000,
      decimals: 18,
    },
  ]

  const reserveMap = buildReserveMapFromReserves(reserves)
  const chainTokenLookupMap = buildReserveLookupByChainAndToken(reserves)

  it('finds reserve by composed reserveId (V3 format)', () => {
    const composedId = `1:${POOL1}:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`
    const meta = resolvePositionMetaByReserveId(composedId, 1, USDC_ADDR, reserveMap, chainTokenLookupMap)
    expect(meta.reserveId).toBe(`1:${POOL1}:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`)
    expect(meta.tokenSymbol).toBe('USDC')
  })

  it('distinguishes same token on different pools via reserveId', () => {
    const id1 = `1:${POOL1}:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`
    const id2 = `1:${POOL2}:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`
    const meta1 = resolvePositionMetaByReserveId(id1, 1, USDC_ADDR, reserveMap, chainTokenLookupMap)
    const meta2 = resolvePositionMetaByReserveId(id2, 1, USDC_ADDR, reserveMap, chainTokenLookupMap)
    expect(meta1.reserveId).toBe(id1)
    expect(meta2.reserveId).toBe(id2)
    expect(meta1.reserveId).not.toBe(meta2.reserveId)
  })

  it('finds reserve by composed reserveId (V4 format with hubName)', () => {
    const composedId = `1:${POOL1}:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2:Core`
    const meta = resolvePositionMetaByReserveId(composedId, 1, WETH_ADDR, reserveMap, chainTokenLookupMap)
    expect(meta.reserveId).toBe(composedId)
    expect(meta.tokenSymbol).toBe('WETH')
  })

  it('falls back to chainTokenLookup when reserveId is undefined', () => {
    const meta = resolvePositionMetaByReserveId(undefined, 1, USDC_ADDR, reserveMap, chainTokenLookupMap)
    expect(meta.tokenSymbol).toBe('USDC')
  })

  it('falls back to chainTokenLookup when reserveId not found in reserveMap', () => {
    const meta = resolvePositionMetaByReserveId('nonexistent-id', 1, USDC_ADDR, reserveMap, chainTokenLookupMap)
    expect(meta.tokenSymbol).toBe('USDC')
  })

  it('returns orphan meta when both reserveId and chainToken lookups fail', () => {
    const UNKNOWN = '0x000000000000000000000000000000000000dEaD' as `0x${string}`
    const meta = resolvePositionMetaByReserveId(undefined, 1, UNKNOWN, reserveMap, chainTokenLookupMap)
    expect(meta.reserveId).toBeUndefined()
    expect(meta.tokenSymbol).toBe('')
  })

  it('trims whitespace on reserveId before lookup', () => {
    const composedId = `  1:${POOL1}:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48  `
    const meta = resolvePositionMetaByReserveId(composedId, 1, USDC_ADDR, reserveMap, chainTokenLookupMap)
    expect(meta.reserveId).toBe(`1:${POOL1}:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`)
  })
})
