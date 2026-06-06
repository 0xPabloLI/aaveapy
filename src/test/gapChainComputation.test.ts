import { describe, it, expect } from 'vitest'
import { computeGapChainIds, ReserveChainEntry } from '@/lib/userData/gapChainComputation'
import { AAVE_V3_CHAIN_IDS, AAVE_V4_CHAIN_IDS } from '@/lib/chainRegistry'

const v3Entry = (chainId: number): ReserveChainEntry => ({
  chainId,
  marketName: `AaveV3Eth-Chain${chainId}`,
})

const v4Entry = (chainId: number): ReserveChainEntry => ({
  chainId,
  marketName: `AaveV4Eth-Chain${chainId}`,
})

const fullSdkCoverage = () => ({
  v3SdkChainIds: [...AAVE_V3_CHAIN_IDS],
  v4SdkChainIds: [...AAVE_V4_CHAIN_IDS],
})

describe('computeGapChainIds', () => {
  it('returns empty gap when reserves only cover SDK-registered chains', () => {
    const reserves = [
      ...AAVE_V3_CHAIN_IDS.map(v3Entry),
      ...AAVE_V4_CHAIN_IDS.map(v4Entry),
    ]
    const result = computeGapChainIds(reserves, fullSdkCoverage())
    expect(result.v3Gap).toEqual([])
    expect(result.v4Gap).toEqual([])
  })

  it('detects V3 gap: chain in reserves but not in SDK V3 coverage', () => {
    const gapChain = 4326
    const reserves = [...AAVE_V3_CHAIN_IDS.map(v3Entry), v3Entry(gapChain)]
    const result = computeGapChainIds(reserves, fullSdkCoverage())
    expect(result.v3Gap).toContain(gapChain)
    expect(result.v4Gap).toEqual([])
  })

  it('detects V4 gap: chain in reserves but not in SDK V4 coverage', () => {
    const gapChain = 9745
    const reserves = [...AAVE_V4_CHAIN_IDS.map(v4Entry), v4Entry(gapChain)]
    const result = computeGapChainIds(reserves, fullSdkCoverage())
    expect(result.v4Gap).toContain(gapChain)
    expect(result.v3Gap).toEqual([])
  })

  it('returns both V3 and V4 gaps when applicable', () => {
    const v3GapChain = 4326
    const v4GapChain = 9745
    const reserves = [
      ...AAVE_V3_CHAIN_IDS.map(v3Entry),
      ...AAVE_V4_CHAIN_IDS.map(v4Entry),
      v3Entry(v3GapChain),
      v4Entry(v4GapChain),
    ]
    const result = computeGapChainIds(reserves, fullSdkCoverage())
    expect(result.v3Gap).toContain(v3GapChain)
    expect(result.v4Gap).toContain(v4GapChain)
  })

  it('returns empty when reserves is empty', () => {
    const result = computeGapChainIds([], fullSdkCoverage())
    expect(result.v3Gap).toEqual([])
    expect(result.v4Gap).toEqual([])
  })

  it('returns empty when SDK coverage is empty (no fallback triggered)', () => {
    const reserves = AAVE_V3_CHAIN_IDS.map(v3Entry)
    const result = computeGapChainIds(reserves, { v3SdkChainIds: [], v4SdkChainIds: [] })
    expect(result.v3Gap).toEqual([])
    expect(result.v4Gap).toEqual([])
  })

  it('does not double-count a chain covered by both V3 SDK and V4 SDK', () => {
    const ethChainId = 1
    const result = computeGapChainIds([v3Entry(ethChainId)], {
      v3SdkChainIds: [ethChainId],
      v4SdkChainIds: [ethChainId],
    })
    expect(result.v3Gap).toEqual([])
    expect(result.v4Gap).toEqual([])
  })

  it('deduplicates gap chains by chainId', () => {
    const gapChain = 4326
    const result = computeGapChainIds(
      [v3Entry(gapChain), v3Entry(gapChain)],
      { v3SdkChainIds: [], v4SdkChainIds: [9999] },
    )
    const total = result.v3Gap.filter(id => id === gapChain).length
      + result.v4Gap.filter(id => id === gapChain).length
    expect(total).toBe(1)
  })

  it('classifies gap chain as V3 via marketName prefix', () => {
    const result = computeGapChainIds(
      [v3Entry(99999)],
      { v3SdkChainIds: [1], v4SdkChainIds: [] },
    )
    expect(result.v3Gap).toContain(99999)
    expect(result.v4Gap).toEqual([])
  })

  it('classifies gap chain as V4 via marketName prefix', () => {
    const result = computeGapChainIds(
      [v4Entry(99999)],
      { v3SdkChainIds: [], v4SdkChainIds: [42161] },
    )
    expect(result.v4Gap).toContain(99999)
    expect(result.v3Gap).toEqual([])
  })
})
