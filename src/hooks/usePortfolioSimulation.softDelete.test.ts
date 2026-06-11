/**
 * @vitest-environment happy-dom
 *
 * Tests for conditional soft delete: hideReserve (wallet) vs removeReserve (manual),
 * unhideReserve, and addReserve auto-unhide.
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePortfolioSimulation } from './usePortfolioSimulation'
import type { PortfolioReserveEntry } from '@/types/portfolio'

const baseEntry = (o: Partial<PortfolioReserveEntry> & { reserveId: string }): PortfolioReserveEntry => ({
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  tokenSymbol: 'WETH',
  supply: { amount: '', inputMode: 'usd', walletValue: null },
  borrow: { amount: '', inputMode: 'usd', walletValue: null },
  hidden: false,
  isOrphan: false,
  restrictedStatus: null,
  ...o,
})

describe('usePortfolioSimulation conditional soft delete', () => {
  it('hideReserve marks wallet entry as hidden without resetting amounts', () => {
    const { result } = renderHook(() => usePortfolioSimulation())

    act(() => {
      result.current.actions.importReserves([
        baseEntry({
          reserveId: 'reserve-weth',
          supply: { amount: '9999', inputMode: 'usd', walletValue: 5000 },
          borrow: { amount: '1234', inputMode: 'usd', walletValue: null },
        }),
      ])
    })

    act(() => result.current.actions.hideReserve('reserve-weth'))

    const entry = result.current.entries.find((e) => e.reserveId === 'reserve-weth')!
    expect(entry.supply.walletValue).toBe(5000)
    expect(entry.supply.amount).toBe('9999')
    expect(entry.hidden).toBe(true)
  })

  it('removeReserve removes manual entry from entries array', () => {
    const { result } = renderHook(() => usePortfolioSimulation())
    act(() => {
      result.current.actions.importReserves([
        baseEntry({
          reserveId: 'reserve-weth',
          supply: { amount: '500', inputMode: 'usd', walletValue: null },
        }),
      ])
    })
    act(() => result.current.actions.removeReserve('reserve-weth'))
    expect(result.current.entries.find((e) => e.reserveId === 'reserve-weth')).toBeUndefined()
  })

  it('unhideReserve restores visibility after hideReserve', () => {
    const { result } = renderHook(() => usePortfolioSimulation())
    act(() => {
      result.current.actions.importReserves([
        baseEntry({
          reserveId: 'reserve-weth',
          supply: { amount: '9999', inputMode: 'usd', walletValue: 5000 },
          borrow: { amount: '1234', inputMode: 'usd', walletValue: null },
        }),
      ])
    })

    act(() => result.current.actions.hideReserve('reserve-weth'))
    const entry = result.current.entries.find((e) => e.reserveId === 'reserve-weth')!
    expect(entry.hidden).toBe(true)

    act(() => result.current.actions.unhideReserve('reserve-weth'))
    const unhidden = result.current.entries.find((e) => e.reserveId === 'reserve-weth')!
    expect(unhidden.hidden).toBe(false)
  })
})

describe('usePortfolioSimulation.addReserve auto-unhide', () => {
  it('addReserve auto-unhides existing hidden entry', () => {
    const { result } = renderHook(() => usePortfolioSimulation())
    act(() => {
      result.current.actions.importReserves([
        baseEntry({
          reserveId: 'reserve-weth',
          supply: { amount: '9999', inputMode: 'usd', walletValue: 5000 },
        }),
      ])
    })

    act(() => result.current.actions.hideReserve('reserve-weth'))
    expect(result.current.entries.find((e) => e.reserveId === 'reserve-weth')?.hidden).toBe(true)

    act(() => {
      result.current.actions.addReserve({
        reserveId: 'reserve-weth',
        marketName: 'AaveV3Ethereum',
        chainName: 'Ethereum',
        tokenSymbol: 'WETH',
      })
    })

    const entry = result.current.entries.find((e) => e.reserveId === 'reserve-weth')!
    expect(entry.hidden).toBe(false)
    expect(entry.supply.amount).toBe('9999')
    expect(entry.supply.walletValue).toBe(5000)
  })

  it('addReserve does not unhide restricted entry', () => {
    const { result } = renderHook(() => usePortfolioSimulation())
    act(() => {
      result.current.actions.addReserve({
        reserveId: 'r-frozen',
        marketName: 'AaveV3Ethereum',
        chainName: 'Ethereum',
        tokenSymbol: 'WETH',
        restrictedStatus: 'frozen',
      })
    })

    expect(result.current.entries.find((e) => e.reserveId === 'r-frozen')?.hidden).toBe(true)

    act(() => {
      result.current.actions.addReserve({
        reserveId: 'r-frozen',
        marketName: 'AaveV3Ethereum',
        chainName: 'Ethereum',
        tokenSymbol: 'WETH',
      })
    })

    expect(result.current.entries.find((e) => e.reserveId === 'r-frozen')?.hidden).toBe(true)
  })
})

describe('usePortfolioSimulation.forceSync guard fix', () => {
  it('force sync updates walletValue for manual entry when incoming has wallet data', () => {
    const { result } = renderHook(() => usePortfolioSimulation())

    act(() => {
      result.current.actions.importReserves([
        baseEntry({
          reserveId: 'reserve-weth',
          supply: { amount: '5000', inputMode: 'usd', walletValue: null },
          borrow: { amount: '', inputMode: 'usd', walletValue: null },
        }),
      ])
    })

    const manualEntry = result.current.entries.find((e) => e.reserveId === 'reserve-weth')!
    expect(manualEntry.supply.walletValue).toBe(null)

    act(() => {
      result.current.actions.forceSyncReserves([
        baseEntry({
          reserveId: 'reserve-weth',
          supply: { amount: '', inputMode: 'usd', walletValue: 3000, source: 'sdk' },
          borrow: { amount: '', inputMode: 'usd', walletValue: null },
        }),
      ])
    })

    const synced = result.current.entries.find((e) => e.reserveId === 'reserve-weth')!
    expect(synced.supply.walletValue).toBe(3000)
    expect(synced.supply.source).toBe('sdk')
    expect(synced.supply.amount).toBe('5000')
    expect(synced.hidden).toBe(false)
  })

  it('force sync does not update manual entry when incoming has no wallet data', () => {
    const { result } = renderHook(() => usePortfolioSimulation())

    act(() => {
      result.current.actions.importReserves([
        baseEntry({
          reserveId: 'reserve-weth',
          supply: { amount: '5000', inputMode: 'usd', walletValue: null },
          borrow: { amount: '', inputMode: 'usd', walletValue: null },
        }),
      ])
    })

    act(() => {
      result.current.actions.forceSyncReserves([
        baseEntry({
          reserveId: 'reserve-weth',
          supply: { amount: '', inputMode: 'usd', walletValue: null },
          borrow: { amount: '', inputMode: 'usd', walletValue: null },
        }),
      ])
    })

    const entry = result.current.entries.find((e) => e.reserveId === 'reserve-weth')!
    expect(entry.supply.walletValue).toBe(null)
    expect(entry.supply.amount).toBe('5000')
  })

  it('force sync preserves hidden entries not in incoming', () => {
    const { result } = renderHook(() => usePortfolioSimulation())

    act(() => {
      result.current.actions.importReserves([
        baseEntry({
          reserveId: 'reserve-weth',
          supply: { amount: '5000', inputMode: 'usd', walletValue: 3000 },
        }),
      ])
    })

    act(() => result.current.actions.hideReserve('reserve-weth'))

    act(() => {
      result.current.actions.forceSyncReserves([])
    })

    const entry = result.current.entries.find((e) => e.reserveId === 'reserve-weth')
    expect(entry).toBeDefined()
    expect(entry!.hidden).toBe(true)
  })
})

describe('usePortfolioSimulation full cycle: delete → re-add → force sync', () => {
  it('delete then re-add then force sync recovers wallet position', () => {
    const { result } = renderHook(() => usePortfolioSimulation())

    act(() => {
      result.current.actions.importReserves([
        baseEntry({
          reserveId: 'reserve-weth',
          supply: { amount: '5000', inputMode: 'usd', walletValue: 3000 },
          borrow: { amount: '', inputMode: 'usd', walletValue: null },
        }),
      ])
    })

    act(() => result.current.actions.hideReserve('reserve-weth'))
    expect(result.current.entries.find((e) => e.reserveId === 'reserve-weth')?.hidden).toBe(true)

    act(() => {
      result.current.actions.addReserve({
        reserveId: 'reserve-weth',
        marketName: 'AaveV3Ethereum',
        chainName: 'Ethereum',
        tokenSymbol: 'WETH',
      })
    })

    const reAdded = result.current.entries.find((e) => e.reserveId === 'reserve-weth')!
    expect(reAdded.hidden).toBe(false)
    expect(reAdded.supply.walletValue).toBe(3000)
    expect(reAdded.supply.amount).toBe('5000')

    act(() => {
      result.current.actions.forceSyncReserves([
        baseEntry({
          reserveId: 'reserve-weth',
          supply: { amount: '', inputMode: 'usd', walletValue: 4000, source: 'sdk' },
          borrow: { amount: '', inputMode: 'usd', walletValue: null },
        }),
      ])
    })

    const synced = result.current.entries.find((e) => e.reserveId === 'reserve-weth')!
    expect(synced.supply.walletValue).toBe(4000)
    expect(synced.supply.amount).toBe('5000')
  })
})
