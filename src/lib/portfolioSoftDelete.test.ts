import { describe, it, expect } from 'vitest'
import { sortPositionsByHidden, getSoftDeleteAction, hideOrRemoveReserve, unhideReserve } from './portfolioSoftDelete'
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

describe('hideOrRemoveReserve', () => {
  it('resets wallet positions to walletValue and marks hidden=true', () => {
    const supply = makePos({ positionId: 's1', reserveId: 'r1', side: 'supply', walletValue: 1000, amount: '2000' })
    const borrow = makePos({ positionId: 'b1', reserveId: 'r1', side: 'borrow', walletValue: 500, amount: '600' })
    const other = makePos({ positionId: 'o1', reserveId: 'r2', side: 'supply', walletValue: 100, amount: '100' })
    const result = hideOrRemoveReserve('r1', [supply, borrow, other])
    const r1Result = result.filter(p => p.reserveId === 'r1')
    expect(r1Result).toHaveLength(2)
    expect(r1Result.find(p => p.side === 'supply')).toMatchObject({ amount: '1000', inputMode: 'usd', hidden: true })
    expect(r1Result.find(p => p.side === 'borrow')).toMatchObject({ amount: '500', inputMode: 'usd', hidden: true })
    expect(result.filter(p => p.reserveId === 'r2')).toHaveLength(1)
  })

  it('removes purely manual positions entirely', () => {
    const supply = makePos({ positionId: 's1', reserveId: 'r1', side: 'supply', walletValue: null, amount: '500' })
    const borrow = makePos({ positionId: 'b1', reserveId: 'r1', side: 'borrow', walletValue: null, amount: '300' })
    const other = makePos({ positionId: 'o1', reserveId: 'r2', side: 'supply', walletValue: 100, amount: '100' })
    const result = hideOrRemoveReserve('r1', [supply, borrow, other])
    expect(result.filter(p => p.reserveId === 'r1')).toHaveLength(0)
    expect(result).toHaveLength(1)
  })

  it('resets wallet positions and discards manual sides in mixed reserve', () => {
    const supply = makePos({ positionId: 's1', reserveId: 'r1', side: 'supply', walletValue: 1000, amount: '2000' })
    const borrow = makePos({ positionId: 'b1', reserveId: 'r1', side: 'borrow', walletValue: null, amount: '500' })
    const result = hideOrRemoveReserve('r1', [supply, borrow])
    const r1Result = result.filter(p => p.reserveId === 'r1')
    expect(r1Result).toHaveLength(1)
    expect(r1Result[0]).toMatchObject({ side: 'supply', amount: '1000', hidden: true })
  })
})

describe('unhideReserve', () => {
  it('sets hidden=false for all positions with matching reserveId', () => {
    const s1 = makePos({ positionId: 's1', reserveId: 'r1', side: 'supply', walletValue: 1000, amount: '1000', hidden: true })
    const b1 = makePos({ positionId: 'b1', reserveId: 'r1', side: 'borrow', walletValue: 500, amount: '500', hidden: true })
    const o1 = makePos({ positionId: 'o1', reserveId: 'r2', side: 'supply', hidden: false })
    const result = unhideReserve('r1', [s1, b1, o1])
    expect(result.filter(p => p.reserveId === 'r1').every(p => !p.hidden)).toBe(true)
    expect(result.find(p => p.reserveId === 'r2')!.hidden).toBe(false)
  })

  it('does not change positions for non-matching reserveId', () => {
    const o1 = makePos({ positionId: 'o1', reserveId: 'r2', hidden: true })
    const result = unhideReserve('r1', [o1])
    expect(result[0].hidden).toBe(true)
  })
})
