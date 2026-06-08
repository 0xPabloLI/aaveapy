import { describe, it, expect } from 'vitest'
import type { PortfolioSideData } from '@/types/portfolio'
import { getSideSyncState } from './portfolioWalletSync'

describe('getSideSyncState', () => {
  const base: PortfolioSideData = {
    amount: '5000',
    inputMode: 'usd',
    walletValue: null,
  }

  it('returns manual when walletValue is null', () => {
    expect(getSideSyncState({ ...base, walletValue: null })).toBe('manual')
  })

  it('returns synced when currentValue equals walletValue', () => {
    expect(getSideSyncState({ ...base, walletValue: 5000 })).toBe('synced')
  })

  it('returns modified when currentValue differs from walletValue', () => {
    expect(getSideSyncState({ ...base, walletValue: 3000 })).toBe('modified')
  })

  it('returns synced when both are 0', () => {
    expect(getSideSyncState({ ...base, amount: '0', walletValue: 0 })).toBe('synced')
  })

  it('returns modified when walletValue is 0 but amount is positive', () => {
    expect(getSideSyncState({ ...base, amount: '100', walletValue: 0 })).toBe('modified')
  })

  it('returns modified when inputMode is not usd', () => {
    expect(getSideSyncState({ ...base, inputMode: 'token', walletValue: 5000 })).toBe('modified')
  })
})
