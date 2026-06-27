import { describe, expect, it } from 'vitest'
import { parseReserveId, enrichReservesFromId } from './reserveIdParser'
import type { MarketsResponse, ReserveWithSpread } from '@/types/aave'

describe('parseReserveId', () => {
  it('parses V3 format (3 segments)', () => {
    const result = parseReserveId('1:0x87870bca3f3fd6b5bb36c0221bcc5c4c1f7c69c6:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
    expect(result).toEqual({
      chainId: 1,
      poolOrSpokeAddress: '0x87870bca3f3fd6b5bb36c0221bcc5c4c1f7c69c6',
      tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      hubAddress: undefined,
    })
  })

  it('parses V4 format (4 segments)', () => {
    const result = parseReserveId('1:0xspoke123:0xtoken456:0xCca8A2316a28C583e12c8844d2D4E1f4D8F8D26c9')
    expect(result).toEqual({
      chainId: 1,
      poolOrSpokeAddress: '0xspoke123',
      tokenAddress: '0xtoken456',
      hubAddress: '0xCca8A2316a28C583e12c8844d2D4E1f4D8F8D26c9',
    })
  })

  it('returns null for empty string', () => {
    expect(parseReserveId('')).toBeNull()
  })

  it('returns null for 1 segment', () => {
    expect(parseReserveId('1')).toBeNull()
  })

  it('returns null for 2 segments', () => {
    expect(parseReserveId('1:0xpool')).toBeNull()
  })

  it('returns null for 5+ segments', () => {
    expect(parseReserveId('1:0xa:0xb:0xc:0xd')).toBeNull()
  })

  it('returns null when chainId is not a number', () => {
    expect(parseReserveId('abc:0xpool:0xtoken')).toBeNull()
  })

  it('returns null when chainId is 0', () => {
    expect(parseReserveId('0:0xpool:0xtoken')).toBeNull()
  })

  it('returns null when chainId is negative', () => {
    expect(parseReserveId('-1:0xpool:0xtoken')).toBeNull()
  })

  it('handles large chainId', () => {
    const result = parseReserveId('42161:0xpool:0xtoken')
    expect(result?.chainId).toBe(42161)
  })
})

describe('enrichReservesFromId', () => {
  function makeReserve(overrides: Partial<ReserveWithSpread> & { reserveId: string }): ReserveWithSpread {
    return {
      chainId: 1,
      tokenAddress: '0xtoken',
      tokenSymbol: 'USDC',
      marketName: 'AaveV3Ethereum',
      ...overrides,
    } as ReserveWithSpread
  }

  it('enriches V4 reserve with hubAddress and spokeAddress from reserveId', () => {
    const data: MarketsResponse = {
      snapshot: { lastUpdated: '2026-01-01' },
      reserves: [makeReserve({
        reserveId: '1:0xspoke123:0xtoken456:0xHubAbc123',
        marketName: 'AaveV4Ethereum',
      })],
    }
    enrichReservesFromId(data)
    expect(data.reserves[0].hubAddress).toBe('0xHubAbc123')
    expect(data.reserves[0].spokeAddress).toBe('0xspoke123')
  })

  it('does not modify V3 reserve', () => {
    const data: MarketsResponse = {
      snapshot: { lastUpdated: '2026-01-01' },
      reserves: [makeReserve({
        reserveId: '1:0xpool789:0xtoken456',
        marketName: 'AaveV3Ethereum',
      })],
    }
    enrichReservesFromId(data)
    expect(data.reserves[0].hubAddress).toBeUndefined()
    expect(data.reserves[0].spokeAddress).toBeUndefined()
  })

  it('skips reserve with unparseable reserveId', () => {
    const data: MarketsResponse = {
      snapshot: { lastUpdated: '2026-01-01' },
      reserves: [makeReserve({
        reserveId: 'invalid',
        marketName: 'AaveV4Ethereum',
      })],
    }
    enrichReservesFromId(data)
    expect(data.reserves[0].hubAddress).toBeUndefined()
    expect(data.reserves[0].spokeAddress).toBeUndefined()
  })

  it('handles mixed V3 and V4 reserves', () => {
    const data: MarketsResponse = {
      snapshot: { lastUpdated: '2026-01-01' },
      reserves: [
        makeReserve({
          reserveId: '1:0xpool:0xtoken1',
          marketName: 'AaveV3Ethereum',
        }),
        makeReserve({
          reserveId: '1:0xspoke:0xtoken2:0xhubaddr',
          marketName: 'AaveV4Ethereum',
        }),
      ],
    }
    enrichReservesFromId(data)
    expect(data.reserves[0].hubAddress).toBeUndefined()
    expect(data.reserves[0].spokeAddress).toBeUndefined()
    expect(data.reserves[1].hubAddress).toBe('0xhubaddr')
    expect(data.reserves[1].spokeAddress).toBe('0xspoke')
  })

  it('handles empty reserves array', () => {
    const data: MarketsResponse = {
      snapshot: { lastUpdated: '2026-01-01' },
      reserves: [],
    }
    expect(() => enrichReservesFromId(data)).not.toThrow()
  })
})
