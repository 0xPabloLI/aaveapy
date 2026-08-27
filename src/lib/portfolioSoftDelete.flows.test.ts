import { describe, it, expect } from 'vitest'
import { sortEntriesByHidden } from './portfolioSoftDelete'
import type { PortfolioReserveEntry } from '@/types/portfolio'

const makeEntry = (o: Partial<PortfolioReserveEntry> & { reserveId: string }): PortfolioReserveEntry => ({
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  chainId: 1,
  tokenSymbol: 'USDC',
  supply: { amount: '1000', inputMode: 'usd', walletValue: null },
  borrow: { amount: '', inputMode: 'usd', walletValue: null },
  hidden: false,
  isOrphan: false,
  restrictedStatus: null,
  ...o,
})

describe('unified soft delete: all entries hidden, never hard-removed', () => {
  it('manual entry is hidden (not hard-removed) on delete', () => {
    const manual = makeEntry({ reserveId: 'r1', supply: { amount: '500', inputMode: 'usd', walletValue: null } })
    const hidden = { ...manual, hidden: true }
    expect(hidden.hidden).toBe(true)
    expect(hidden.supply.amount).toBe('500')
  })

  it('wallet-synced entry is hidden on delete', () => {
    const wallet = makeEntry({ reserveId: 'r1', supply: { amount: '1000', inputMode: 'usd', walletValue: 1000 } })
    const hidden = { ...wallet, hidden: true }
    expect(hidden.hidden).toBe(true)
    expect(hidden.supply.walletValue).toBe(1000)
  })

  it('restore brings back a hidden entry with same data', () => {
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

  it('wallet positions sort above manual positions', () => {
    const wallet = makeEntry({ reserveId: 'wallet', supply: { amount: '1000', inputMode: 'usd', walletValue: 1000 } })
    const manual = makeEntry({ reserveId: 'manual', supply: { amount: '500', inputMode: 'usd', walletValue: null } })
    const sorted = sortEntriesByHidden([manual, wallet])
    expect(sorted.map(e => e.reserveId)).toEqual(['wallet', 'manual'])
  })

  it('hidden entries always sort to the bottom regardless of wallet source', () => {
    const wallet = makeEntry({ reserveId: 'wallet', supply: { amount: '1000', inputMode: 'usd', walletValue: 1000 } })
    const manual = makeEntry({ reserveId: 'manual', supply: { amount: '500', inputMode: 'usd', walletValue: null } })
    const hiddenWallet = makeEntry({ reserveId: 'hiddenWallet', supply: { amount: '1000', inputMode: 'usd', walletValue: 1000 }, hidden: true })
    const hiddenManual = makeEntry({ reserveId: 'hiddenManual', supply: { amount: '500', inputMode: 'usd', walletValue: null }, hidden: true })
    const sorted = sortEntriesByHidden([hiddenManual, manual, hiddenWallet, wallet])
    expect(sorted.map(e => e.reserveId)).toEqual(['wallet', 'manual', 'hiddenManual', 'hiddenWallet'])
  })

  it('borrow-side walletValue counts as wallet position', () => {
    const borrowWallet = makeEntry({ reserveId: 'borrowWallet', supply: { amount: '', inputMode: 'usd', walletValue: null }, borrow: { amount: '100', inputMode: 'usd', walletValue: 100 } })
    const manual = makeEntry({ reserveId: 'manual', supply: { amount: '', inputMode: 'usd', walletValue: null }, borrow: { amount: '', inputMode: 'usd', walletValue: null } })
    const sorted = sortEntriesByHidden([manual, borrowWallet])
    expect(sorted.map(e => e.reserveId)).toEqual(['borrowWallet', 'manual'])
  })
})
