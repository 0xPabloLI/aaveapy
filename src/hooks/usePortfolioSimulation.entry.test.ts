// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePortfolioSimulation } from '@/hooks/usePortfolioSimulation'
import type { PortfolioReserveEntry } from '@/types/portfolio'

const emptySide = { amount: '', inputMode: 'usd' as const, walletValue: null }

function makeEntry(overrides: Partial<PortfolioReserveEntry> & { reserveId: string }): PortfolioReserveEntry {
  return {
    marketName: 'AaveV3Ethereum',
    chainName: 'Ethereum',
    tokenSymbol: 'USDC',
    supply: { ...emptySide },
    borrow: { ...emptySide },
    hidden: false,
    isOrphan: false,
    restrictedStatus: null,
    ...overrides,
  }
}

describe('usePortfolioSimulation — PortfolioReserveEntry API', () => {
  describe('addReserve', () => {
    it('creates a single entry with both supply and borrow sides', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.addReserve({
          reserveId: 'r-weth',
          marketName: 'AaveV3Ethereum',
          chainName: 'Ethereum',
          tokenSymbol: 'WETH',
        })
      })

      const entries = result.current.entries
      expect(entries).toHaveLength(1)
      expect(entries[0].reserveId).toBe('r-weth')
      expect(entries[0].supply).toBeDefined()
      expect(entries[0].borrow).toBeDefined()
      expect(entries[0].supply.amount).toBe('')
      expect(entries[0].borrow.amount).toBe('')
      expect(entries[0].hidden).toBe(false)
    })

    it('does not create duplicate entries for same reserveId', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.addReserve({
          reserveId: 'r-weth',
          marketName: 'AaveV3Ethereum',
          chainName: 'Ethereum',
          tokenSymbol: 'WETH',
        })
      })
      act(() => {
        result.current.actions.addReserve({
          reserveId: 'r-weth',
          marketName: 'AaveV3Ethereum',
          chainName: 'Ethereum',
          tokenSymbol: 'WETH',
        })
      })

      expect(result.current.entries).toHaveLength(1)
    })
  })

  describe('removeReserve', () => {
    it('removes the entire entry by reserveId', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.addReserve({ reserveId: 'r-weth', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'WETH' })
        result.current.actions.addReserve({ reserveId: 'r-gho', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'GHO' })
      })

      expect(result.current.entries).toHaveLength(2)

      act(() => { result.current.actions.removeReserve('r-weth') })

      expect(result.current.entries).toHaveLength(1)
      expect(result.current.entries[0].reserveId).toBe('r-gho')
    })
  })

  describe('updateReserve', () => {
    it('patches supply amount without affecting borrow', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })
      act(() => {
        result.current.actions.addReserve({ reserveId: 'r-weth', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'WETH' })
      })

      act(() => {
        result.current.actions.updateReserve('r-weth', { supplyAmount: '5000' })
      })

      const entry = result.current.entries.find(e => e.reserveId === 'r-weth')
      expect(entry?.supply.amount).toBe('5000')
      expect(entry?.borrow.amount).toBe('')
    })

    it('patches borrow amount without affecting supply', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })
      act(() => {
        result.current.actions.addReserve({ reserveId: 'r-weth', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'WETH' })
      })

      act(() => {
        result.current.actions.updateReserve('r-weth', { borrowAmount: '3000' })
      })

      const entry = result.current.entries.find(e => e.reserveId === 'r-weth')
      expect(entry?.supply.amount).toBe('')
      expect(entry?.borrow.amount).toBe('3000')
    })

    it('converts amount when switching inputMode with priceInUsd', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })
      act(() => {
        result.current.actions.addReserve({ reserveId: 'r-weth', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'WETH' })
      })

      act(() => {
        result.current.actions.updateReserve('r-weth', { supplyAmount: '5000' })
      })

      act(() => {
        result.current.actions.updateReserve('r-weth', { supplyInputMode: 'token' }, 2500)
      })

      const entry = result.current.entries.find(e => e.reserveId === 'r-weth')
      expect(entry?.supply.inputMode).toBe('token')
      expect(entry?.supply.amount).toBe('2')
    })
  })

  describe('hideReserve / unhideReserve', () => {
    it('hides the entire entry (sets hidden=true)', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })
      act(() => {
        result.current.actions.addReserve({ reserveId: 'r-weth', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'WETH' })
      })

      act(() => { result.current.actions.hideReserve('r-weth') })

      const entry = result.current.entries.find(e => e.reserveId === 'r-weth')
      expect(entry?.hidden).toBe(true)
    })

    it('unhides the entire entry (sets hidden=false)', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })
      act(() => {
        result.current.actions.addReserve({ reserveId: 'r-weth', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'WETH' })
      })

      act(() => { result.current.actions.hideReserve('r-weth') })
      act(() => { result.current.actions.unhideReserve('r-weth') })

      const entry = result.current.entries.find(e => e.reserveId === 'r-weth')
      expect(entry?.hidden).toBe(false)
    })
  })

  describe('importReserves', () => {
    it('imports entries with wallet data preserving structure', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.importReserves([
          makeEntry({
            reserveId: 'r-weth',
            tokenSymbol: 'WETH',
            supply: { amount: '1737', inputMode: 'usd', walletValue: 1737, source: 'sdk' },
            borrow: { amount: '', inputMode: 'usd', walletValue: null },
          }),
        ])
      })

      const entries = result.current.entries
      expect(entries).toHaveLength(1)
      expect(entries[0].supply.walletValue).toBe(1737)
      expect(entries[0].supply.amount).toBe('1737')
      expect(entries[0].borrow.walletValue).toBeNull()
    })

    it('preserves user delta on re-import when wallet value changes', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.importReserves([
          makeEntry({
            reserveId: 'r-weth',
            tokenSymbol: 'WETH',
            supply: { amount: '5000', inputMode: 'usd', walletValue: 3000, source: 'sdk' },
            borrow: { amount: '', inputMode: 'usd', walletValue: null },
          }),
        ])
      })

      act(() => {
        result.current.actions.importReserves([
          makeEntry({
            reserveId: 'r-weth',
            tokenSymbol: 'WETH',
            supply: { amount: '4000', inputMode: 'usd', walletValue: 4000, source: 'sdk' },
            borrow: { amount: '', inputMode: 'usd', walletValue: null },
          }),
        ])
      })

      const entry = result.current.entries.find(e => e.reserveId === 'r-weth')
      expect(entry?.supply.walletValue).toBe(4000)
      expect(Number(entry?.supply.amount)).toBeCloseTo(6000, -1)
    })
  })

  describe('forceSyncReserves', () => {
    it('updates walletValue but preserves user amount/inputMode', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.importReserves([
          makeEntry({
            reserveId: 'r-weth',
            tokenSymbol: 'WETH',
            supply: { amount: '2', inputMode: 'token', walletValue: 3000, source: 'sdk' },
            borrow: { amount: '', inputMode: 'usd', walletValue: null },
          }),
        ])
      })

      const before = result.current.entries.find(e => e.reserveId === 'r-weth')!
      expect(before.supply.inputMode).toBe('token')

      act(() => {
        result.current.actions.forceSyncReserves([
          makeEntry({
            reserveId: 'r-weth',
            tokenSymbol: 'WETH',
            supply: { amount: '4000', inputMode: 'usd', walletValue: 4000, source: 'sdk', deltaSign: 'positive' },
            borrow: { amount: '', inputMode: 'usd', walletValue: null },
          }),
        ])
      })

      const after = result.current.entries.find(e => e.reserveId === 'r-weth')!
      expect(after.supply.walletValue).toBe(4000)
      expect(after.supply.amount).toBe('2')
      expect(after.supply.inputMode).toBe('token')
      expect(after.supply.source).toBe('sdk')
      expect(after.supply.deltaSign).toBe('positive')
    })

    it('preserves manual entries (walletValue === null) untouched', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.addReserve({
          reserveId: 'r-manual',
          marketName: 'AaveV3Ethereum',
          chainName: 'Ethereum',
          tokenSymbol: 'MANUAL',
        })
      })
      act(() => {
        result.current.actions.updateReserve('r-manual', {
          supplyAmount: '999',
          supplyInputMode: 'usd',
        })
      })

      act(() => {
        result.current.actions.forceSyncReserves([
          makeEntry({
            reserveId: 'r-weth',
            tokenSymbol: 'WETH',
            supply: { amount: '2000', inputMode: 'usd', walletValue: 2000, source: 'sdk' },
            borrow: { amount: '', inputMode: 'usd', walletValue: null },
          }),
        ])
      })

      const manual = result.current.entries.find(e => e.reserveId === 'r-manual')
      expect(manual?.supply.amount).toBe('999')
      expect(manual?.supply.walletValue).toBeNull()
    })

    it('does not discard entries absent from incoming if they have no wallet data', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.addReserve({
          reserveId: 'r-manual',
          marketName: 'AaveV3Ethereum',
          chainName: 'Ethereum',
          tokenSymbol: 'MANUAL',
        })
      })
      act(() => {
        result.current.actions.updateReserve('r-manual', {
          supplyAmount: '500',
          supplyInputMode: 'usd',
        })
      })

      act(() => {
        result.current.actions.forceSyncReserves([])
      })

      const manual = result.current.entries.find(e => e.reserveId === 'r-manual')
      expect(manual).toBeDefined()
    })
  })

  describe('restoreToWallet', () => {
    it('restores both sides to their wallet values', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.importReserves([
          makeEntry({
            reserveId: 'r-weth',
            tokenSymbol: 'WETH',
            supply: { amount: '1737', inputMode: 'usd', walletValue: 1737, source: 'sdk' },
            borrow: { amount: '500', inputMode: 'usd', walletValue: 500, source: 'sdk' },
          }),
        ])
      })

      act(() => {
        result.current.actions.updateReserve('r-weth', { supplyAmount: '9999' })
      })

      act(() => {
        result.current.actions.restoreToWallet('r-weth')
      })

      const entry = result.current.entries.find(e => e.reserveId === 'r-weth')
      expect(entry?.supply.amount).toBe('1737')
      expect(entry?.borrow.amount).toBe('500')
    })

    it('restores only one side when side is specified', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.importReserves([
          makeEntry({
            reserveId: 'r-weth',
            tokenSymbol: 'WETH',
            supply: { amount: '1737', inputMode: 'usd', walletValue: 1737, source: 'sdk' },
            borrow: { amount: '500', inputMode: 'usd', walletValue: 500, source: 'sdk' },
          }),
        ])
      })

      act(() => {
        result.current.actions.updateReserve('r-weth', { supplyAmount: '9999' })
        result.current.actions.updateReserve('r-weth', { borrowAmount: '8888' })
      })

      act(() => {
        result.current.actions.restoreToWallet('r-weth', 'supply')
      })

      const entry = result.current.entries.find(e => e.reserveId === 'r-weth')
      expect(entry?.supply.amount).toBe('1737')
      expect(entry?.borrow.amount).toBe('8888')
    })
  })

  describe('undoLastRemove', () => {
    it('restores entries after removeReserve', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.addReserve({ reserveId: 'r-weth', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'WETH' })
        result.current.actions.addReserve({ reserveId: 'r-gho', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'GHO' })
      })

      expect(result.current.entries).toHaveLength(2)

      act(() => { result.current.actions.removeReserve('r-weth') })
      expect(result.current.entries).toHaveLength(1)

      let restored: boolean | undefined
      act(() => { restored = result.current.actions.undoLastRemove() })

      expect(restored).toBe(true)
      expect(result.current.entries).toHaveLength(2)
    })

    it('returns false when nothing to undo', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      let restored: boolean | undefined
      act(() => { restored = result.current.actions.undoLastRemove() })

      expect(restored).toBe(false)
    })
  })

  describe('removeHiddenEntries', () => {
    it('removes hidden entries and returns count', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.addReserve({ reserveId: 'r-weth', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'WETH' })
        result.current.actions.addReserve({ reserveId: 'r-gho', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'GHO' })
        result.current.actions.addReserve({ reserveId: 'r-usdc', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'USDC' })
      })

      act(() => { result.current.actions.hideReserve('r-weth') })
      act(() => { result.current.actions.hideReserve('r-gho') })

      let removedCount = 0
      act(() => { removedCount = result.current.actions.removeHiddenEntries() })

      expect(removedCount).toBe(2)
      expect(result.current.entries).toHaveLength(1)
      expect(result.current.entries[0].reserveId).toBe('r-usdc')
    })

    it('preserves non-hidden entries untouched in mixed scenario', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.addReserve({ reserveId: 'r-weth', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'WETH' })
        result.current.actions.addReserve({ reserveId: 'r-gho', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'GHO' })
      })

      // Set different amounts to verify non-hidden entries keep their data
      act(() => { result.current.actions.updateReserve('r-weth', { supplyAmount: '1000' }) })
      act(() => { result.current.actions.updateReserve('r-gho', { supplyAmount: '2000' }) })

      // Hide only r-weth
      act(() => { result.current.actions.hideReserve('r-weth') })

      let removedCount = 0
      act(() => { removedCount = result.current.actions.removeHiddenEntries() })

      expect(removedCount).toBe(1)
      expect(result.current.entries).toHaveLength(1)
      // r-gho preserved with its amount
      const remaining = result.current.entries[0]
      expect(remaining.reserveId).toBe('r-gho')
      expect(remaining.supply.amount).toBe('2000')
      expect(remaining.hidden).toBe(false)
    })

    it('returns 0 when no hidden entries exist', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.addReserve({ reserveId: 'r-weth', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'WETH' })
      })

      let removedCount = -1
      act(() => { removedCount = result.current.actions.removeHiddenEntries() })

      expect(removedCount).toBe(0)
      expect(result.current.entries).toHaveLength(1)
    })

    it('removes all entries when all are hidden', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.addReserve({ reserveId: 'r-weth', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'WETH' })
      })

      act(() => { result.current.actions.hideReserve('r-weth') })

      let removedCount = 0
      act(() => { removedCount = result.current.actions.removeHiddenEntries() })

      expect(removedCount).toBe(1)
      expect(result.current.entries).toHaveLength(0)
    })
  })

  describe('clearAll', () => {
    it('removes all entries', () => {
      const { result } = renderHook(() => usePortfolioSimulation())
      act(() => { result.current.actions.setActive(true) })

      act(() => {
        result.current.actions.addReserve({ reserveId: 'r-weth', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'WETH' })
        result.current.actions.addReserve({ reserveId: 'r-gho', marketName: 'AaveV3Ethereum', chainName: 'Ethereum', tokenSymbol: 'GHO' })
      })

      expect(result.current.entries).toHaveLength(2)

      act(() => { result.current.actions.clearAll() })

      expect(result.current.entries).toHaveLength(0)
    })
  })
})
