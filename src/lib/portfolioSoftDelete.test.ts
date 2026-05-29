import { describe, it, expect } from 'vitest'
import { sortPositionsByHidden, getSoftDeleteAction } from './portfolioSoftDelete'
import type { PortfolioPosition } from '@/types/portfolio'

const makePos = (overrides: Partial<PortfolioPosition> & { positionId: string }): PortfolioPosition => ({
  reserveId: 'r1',
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  tokenSymbol: 'USDC',
  side: 'supply',
  amount: '1000',
  inputMode: 'usd',
  walletValue: null,
  hidden: false,
  isOrphan: false,
  ...overrides,
})

describe('sortPositionsByHidden', () => {
  it('returns empty array unchanged', () => {
    expect(sortPositionsByHidden([])).toEqual([])
  })

  it('keeps non-hidden positions in original order', () => {
    const a = makePos({ positionId: 'a' })
    const b = makePos({ positionId: 'b' })
    expect(sortPositionsByHidden([a, b]).map(p => p.positionId)).toEqual(['a', 'b'])
  })

  it('sinks hidden positions to bottom, preserving relative order', () => {
    const a = makePos({ positionId: 'a', hidden: false })
    const b = makePos({ positionId: 'b', hidden: true })
    const c = makePos({ positionId: 'c', hidden: false })
    const d = makePos({ positionId: 'd', hidden: true })
    expect(sortPositionsByHidden([a, b, c, d]).map(p => p.positionId)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('handles all-hidden positions', () => {
    const a = makePos({ positionId: 'a', hidden: true })
    const b = makePos({ positionId: 'b', hidden: true })
    expect(sortPositionsByHidden([a, b]).map(p => p.positionId)).toEqual(['a', 'b'])
  })

  it('does not mutate original array', () => {
    const a = makePos({ positionId: 'a', hidden: false })
    const b = makePos({ positionId: 'b', hidden: true })
    const original = [a, b]
    const sorted = sortPositionsByHidden(original)
    expect(original.map(p => p.positionId)).toEqual(['a', 'b'])
    expect(sorted.map(p => p.positionId)).toEqual(['a', 'b'])
  })
})

describe('getSoftDeleteAction', () => {
  it('returns "toggleHidden" for wallet-synced position', () => {
    const pos = makePos({ positionId: 'a', walletValue: 1000, amount: '1000' })
    expect(getSoftDeleteAction(pos)).toBe('toggleHidden')
  })

  it('returns "toggleHidden" for wallet-modified position', () => {
    const pos = makePos({ positionId: 'a', walletValue: 1000, amount: '2000' })
    expect(getSoftDeleteAction(pos)).toBe('toggleHidden')
  })

  it('returns "remove" for manual position (walletValue null)', () => {
    const pos = makePos({ positionId: 'a', walletValue: null, amount: '500' })
    expect(getSoftDeleteAction(pos)).toBe('remove')
  })

  it('returns "remove" for manual position with empty amount', () => {
    const pos = makePos({ positionId: 'a', walletValue: null, amount: '' })
    expect(getSoftDeleteAction(pos)).toBe('remove')
  })
})
