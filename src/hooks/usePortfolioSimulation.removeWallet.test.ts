/**
 * @vitest-environment happy-dom
 *
 * Tests for removeWalletEntries — disconnect should clear wallet-sourced entries
 * while preserving manual entries.
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePortfolioSimulation } from './usePortfolioSimulation'
import type { PortfolioReserveEntry } from '@/types/portfolio'

const baseEntry = (o: Partial<PortfolioReserveEntry> & { reserveId: string }): PortfolioReserveEntry => ({
  marketName: 'AaveV3Ethereum',
  chainName: 'Ethereum',
  chainId: 1,
  tokenSymbol: 'WETH',
  supply: { amount: '', inputMode: 'usd', walletValue: null },
  borrow: { amount: '', inputMode: 'usd', walletValue: null },
  hidden: false,
  isOrphan: false,
  restrictedStatus: null,
  ...o,
})

describe('usePortfolioSimulation.removeWalletEntries', () => {
  it('removes entries with walletValue on supply side', () => {
    const { result } = renderHook(() => usePortfolioSimulation())
    act(() => {
      result.current.actions.importReserves([
        baseEntry({
          reserveId: 'reserve-wallet-usdc',
          supply: { amount: '500', inputMode: 'usd', walletValue: 500 },
        }),
      ])
    })

    act(() => result.current.actions.removeWalletEntries())

    expect(result.current.entries.find((e) => e.reserveId === 'reserve-wallet-usdc')).toBeUndefined()
  })

  it('removes entries with walletValue on borrow side', () => {
    const { result } = renderHook(() => usePortfolioSimulation())
    act(() => {
      result.current.actions.importReserves([
        baseEntry({
          reserveId: 'reserve-wallet-weth',
          borrow: { amount: '2000', inputMode: 'usd', walletValue: 2000 },
        }),
      ])
    })

    act(() => result.current.actions.removeWalletEntries())

    expect(result.current.entries.find((e) => e.reserveId === 'reserve-wallet-weth')).toBeUndefined()
  })

  it('preserves manual entries with no walletValue', () => {
    const { result } = renderHook(() => usePortfolioSimulation())
    act(() => {
      result.current.actions.importReserves([
        baseEntry({
          reserveId: 'reserve-wallet-usdc',
          supply: { amount: '500', inputMode: 'usd', walletValue: 500 },
        }),
        baseEntry({
          reserveId: 'reserve-manual-usdt',
          supply: { amount: '100', inputMode: 'usd', walletValue: null },
          borrow: { amount: '50', inputMode: 'usd', walletValue: null },
        }),
      ])
    })

    act(() => result.current.actions.removeWalletEntries())

    expect(result.current.entries.length).toBe(1)
    expect(result.current.entries[0].reserveId).toBe('reserve-manual-usdt')
  })

  it('removes the entire entry even if only one side has walletValue', () => {
    const { result } = renderHook(() => usePortfolioSimulation())
    act(() => {
      result.current.actions.importReserves([
        baseEntry({
          reserveId: 'reserve-mixed',
          supply: { amount: '500', inputMode: 'usd', walletValue: 500 },
          borrow: { amount: '100', inputMode: 'usd', walletValue: null },
        }),
      ])
    })

    act(() => result.current.actions.removeWalletEntries())

    expect(result.current.entries.length).toBe(0)
  })

  it('returns count of removed entries', () => {
    const { result } = renderHook(() => usePortfolioSimulation())
    act(() => {
      result.current.actions.importReserves([
        baseEntry({
          reserveId: 'reserve-wallet-usdc',
          supply: { amount: '500', inputMode: 'usd', walletValue: 500 },
        }),
        baseEntry({
          reserveId: 'reserve-manual-usdt',
          supply: { amount: '100', inputMode: 'usd', walletValue: null },
        }),
        baseEntry({
          reserveId: 'reserve-wallet-weth',
          supply: { amount: '1000', inputMode: 'usd', walletValue: 1000 },
        }),
      ])
    })

    let removed = 0
    act(() => { removed = result.current.actions.removeWalletEntries() })

    expect(removed).toBe(2)
    expect(result.current.entries.length).toBe(1)
  })

  it('returns 0 when there are no wallet entries', () => {
    const { result } = renderHook(() => usePortfolioSimulation())
    act(() => {
      result.current.actions.importReserves([
        baseEntry({
          reserveId: 'reserve-manual-usdc',
          supply: { amount: '100', inputMode: 'usd', walletValue: null },
        }),
      ])
    })

    let removed = -1
    act(() => { removed = result.current.actions.removeWalletEntries() })

    expect(removed).toBe(0)
    expect(result.current.entries.length).toBe(1)
  })
})
