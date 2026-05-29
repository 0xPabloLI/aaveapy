import { describe, it, expect } from 'vitest'
import type { PortfolioPosition } from '@/types/portfolio'
import { getWalletSyncState } from './portfolioWalletSync'

describe('WalletSyncState tri-state', () => {
  const base: PortfolioPosition = {
    positionId: 'p1',
    reserveId: 'r1',
    marketName: 'M',
    chainName: 'C',
    tokenSymbol: 'USDC',
    side: 'supply',
    amount: '5000',
    inputMode: 'usd',
    walletValue: null,
    hidden: false,
    isOrphan: false,
  }

  it('returns manual when walletValue is null', () => {
    expect(getWalletSyncState({ ...base, walletValue: null })).toBe('manual')
  })

  it('returns synced when currentValue equals walletValue', () => {
    expect(getWalletSyncState({ ...base, walletValue: 5000 })).toBe('synced')
  })

  it('returns modified when currentValue differs from walletValue', () => {
    expect(getWalletSyncState({ ...base, walletValue: 3000 })).toBe('modified')
  })

  it('returns synced when both are 0', () => {
    expect(getWalletSyncState({ ...base, amount: '0', walletValue: 0 })).toBe('synced')
  })

  it('returns modified when walletValue is 0 but amount is positive', () => {
    expect(getWalletSyncState({ ...base, amount: '100', walletValue: 0 })).toBe('modified')
  })
})

describe('PortfolioPosition defaults', () => {
  it('manual position has walletValue=null, hidden=false, isOrphan=false', () => {
    const pos: PortfolioPosition = {
      positionId: 'p1',
      reserveId: 'r1',
      marketName: 'M',
      chainName: 'C',
      tokenSymbol: 'USDC',
      side: 'supply',
      amount: '1000',
      inputMode: 'usd',
      walletValue: null,
      hidden: false,
      isOrphan: false,
    }
    expect(pos.walletValue).toBeNull()
    expect(pos.hidden).toBe(false)
    expect(pos.isOrphan).toBe(false)
    expect(getWalletSyncState(pos)).toBe('manual')
  })

  it('wallet-synced position has walletValue set', () => {
    const pos: PortfolioPosition = {
      positionId: 'p2',
      reserveId: 'r2',
      marketName: 'M',
      chainName: 'C',
      tokenSymbol: 'WETH',
      side: 'borrow',
      amount: '2000',
      inputMode: 'usd',
      walletValue: 2000,
      hidden: false,
      isOrphan: false,
    }
    expect(getWalletSyncState(pos)).toBe('synced')
  })

  it('hidden position can still be synced or modified', () => {
    const pos: PortfolioPosition = {
      positionId: 'p3',
      reserveId: 'r3',
      marketName: 'M',
      chainName: 'C',
      tokenSymbol: 'DAI',
      side: 'supply',
      amount: '500',
      inputMode: 'usd',
      walletValue: 1000,
      hidden: true,
      isOrphan: false,
    }
    expect(pos.hidden).toBe(true)
    expect(getWalletSyncState(pos)).toBe('modified')
  })
})
