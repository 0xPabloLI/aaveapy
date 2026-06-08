/**
 * @vitest-environment happy-dom
 *
 * Regression: removeReserve resets a wallet-touched reserve back to the wallet
 * amounts on every side, drops any purely-manual sides layered on top, and
 * allows the prior state to be restored via undoLastRemove.
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePortfolioSimulation } from './usePortfolioSimulation'
import type { PortfolioPosition } from '@/types/portfolio'

const basePos = (o: Partial<PortfolioPosition> & { positionId: string }): PortfolioPosition => ({
  reserveId: 'reserve-weth',
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  tokenSymbol: 'WETH',
  side: 'supply',
  amount: '',
  inputMode: 'usd',
  walletValue: null,
  hidden: false,
  isOrphan: false,
  ...o,
})

describe('usePortfolioSimulation.removeReserve', () => {
  it('resets a manually-edited wallet side back to the wallet amount and drops purely-manual sides on the same row', () => {
    const { result } = renderHook(() => usePortfolioSimulation())

    act(() => {
      result.current.actions.importPositions([
        basePos({ positionId: 'p-supply', side: 'supply', walletValue: 5000, amount: '9999', inputMode: 'usd' }),
        basePos({ positionId: 'p-borrow', side: 'borrow', walletValue: null, amount: '1234' }),
      ])
    })

    act(() => result.current.actions.removeReserve('reserve-weth'))

    const group = result.current.positions.filter((p) => p.reserveId === 'reserve-weth')
    // Manual borrow side should be gone, wallet supply side should remain at 5000.
    expect(group).toHaveLength(1)
    expect(group[0].side).toBe('supply')
    expect(group[0].walletValue).toBe(5000)
    expect(group[0].amount).toBe('5000')
    expect(group[0].inputMode).toBe('usd')
    expect(group[0].hidden).toBe(true)
  })

  it('hard-removes a row that has no wallet-owned sides', () => {
    const { result } = renderHook(() => usePortfolioSimulation())
    act(() => {
      result.current.actions.importPositions([
        basePos({ positionId: 'p-manual', side: 'supply', walletValue: null, amount: '500' }),
      ])
    })
    act(() => result.current.actions.removeReserve('reserve-weth'))
    expect(result.current.positions.filter((p) => p.reserveId === 'reserve-weth')).toHaveLength(0)
  })

  it('removeReserve with wallet positions marks hidden=true; unhideReserveAction restores visibility', () => {
    const { result } = renderHook(() => usePortfolioSimulation())
    act(() => {
      result.current.actions.importPositions([
        basePos({ positionId: 'p-supply', side: 'supply', walletValue: 5000, amount: '9999', inputMode: 'usd' }),
        basePos({ positionId: 'p-borrow', side: 'borrow', walletValue: null, amount: '1234' }),
      ])
    })

    act(() => result.current.actions.removeReserve('reserve-weth'))
    // After removeReserve: wallet supply side is reset + hidden, manual borrow is dropped
    const supply = result.current.positions.find((p) => p.positionId === 'p-supply')
    expect(supply?.amount).toBe('5000')
    expect(supply?.hidden).toBe(true)
    expect(result.current.positions.find((p) => p.positionId === 'p-borrow')).toBeUndefined()

    // unhideReserveAction restores visibility
    act(() => result.current.actions.unhideReserveAction('reserve-weth'))
    const unhidden = result.current.positions.find((p) => p.positionId === 'p-supply')
    expect(unhidden?.hidden).toBe(false)
  })

  it('undoLastRemove returns false and is a no-op when there is nothing to undo', () => {
    const { result } = renderHook(() => usePortfolioSimulation())
    let restored = true
    act(() => { restored = result.current.actions.undoLastRemove() })
    expect(restored).toBe(false)
  })
})
