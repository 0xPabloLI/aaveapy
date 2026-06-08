import { describe, it, expect } from 'vitest'
import { sortEntriesByHidden, getEntrySoftDeleteAction } from './portfolioSoftDelete'
import type { PortfolioReserveEntry } from '@/types/portfolio'

const makeEntry = (overrides: Partial<PortfolioReserveEntry> & { reserveId: string }): PortfolioReserveEntry => ({
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  tokenSymbol: 'USDC',
  supply: { amount: '1000', inputMode: 'usd', walletValue: null },
  borrow: { amount: '', inputMode: 'usd', walletValue: null },
  hidden: false,
  isOrphan: false,
  ...overrides,
})

describe('sortEntriesByHidden', () => {
  it('returns empty array unchanged', () => {
    expect(sortEntriesByHidden([])).toEqual([])
  })

  it('keeps non-hidden entries in original order', () => {
    const a = makeEntry({ reserveId: 'a' })
    const b = makeEntry({ reserveId: 'b' })
    expect(sortEntriesByHidden([a, b]).map(e => e.reserveId)).toEqual(['a', 'b'])
  })

  it('sinks hidden entries to bottom, preserving relative order', () => {
    const a = makeEntry({ reserveId: 'a', hidden: false })
    const b = makeEntry({ reserveId: 'b', hidden: true })
    const c = makeEntry({ reserveId: 'c', hidden: false })
    const d = makeEntry({ reserveId: 'd', hidden: true })
    expect(sortEntriesByHidden([a, b, c, d]).map(e => e.reserveId)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('handles all-hidden entries', () => {
    const a = makeEntry({ reserveId: 'a', hidden: true })
    const b = makeEntry({ reserveId: 'b', hidden: true })
    expect(sortEntriesByHidden([a, b]).map(e => e.reserveId)).toEqual(['a', 'b'])
  })

  it('does not mutate original array', () => {
    const a = makeEntry({ reserveId: 'a', hidden: false })
    const b = makeEntry({ reserveId: 'b', hidden: true })
    const original = [a, b]
    const sorted = sortEntriesByHidden(original)
    expect(original.map(e => e.reserveId)).toEqual(['a', 'b'])
    expect(sorted.map(e => e.reserveId)).toEqual(['a', 'b'])
  })
})

describe('getEntrySoftDeleteAction', () => {
  it('returns "toggleHidden" for wallet-synced entry', () => {
    const entry = makeEntry({ reserveId: 'a', supply: { amount: '1000', inputMode: 'usd', walletValue: 1000 } })
    expect(getEntrySoftDeleteAction(entry)).toBe('toggleHidden')
  })

  it('returns "toggleHidden" for wallet-modified entry', () => {
    const entry = makeEntry({ reserveId: 'a', supply: { amount: '2000', inputMode: 'usd', walletValue: 1000 } })
    expect(getEntrySoftDeleteAction(entry)).toBe('toggleHidden')
  })

  it('returns "remove" for manual entry (walletValue null on both sides)', () => {
    const entry = makeEntry({ reserveId: 'a', supply: { amount: '500', inputMode: 'usd', walletValue: null } })
    expect(getEntrySoftDeleteAction(entry)).toBe('remove')
  })

  it('returns "remove" for manual entry with empty amounts', () => {
    const entry = makeEntry({ reserveId: 'a', supply: { amount: '', inputMode: 'usd', walletValue: null } })
    expect(getEntrySoftDeleteAction(entry)).toBe('remove')
  })
})
