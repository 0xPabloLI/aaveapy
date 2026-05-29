import { describe, it, expect } from 'vitest'
import {
  deriveV3AssetsByChain,
  deriveV4ReservesBySpoke,
  decodeV4ReserveId,
} from './deriveOnchainConfig'
import type { ReserveWithSpread } from '@/types/aave'
import { V4_SPOKE_ADDRESSES } from '@/lib/userData/aaveV4UserClient'

const MAIN_SPOKE_ADDR = V4_SPOKE_ADDRESSES[1]?.find(s => s.name === 'MAIN_SPOKE')?.address ?? '0x0'
const BLUECHIP_SPOKE_ADDR = V4_SPOKE_ADDRESSES[1]?.find(s => s.name === 'BLUECHIP_SPOKE')?.address ?? '0x0'

const makeV3Reserve = (
  chainId: number,
  tokenAddress: string,
  overrides?: Partial<ReserveWithSpread>,
): ReserveWithSpread => ({
  reserveId: `v3-${chainId}-${tokenAddress}`,
  marketName: `AaveV3Chain${chainId}`,
  chainName: 'Test',
  chainId,
  tokenName: 'Token',
  tokenSymbol: 'TKN',
  tokenAddress,
  ...overrides,
} as ReserveWithSpread)

const makeV4Reserve = (
  chainId: number,
  tokenAddress: string,
  spokeAddress: string,
  aaveProReserveId: string,
  overrides?: Partial<ReserveWithSpread>,
): ReserveWithSpread => ({
  reserveId: `v4-${chainId}-${tokenAddress}-Core`,
  marketName: `AaveV4Hub${chainId}`,
  chainName: 'Ethereum',
  chainId,
  tokenName: 'Token',
  tokenSymbol: 'TKN',
  tokenAddress,
  spokeAddress,
  aaveProReserveId,
  ...overrides,
} as ReserveWithSpread)

describe('decodeV4ReserveId', () => {
  it('decodes a base64-encoded aaveProReserveId to bigint', () => {
    const encoded = Buffer.from('1::0xCCa2aAa39b223FE8D0A0e5C4F27eAD9083C756Cc2').toString('base64')
    expect(decodeV4ReserveId(encoded)).toBe(1n)
  })

  it('decodes reserveId 2', () => {
    const encoded = Buffer.from('2::0xdAC17F958D2ee523a2206206994597C13D831ec7').toString('base64')
    expect(decodeV4ReserveId(encoded)).toBe(2n)
  })

  it('returns null for undefined input', () => {
    expect(decodeV4ReserveId(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(decodeV4ReserveId('')).toBeNull()
  })

  it('returns null for invalid base64', () => {
    expect(decodeV4ReserveId('not-valid!!!')).toBeNull()
  })

  it('returns null for decoded string without :: separator', () => {
    const encoded = Buffer.from('no-separator-here').toString('base64')
    expect(decodeV4ReserveId(encoded)).toBeNull()
  })

  it('returns null for non-numeric reserveId part', () => {
    const encoded = Buffer.from('abc::0x1234').toString('base64')
    expect(decodeV4ReserveId(encoded)).toBeNull()
  })
})

describe('deriveV3AssetsByChain', () => {
  it('groups V3 token addresses by chainId', () => {
    const reserves = [
      makeV3Reserve(1, '0xAa'),
      makeV3Reserve(1, '0xBb'),
      makeV3Reserve(137, '0xCc'),
    ]
    const result = deriveV3AssetsByChain(reserves)
    expect(result[1]).toEqual(['0xAa', '0xBb'])
    expect(result[137]).toEqual(['0xCc'])
  })

  it('excludes V4 reserves (those with spokeAddress)', () => {
    const reserves = [
      makeV3Reserve(1, '0xAa'),
      makeV4Reserve(1, '0xBb', '0xSpoke', 'encoded'),
    ]
    const result = deriveV3AssetsByChain(reserves)
    expect(Object.keys(result)).toEqual(['1'])
  })

  it('returns empty record for empty reserves', () => {
    expect(deriveV3AssetsByChain([])).toEqual({})
  })

  it('deduplicates token addresses within a chain', () => {
    const reserves = [
      makeV3Reserve(1, '0xAa'),
      makeV3Reserve(1, '0xAa'),
    ]
    const result = deriveV3AssetsByChain(reserves)
    expect(result[1]).toEqual(['0xAa'])
  })
})

describe('deriveV4ReservesBySpoke', () => {
  it('groups V4 reserves by spokeName (looked up from V4_SPOKE_ADDRESSES)', () => {
    const encoded1 = Buffer.from('1::0xAa').toString('base64')
    const encoded2 = Buffer.from('2::0xBb').toString('base64')
    const reserves = [
      makeV4Reserve(1, '0xAa', MAIN_SPOKE_ADDR, encoded1, { hubName: 'Core' }),
      makeV4Reserve(1, '0xBb', MAIN_SPOKE_ADDR, encoded2, { hubName: 'Core' }),
    ]
    const result = deriveV4ReservesBySpoke(reserves)
    expect(Object.keys(result)).toEqual(['MAIN_SPOKE'])
    expect(result['MAIN_SPOKE']).toHaveLength(2)
    expect(result['MAIN_SPOKE'][0]).toEqual({ reserveId: 1n, asset: '0xAa' })
    expect(result['MAIN_SPOKE'][1]).toEqual({ reserveId: 2n, asset: '0xBb' })
  })

  it('separates reserves from different spokes', () => {
    const encoded1 = Buffer.from('1::0xAa').toString('base64')
    const encoded2 = Buffer.from('2::0xBb').toString('base64')
    const reserves = [
      makeV4Reserve(1, '0xAa', MAIN_SPOKE_ADDR, encoded1),
      makeV4Reserve(1, '0xBb', BLUECHIP_SPOKE_ADDR, encoded2),
    ]
    const result = deriveV4ReservesBySpoke(reserves)
    expect(Object.keys(result).sort()).toEqual(['BLUECHIP_SPOKE', 'MAIN_SPOKE'])
  })

  it('excludes V3 reserves', () => {
    const reserves = [
      makeV3Reserve(1, '0xAa'),
      makeV4Reserve(1, '0xBb', MAIN_SPOKE_ADDR, Buffer.from('1::0xBb').toString('base64')),
    ]
    const result = deriveV4ReservesBySpoke(reserves)
    expect(Object.keys(result)).toEqual(['MAIN_SPOKE'])
  })

  it('skips V4 reserves without aaveProReserveId', () => {
    const reserves = [
      makeV4Reserve(1, '0xAa', MAIN_SPOKE_ADDR, ''),
    ]
    const result = deriveV4ReservesBySpoke(reserves)
    expect(result['MAIN_SPOKE']).toBeUndefined()
  })

  it('skips V4 reserves with unparseable aaveProReserveId', () => {
    const reserves = [
      makeV4Reserve(1, '0xAa', MAIN_SPOKE_ADDR, 'invalid!!!'),
    ]
    const result = deriveV4ReservesBySpoke(reserves)
    expect(result['MAIN_SPOKE']).toBeUndefined()
  })

  it('skips V4 reserves whose spokeAddress is not in V4_SPOKE_ADDRESSES', () => {
    const encoded = Buffer.from('1::0xAa').toString('base64')
    const reserves = [
      makeV4Reserve(1, '0xAa', '0xUnknownSpoke', encoded),
    ]
    const result = deriveV4ReservesBySpoke(reserves)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('returns empty record for empty reserves', () => {
    expect(deriveV4ReservesBySpoke([])).toEqual({})
  })
})
