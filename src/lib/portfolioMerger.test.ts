import { describe, it, expect } from 'vitest'
import type { PortfolioPosition } from '@/types/portfolio'
import { mergePositions } from './portfolioMerger'

const makePos = (overrides: Partial<PortfolioPosition>): PortfolioPosition => ({
  positionId: 'p-default',
  reserveId: 'r-usdc',
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

describe('mergePositions', () => {
  it('adds new wallet positions to empty simulator', () => {
    const walletPositions = [
      makePos({ positionId: 'w1', reserveId: 'r-usdc', tokenSymbol: 'USDC', side: 'supply', amount: '5000', walletValue: 5000 }),
    ]
    const result = mergePositions({ current: [], incoming: walletPositions })
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe('5000')
    expect(result[0].walletValue).toBe(5000)
  })

  it('replaces same token same side with wallet value (merge conflict = replace)', () => {
    const current = [
      makePos({ positionId: 'p1', reserveId: 'r-usdc', tokenSymbol: 'USDC', side: 'supply', amount: '2000', walletValue: 2000 }),
    ]
    const incoming = [
      makePos({ positionId: 'w1', reserveId: 'r-usdc', tokenSymbol: 'USDC', side: 'supply', amount: '5000', walletValue: 5000 }),
    ]
    const result = mergePositions({ current, incoming })
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe('5000')
    expect(result[0].walletValue).toBe(5000)
  })

  it('adds missing side for same token (supply exists, borrow incoming)', () => {
    const current = [
      makePos({ positionId: 'p1', reserveId: 'r-usdc', tokenSymbol: 'USDC', side: 'supply', amount: '5000', walletValue: 5000 }),
    ]
    const incoming = [
      makePos({ positionId: 'w1', reserveId: 'r-usdc', tokenSymbol: 'USDC', side: 'supply', amount: '5000', walletValue: 5000 }),
      makePos({ positionId: 'w2', reserveId: 'r-usdc', tokenSymbol: 'USDC', side: 'borrow', amount: '1000', walletValue: 1000 }),
    ]
    const result = mergePositions({ current, incoming })
    expect(result).toHaveLength(2)
    const supply = result.find(p => p.side === 'supply')!
    const borrow = result.find(p => p.side === 'borrow')!
    expect(supply.amount).toBe('5000')
    expect(borrow.amount).toBe('1000')
    expect(borrow.walletValue).toBe(1000)
  })

  it('keeps simulator-only positions unchanged', () => {
    const current = [
      makePos({ positionId: 'p1', reserveId: 'r-usdc', tokenSymbol: 'USDC', side: 'supply', amount: '2000', walletValue: null }),
      makePos({ positionId: 'p2', reserveId: 'r-dai', tokenSymbol: 'DAI', side: 'supply', amount: '3000', walletValue: null }),
    ]
    const incoming = [
      makePos({ positionId: 'w1', reserveId: 'r-usdc', tokenSymbol: 'USDC', side: 'supply', amount: '5000', walletValue: 5000 }),
    ]
    const result = mergePositions({ current, incoming })
    expect(result).toHaveLength(2)
    const usdc = result.find(p => p.reserveId === 'r-usdc')!
    const dai = result.find(p => p.reserveId === 'r-dai')!
    expect(usdc.amount).toBe('5000')
    expect(usdc.walletValue).toBe(5000)
    expect(dai.amount).toBe('3000')
    expect(dai.walletValue).toBeNull()
  })

  it('replaces wallet-sourced positions while preserving manual positions', () => {
    const current = [
      makePos({ positionId: 'old-wallet', reserveId: 'r-usdc', tokenSymbol: 'USDC', side: 'supply', amount: '2000', walletValue: 2000 }),
      makePos({ positionId: 'manual', reserveId: 'r-dai', tokenSymbol: 'DAI', side: 'supply', amount: '3000', walletValue: null }),
    ]
    const incoming = [
      makePos({ positionId: 'new-wallet', reserveId: 'r-weth', tokenSymbol: 'WETH', side: 'supply', amount: '5000', walletValue: 5000 }),
    ]
    const result = mergePositions({ current, incoming })

    expect(result.some((p) => p.positionId === 'old-wallet')).toBe(false)
    expect(result.some((p) => p.positionId === 'manual')).toBe(true)
    expect(result.some((p) => p.positionId === 'new-wallet')).toBe(true)
  })

  it('unhides hidden positions when wallet sync provides new value', () => {
    const current = [
      makePos({ positionId: 'p1', reserveId: 'r-usdc', tokenSymbol: 'USDC', side: 'supply', amount: '2000', walletValue: 2000, hidden: true }),
    ]
    const incoming = [
      makePos({ positionId: 'w1', reserveId: 'r-usdc', tokenSymbol: 'USDC', side: 'supply', amount: '5000', walletValue: 5000 }),
    ]
    const result = mergePositions({ current, incoming })
    expect(result[0].hidden).toBe(false)
    expect(result[0].walletValue).toBe(5000)
  })

  it('preserves orphan flag from incoming positions', () => {
    const incoming = [
      makePos({ positionId: 'w1', reserveId: 'r-unknown', tokenSymbol: 'MYST', side: 'supply', amount: '100', walletValue: 100, isOrphan: true }),
    ]
    const result = mergePositions({ current: [], incoming })
    expect(result[0].isOrphan).toBe(true)
  })

  it('handles empty incoming by returning current unchanged', () => {
    const current = [
      makePos({ positionId: 'p1', reserveId: 'r-usdc', tokenSymbol: 'USDC', side: 'supply', amount: '2000' }),
    ]
    const result = mergePositions({ current, incoming: [] })
    expect(result).toEqual(current)
  })

  it('handles empty current by adding all incoming', () => {
    const incoming = [
      makePos({ positionId: 'w1', reserveId: 'r-usdc', tokenSymbol: 'USDC', side: 'supply', amount: '5000', walletValue: 5000 }),
      makePos({ positionId: 'w2', reserveId: 'r-weth', tokenSymbol: 'WETH', side: 'borrow', amount: '1000', walletValue: 1000 }),
    ]
    const result = mergePositions({ current: [], incoming })
    expect(result).toHaveLength(2)
  })
})
