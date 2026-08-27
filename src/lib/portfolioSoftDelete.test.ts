import { describe, it, expect } from 'vitest'
import { sortEntriesByHidden } from './portfolioSoftDelete'
import type { PortfolioReserveEntry } from '@/types/portfolio'

const makeEntry = (overrides: Partial<PortfolioReserveEntry> & { reserveId: string }): PortfolioReserveEntry => ({
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  chainId: 1,
  tokenSymbol: 'USDC',
  supply: { amount: '1000', inputMode: 'usd', walletValue: null },
  borrow: { amount: '', inputMode: 'usd', walletValue: null },
  hidden: false,
  isOrphan: false,
  restrictedStatus: null,
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
