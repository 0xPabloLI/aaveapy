import { describe, it, expect } from 'vitest'
import type { PortfolioPosition } from '@/types/portfolio'
import { mergePositions } from '@/lib/portfolioMerger'

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

describe('importPositions via mergePositions (state reducer)', () => {
  it('merge replaces existing position and preserves others', () => {
    const current = [
      makePos({ positionId: 'p1', reserveId: 'r-usdc', tokenSymbol: 'USDC', side: 'supply', amount: '2000', walletValue: 2000 }),
      makePos({ positionId: 'p2', reserveId: 'r-dai', tokenSymbol: 'DAI', side: 'supply', amount: '3000', walletValue: null }),
    ]
    const incoming = [
      makePos({ positionId: 'w1', reserveId: 'r-usdc', tokenSymbol: 'USDC', side: 'supply', amount: '5000', walletValue: 5000 }),
    ]
    const result = mergePositions({ current, incoming })
    expect(result).toHaveLength(2)
    const usdc = result.find(p => p.reserveId === 'r-usdc')!
    expect(usdc.amount).toBe('5000')
    expect(usdc.walletValue).toBe(5000)
    const dai = result.find(p => p.reserveId === 'r-dai')!
    expect(dai.amount).toBe('3000')
  })
})

describe('restorePosition state update', () => {
  it('sets hidden=false on target position', () => {
    const positions = [
      makePos({ positionId: 'p1', hidden: true }),
      makePos({ positionId: 'p2', hidden: false }),
    ]
    const result = positions.map(p => p.positionId === 'p1' ? { ...p, hidden: false } : p)
    expect(result[0].hidden).toBe(false)
    expect(result[1].hidden).toBe(false)
  })
})

describe('toggleHidden state update', () => {
  it('toggles hidden flag on target position', () => {
    const positions = [
      makePos({ positionId: 'p1', hidden: false }),
      makePos({ positionId: 'p2', hidden: true }),
    ]
    const toggle = (id: string) => positions.map(p => p.positionId === id ? { ...p, hidden: !p.hidden } : p)
    expect(toggle('p1')[0].hidden).toBe(true)
    expect(toggle('p2')[1].hidden).toBe(false)
  })
})
