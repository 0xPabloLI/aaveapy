import { describe, it, expect } from 'vitest'
import { getEntrySoftDeleteAction, sortEntriesByHidden } from './portfolioSoftDelete'
import type { PortfolioReserveEntry } from '@/types/portfolio'

const makeEntry = (o: Partial<PortfolioReserveEntry> & { reserveId: string }): PortfolioReserveEntry => ({
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  tokenSymbol: 'USDC',
  supply: { amount: '1000', inputMode: 'usd', walletValue: null },
  borrow: { amount: '', inputMode: 'usd', walletValue: null },
  hidden: false,
  isOrphan: false,
  ...o,
})

describe('soft-delete flows: wallet-owned vs manual (entry-level)', () => {
  it('manual entry is hard-removed on delete', () => {
    const manual = makeEntry({ reserveId: 'r1', supply: { amount: '500', inputMode: 'usd', walletValue: null } })
    expect(getEntrySoftDeleteAction(manual)).toBe('remove')
  })

  it('wallet-synced entry is soft-hidden', () => {
    const wallet = makeEntry({ reserveId: 'r1', supply: { amount: '1000', inputMode: 'usd', walletValue: 1000 } })
    expect(getEntrySoftDeleteAction(wallet)).toBe('toggleHidden')
  })

  it('restore brings back a hidden wallet entry with same data', () => {
    const wallet = makeEntry({ reserveId: 'r1', supply: { amount: '1000', inputMode: 'usd', walletValue: 1000 }, hidden: true })
    const restored = { ...wallet, hidden: false }
    expect(restored.hidden).toBe(false)
    expect(restored.supply.walletValue).toBe(1000)
  })
})

describe('sortEntriesByHidden + soft-delete interaction', () => {
  it('after hiding a wallet entry, sort sinks it to the bottom', () => {
    const a = makeEntry({ reserveId: 'a', supply: { amount: '100', inputMode: 'usd', walletValue: 100 } })
    const b = makeEntry({ reserveId: 'b', supply: { amount: '200', inputMode: 'usd', walletValue: 200 } })
    const next = [{ ...a, hidden: true }, b]
    const sorted = sortEntriesByHidden(next)
    expect(sorted.map(e => e.reserveId)).toEqual(['b', 'a'])
  })
})
