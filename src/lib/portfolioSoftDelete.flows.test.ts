import { describe, it, expect } from 'vitest'
import { getSoftDeleteAction, sortPositionsByHidden } from './portfolioSoftDelete'
import { mergePositions } from './portfolioMerger'
import { getWalletSyncState } from './portfolioWalletSync'
import type { PortfolioPosition } from '@/types/portfolio'

const makePos = (o: Partial<PortfolioPosition> & { positionId: string }): PortfolioPosition => ({
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
  ...o,
})

/**
 * Simulate the row click handler in PortfolioTokenRow: picks remove vs toggleHidden
 * based on whether the position is wallet-owned.
 */
function applySoftDelete(
  positions: PortfolioPosition[],
  positionId: string,
): PortfolioPosition[] {
  const target = positions.find(p => p.positionId === positionId)
  if (!target) return positions
  const action = getSoftDeleteAction(target)
  if (action === 'remove') {
    return positions.filter(p => p.positionId !== positionId)
  }
  return positions.map(p =>
    p.positionId === positionId ? { ...p, hidden: !p.hidden } : p,
  )
}

function restorePosition(
  positions: PortfolioPosition[],
  positionId: string,
): PortfolioPosition[] {
  return positions.map(p =>
    p.positionId === positionId ? { ...p, hidden: false } : p,
  )
}

describe('soft-delete flows: wallet-owned vs manual', () => {
  it('manual position is hard-removed on delete (no undo state)', () => {
    const manual = makePos({ positionId: 'm1', walletValue: null, amount: '500' })
    const next = applySoftDelete([manual], 'm1')
    expect(next).toHaveLength(0)
  })

  it('wallet-synced position is soft-hidden, preserving data for undo', () => {
    const wallet = makePos({ positionId: 'w1', walletValue: 1000, amount: '1000' })
    const hidden = applySoftDelete([wallet], 'w1')
    expect(hidden).toHaveLength(1)
    expect(hidden[0].hidden).toBe(true)
    expect(hidden[0].walletValue).toBe(1000)
    expect(hidden[0].amount).toBe('1000')
  })

  it('wallet-modified position is soft-hidden (not removed) to keep edits', () => {
    const modified = makePos({ positionId: 'w2', walletValue: 1000, amount: '2500' })
    expect(getWalletSyncState(modified)).toBe('modified')
    const hidden = applySoftDelete([modified], 'w2')
    expect(hidden[0].hidden).toBe(true)
    expect(hidden[0].amount).toBe('2500')
  })

  it('restore brings back a hidden wallet position with same data', () => {
    const wallet = makePos({ positionId: 'w1', walletValue: 1000, amount: '1000', hidden: true })
    const restored = restorePosition([wallet], 'w1')
    expect(restored[0].hidden).toBe(false)
    expect(restored[0].walletValue).toBe(1000)
  })

  it('toggling hidden twice round-trips back to visible', () => {
    const wallet = makePos({ positionId: 'w1', walletValue: 1000, amount: '1000' })
    const once = applySoftDelete([wallet], 'w1')
    const twice = applySoftDelete(once, 'w1')
    expect(twice[0].hidden).toBe(false)
  })
})

describe('wallet re-sync recovery via mergePositions', () => {
  it('re-syncing wallet un-hides a previously soft-deleted wallet position', () => {
    const hidden = makePos({ positionId: 'w1', walletValue: 1000, amount: '1000', hidden: true })
    const incoming = makePos({ positionId: 'fresh', walletValue: 1200, amount: '1200' })
    const merged = mergePositions({ current: [hidden], incoming: [incoming] })
    expect(merged).toHaveLength(1)
    expect(merged[0].hidden).toBe(false)
    expect(merged[0].walletValue).toBe(1200)
    expect(merged[0].amount).toBe('1200')
  })

  it('re-syncing preserves manual (non-wallet) positions that are not in incoming', () => {
    const manual = makePos({ positionId: 'm1', reserveId: 'rM', walletValue: null, amount: '500' })
    const walletOld = makePos({ positionId: 'w1', reserveId: 'rW', walletValue: 1000, amount: '1000' })
    const incoming = makePos({ positionId: 'fresh', reserveId: 'rW', walletValue: 1500, amount: '1500' })
    const merged = mergePositions({ current: [manual, walletOld], incoming: [incoming] })
    const ids = merged.map(p => p.reserveId).sort()
    expect(ids).toEqual(['rM', 'rW'])
    const m = merged.find(p => p.reserveId === 'rM')!
    expect(m.amount).toBe('500')
    expect(m.walletValue).toBeNull()
  })

  it('wallet position no longer in incoming is dropped (auto-cleanup)', () => {
    const walletOld = makePos({ positionId: 'w1', reserveId: 'rW', walletValue: 1000, amount: '1000' })
    const merged = mergePositions({ current: [walletOld], incoming: [] })
    expect(merged).toHaveLength(0)
  })

  it('user edits to a wallet position are overwritten by fresh wallet values on re-sync', () => {
    const edited = makePos({ positionId: 'w1', walletValue: 1000, amount: '9999' })
    const incoming = makePos({ positionId: 'fresh', walletValue: 1000, amount: '1000' })
    const merged = mergePositions({ current: [edited], incoming: [incoming] })
    expect(merged[0].amount).toBe('1000')
    expect(getWalletSyncState(merged[0])).toBe('synced')
  })
})

describe('sortPositionsByHidden + soft-delete interaction', () => {
  it('after hiding a wallet position, sort sinks it to the bottom', () => {
    const a = makePos({ positionId: 'a', walletValue: 100, amount: '100' })
    const b = makePos({ positionId: 'b', walletValue: 200, amount: '200' })
    const next = applySoftDelete([a, b], 'a')
    const sorted = sortPositionsByHidden(next)
    expect(sorted.map(p => p.positionId)).toEqual(['b', 'a'])
  })
})
