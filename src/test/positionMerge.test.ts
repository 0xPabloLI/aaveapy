import { describe, it, expect } from 'vitest'
import { mergeAndDedupPositions, mergeFailedSources } from '@/lib/userData/positionMerge'
import type { WalletPosition } from '@/lib/userData/userPositionMapper'

function makePosition(reserveId: string, source: WalletPosition['source'], overrides?: Partial<WalletPosition>): WalletPosition {
  return {
    reserveId,
    chainId: 1,
    asset: '0x0' as `0x${string}`,
    tokenSymbol: 'TKN',
    side: 'supply',
    amountWad: 1n,
    amountUsd: 1,
    isCollateral: false,
    source,
    isOrphan: false,
    ...overrides,
  }
}

describe('mergeAndDedupPositions', () => {
  it('returns empty array when all inputs are empty', () => {
    expect(mergeAndDedupPositions([], [], [])).toEqual([])
  })

  it('returns sdk positions when only sdk has data', () => {
    const sdk = [makePosition('r1', 'sdk')]
    expect(mergeAndDedupPositions(sdk, [], [])).toEqual(sdk)
  })

  it('returns fallback positions when only fallback has data', () => {
    const fb = [makePosition('r1', 'onchain-v3')]
    expect(mergeAndDedupPositions([], fb, [])).toEqual(fb)
  })

  it('returns gap positions when only gap has data', () => {
    const gap = [makePosition('r1', 'onchain-v3')]
    expect(mergeAndDedupPositions([], [], gap)).toEqual(gap)
  })

  it('deduplicates by reserveId with sdk priority over fallback', () => {
    const sdk = [makePosition('r1', 'sdk', { amountUsd: 100 })]
    const fb = [makePosition('r1', 'onchain-v3', { amountUsd: 50 })]
    const result = mergeAndDedupPositions(sdk, fb, [])
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('sdk')
    expect(result[0].amountUsd).toBe(100)
  })

  it('deduplicates by reserveId with sdk priority over gap', () => {
    const sdk = [makePosition('r1', 'sdk', { amountUsd: 100 })]
    const gap = [makePosition('r1', 'onchain-v3', { amountUsd: 30 })]
    const result = mergeAndDedupPositions(sdk, [], gap)
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('sdk')
  })

  it('deduplicates by reserveId with fallback priority over gap', () => {
    const fb = [makePosition('r1', 'onchain-v4', { amountUsd: 80 })]
    const gap = [makePosition('r1', 'onchain-v3', { amountUsd: 30 })]
    const result = mergeAndDedupPositions([], fb, gap)
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('onchain-v4')
  })

  it('keeps positions with different reserveIds from all sources', () => {
    const sdk = [makePosition('r1', 'sdk')]
    const fb = [makePosition('r2', 'onchain-v3')]
    const gap = [makePosition('r3', 'onchain-v4')]
    const result = mergeAndDedupPositions(sdk, fb, gap)
    expect(result).toHaveLength(3)
    expect(result.map(p => p.reserveId)).toEqual(['r1', 'r2', 'r3'])
  })

  it('handles multiple duplicates across all three sources', () => {
    const sdk = [makePosition('r1', 'sdk'), makePosition('r2', 'sdk')]
    const fb = [makePosition('r1', 'onchain-v3'), makePosition('r3', 'onchain-v4')]
    const gap = [makePosition('r2', 'onchain-v3'), makePosition('r4', 'onchain-v4')]
    const result = mergeAndDedupPositions(sdk, fb, gap)
    expect(result).toHaveLength(4)
    const ids = result.map(p => p.reserveId).sort()
    expect(ids).toEqual(['r1', 'r2', 'r3', 'r4'])
    expect(result.find(p => p.reserveId === 'r1')!.source).toBe('sdk')
    expect(result.find(p => p.reserveId === 'r2')!.source).toBe('sdk')
  })

  it('preserves supply and borrow sides for same reserveId from same source', () => {
    const sdk = [
      makePosition('r1', 'sdk', { side: 'supply', amountUsd: 100 }),
      makePosition('r1', 'sdk', { side: 'borrow', amountUsd: 50 }),
    ]
    const result = mergeAndDedupPositions(sdk, [], [])
    expect(result).toHaveLength(2)
    expect(result[0].side).toBe('supply')
    expect(result[1].side).toBe('borrow')
  })

  it('deduplicates by reserveId+side composite key', () => {
    const sdk = [makePosition('r1', 'sdk', { side: 'supply', amountUsd: 100 })]
    const fb = [makePosition('r1', 'onchain-v3', { side: 'supply', amountUsd: 50 })]
    const gap = [makePosition('r1', 'onchain-v4', { side: 'borrow', amountUsd: 30 })]
    const result = mergeAndDedupPositions(sdk, fb, gap)
    expect(result).toHaveLength(2)
    const supply = result.find(p => p.side === 'supply')!
    expect(supply.source).toBe('sdk')
    const borrow = result.find(p => p.side === 'borrow')!
    expect(borrow.source).toBe('onchain-v4')
  })

  it('skips positions with empty reserveId (orphan)', () => {
    const sdk = [makePosition('', 'sdk', { isOrphan: true }), makePosition('r1', 'sdk')]
    expect(mergeAndDedupPositions(sdk, [], [])).toHaveLength(1)
  })

  it('preserves order: sdk first, then fallback, then gap', () => {
    const sdk = [makePosition('r1', 'sdk')]
    const fb = [makePosition('r2', 'onchain-v3')]
    const gap = [makePosition('r3', 'onchain-v4')]
    const result = mergeAndDedupPositions(sdk, fb, gap)
    expect(result[0].reserveId).toBe('r1')
    expect(result[1].reserveId).toBe('r2')
    expect(result[2].reserveId).toBe('r3')
  })
})

describe('mergeFailedSources', () => {
  it('concatenates and deduplicates failed sources', () => {
    expect(mergeFailedSources(['a', 'b'], ['b', 'c'], ['c', 'd'])).toEqual(['a', 'b', 'c', 'd'])
  })

  it('returns empty for all empty inputs', () => {
    expect(mergeFailedSources([], [], [])).toEqual([])
  })

  it('handles single non-empty input', () => {
    expect(mergeFailedSources(['a', 'b'], [], [])).toEqual(['a', 'b'])
  })
})
