import { describe, it, expect } from 'vitest'
import { canUnhide, applyRestrictedHidden } from './portfolioRestricted'
import type { PortfolioReserveEntry } from '@/types/portfolio'

const makeEntry = (
  overrides: Partial<PortfolioReserveEntry> & { reserveId: string },
): PortfolioReserveEntry => ({
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

describe('canUnhide', () => {
  it('returns true for normal entry (no restrictedStatus)', () => {
    const entry = makeEntry({ reserveId: 'a' })
    expect(canUnhide(entry)).toBe(true)
  })

  it('returns true for entry with restrictedStatus: null', () => {
    const entry = makeEntry({ reserveId: 'a', restrictedStatus: null })
    expect(canUnhide(entry)).toBe(true)
  })

  it('returns false for frozen entry', () => {
    const entry = makeEntry({ reserveId: 'a', restrictedStatus: 'frozen' })
    expect(canUnhide(entry)).toBe(false)
  })

  it('returns false for paused entry', () => {
    const entry = makeEntry({ reserveId: 'a', restrictedStatus: 'paused' })
    expect(canUnhide(entry)).toBe(false)
  })

  it('returns false for inactive entry', () => {
    const entry = makeEntry({ reserveId: 'a', restrictedStatus: 'inactive' })
    expect(canUnhide(entry)).toBe(false)
  })

  it('returns true for entry with restrictedStatus: undefined (defensive)', () => {
    const entry = makeEntry({ reserveId: 'a' })
    delete (entry as unknown as Record<string, unknown>).restrictedStatus
    expect(canUnhide(entry)).toBe(true)
  })
})

describe('applyRestrictedHidden', () => {
  it('returns empty array unchanged', () => {
    expect(applyRestrictedHidden([])).toEqual([])
  })

  it('forces hidden: true for frozen entry', () => {
    const entry = makeEntry({ reserveId: 'a', restrictedStatus: 'frozen', hidden: false })
    const result = applyRestrictedHidden([entry])
    expect(result[0].hidden).toBe(true)
  })

  it('forces hidden: true for paused entry', () => {
    const entry = makeEntry({ reserveId: 'a', restrictedStatus: 'paused', hidden: false })
    const result = applyRestrictedHidden([entry])
    expect(result[0].hidden).toBe(true)
  })

  it('forces hidden: true for inactive entry', () => {
    const entry = makeEntry({ reserveId: 'a', restrictedStatus: 'inactive', hidden: false })
    const result = applyRestrictedHidden([entry])
    expect(result[0].hidden).toBe(true)
  })

  it('does not change hidden for non-restricted entry', () => {
    const visible = makeEntry({ reserveId: 'a', restrictedStatus: null, hidden: false })
    const hidden = makeEntry({ reserveId: 'b', restrictedStatus: null, hidden: true })
    const result = applyRestrictedHidden([visible, hidden])
    expect(result[0].hidden).toBe(false)
    expect(result[1].hidden).toBe(true)
  })

  it('keeps restricted entry hidden even if it was already hidden', () => {
    const entry = makeEntry({ reserveId: 'a', restrictedStatus: 'frozen', hidden: true })
    const result = applyRestrictedHidden([entry])
    expect(result[0].hidden).toBe(true)
  })

  it('preserves all other entry fields', () => {
    const entry = makeEntry({
      reserveId: 'a',
      restrictedStatus: 'paused',
      hidden: false,
      supply: { amount: '500', inputMode: 'token', walletValue: 500 },
      tokenSymbol: 'DAI',
    })
    const result = applyRestrictedHidden([entry])
    expect(result[0].reserveId).toBe('a')
    expect(result[0].restrictedStatus).toBe('paused')
    expect(result[0].supply.amount).toBe('500')
    expect(result[0].tokenSymbol).toBe('DAI')
    expect(result[0].hidden).toBe(true)
  })

  it('does not mutate original entries', () => {
    const entry = makeEntry({ reserveId: 'a', restrictedStatus: 'frozen', hidden: false })
    applyRestrictedHidden([entry])
    expect(entry.hidden).toBe(false)
  })

  it('handles mixed entries: restricted forced hidden, normal unchanged', () => {
    const normal = makeEntry({ reserveId: 'a', restrictedStatus: null, hidden: false })
    const frozen = makeEntry({ reserveId: 'b', restrictedStatus: 'frozen', hidden: false })
    const paused = makeEntry({ reserveId: 'c', restrictedStatus: 'paused', hidden: false })
    const result = applyRestrictedHidden([normal, frozen, paused])
    expect(result[0].hidden).toBe(false)
    expect(result[1].hidden).toBe(true)
    expect(result[2].hidden).toBe(true)
  })

  it('does not force hidden for entry with restrictedStatus: undefined (defensive)', () => {
    const entry = makeEntry({ reserveId: 'a' })
    delete (entry as unknown as Record<string, unknown>).restrictedStatus
    const result = applyRestrictedHidden([entry])
    expect(result[0].hidden).toBe(false)
  })
})
