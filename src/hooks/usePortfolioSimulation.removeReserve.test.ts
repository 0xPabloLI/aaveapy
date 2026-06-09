/**
 * @vitest-environment happy-dom
 *
 * Tests for removeReserve, hideReserve, unhideReserve, and undoLastRemove.
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

describe('usePortfolioSimulation.removeReserve', () => {
  it('hideReserve marks entry as hidden without resetting amounts', () => {
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

  it('hard-removes a row that has no wallet-owned sides', () => {
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

  it('undoLastRemove returns false and is a no-op when there is nothing to undo', () => {
    const { result } = renderHook(() => usePortfolioSimulation())
    let restored = true
    act(() => { restored = result.current.actions.undoLastRemove() })
    expect(restored).toBe(false)
  })
})
