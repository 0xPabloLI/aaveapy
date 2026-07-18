// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePortfolioSimulation } from './usePortfolioSimulation';

describe('updateReserve — amount conversion', () => {
  it('converts USD→Token amount when priceInUsd is provided', () => {
    const { result } = renderHook(() => usePortfolioSimulation());

    act(() => {
      result.current.actions.setActive(true);
    });

    act(() => {
      result.current.actions.addReserve({
        reserveId: 'res-1',
        marketName: 'Aave V3',
        chainName: 'Ethereum',
        chainId: 1,
        tokenSymbol: 'USDC',
      });
    });

    act(() => {
      result.current.actions.updateReserve('res-1', { supplyAmount: '5000', supplyInputMode: 'usd' });
    });

    const entryBefore = result.current.entries.find((e) => e.reserveId === 'res-1')!;
    expect(entryBefore.supply.amount).toBe('5000');
    expect(entryBefore.supply.inputMode).toBe('usd');

    act(() => {
      result.current.actions.updateReserve('res-1', { supplyInputMode: 'token' }, 2500);
    });

    const entryAfter = result.current.entries.find((e) => e.reserveId === 'res-1')!;
    expect(entryAfter.supply.inputMode).toBe('token');
    expect(Number(entryAfter.supply.amount)).toBeCloseTo(2, 5);
    expect(entryAfter.supply.amount).not.toBe('5000');
  });

  it('converts Token→USD amount when priceInUsd is provided', () => {
    const { result } = renderHook(() => usePortfolioSimulation());

    act(() => {
      result.current.actions.setActive(true);
    });

    act(() => {
      result.current.actions.addReserve({
        reserveId: 'res-1',
        marketName: 'Aave V3',
        chainName: 'Ethereum',
        chainId: 1,
        tokenSymbol: 'USDC',
      });
    });

    act(() => {
      result.current.actions.updateReserve('res-1', { supplyAmount: '2', supplyInputMode: 'token' });
    });

    act(() => {
      result.current.actions.updateReserve('res-1', { supplyInputMode: 'usd' }, 2500);
    });

    const entry = result.current.entries.find((e) => e.reserveId === 'res-1')!;
    expect(entry.supply.inputMode).toBe('usd');
    expect(Number(entry.supply.amount)).toBeCloseTo(5000, 2);
  });

  it('round-trips USD→Token→USD back to ~original', () => {
    const { result } = renderHook(() => usePortfolioSimulation());

    act(() => {
      result.current.actions.setActive(true);
    });

    act(() => {
      result.current.actions.addReserve({
        reserveId: 'res-1',
        marketName: 'Aave V3',
        chainName: 'Ethereum',
        chainId: 1,
        tokenSymbol: 'USDC',
      });
    });

    act(() => {
      result.current.actions.updateReserve('res-1', { supplyAmount: '5000', supplyInputMode: 'usd' });
    });

    act(() => {
      result.current.actions.updateReserve('res-1', { supplyInputMode: 'token' }, 2500);
    });

    const afterFirst = result.current.entries.find((e) => e.reserveId === 'res-1')!;
    expect(afterFirst.supply.inputMode).toBe('token');

    act(() => {
      result.current.actions.updateReserve('res-1', { supplyInputMode: 'usd' }, 2500);
    });

    const afterRoundTrip = result.current.entries.find((e) => e.reserveId === 'res-1')!;
    expect(afterRoundTrip.supply.inputMode).toBe('usd');
    expect(Math.abs(Number(afterRoundTrip.supply.amount) - 5000)).toBeLessThan(0.01);
  });

  it('clears amount when priceInUsd is invalid (≤0)', () => {
    const { result } = renderHook(() => usePortfolioSimulation());

    act(() => {
      result.current.actions.setActive(true);
    });

    act(() => {
      result.current.actions.addReserve({
        reserveId: 'res-1',
        marketName: 'Aave V3',
        chainName: 'Ethereum',
        chainId: 1,
        tokenSymbol: 'USDC',
      });
    });

    act(() => {
      result.current.actions.updateReserve('res-1', { supplyAmount: '5000', supplyInputMode: 'usd' });
    });

    act(() => {
      result.current.actions.updateReserve('res-1', { supplyInputMode: 'token' }, 0);
    });

    const entry = result.current.entries.find((e) => e.reserveId === 'res-1')!;
    expect(entry.supply.inputMode).toBe('token');
    expect(entry.supply.amount).toBe('');
  });

  it('does not convert when priceInUsd is omitted (backward compat)', () => {
    const { result } = renderHook(() => usePortfolioSimulation());

    act(() => {
      result.current.actions.setActive(true);
    });

    act(() => {
      result.current.actions.addReserve({
        reserveId: 'res-1',
        marketName: 'Aave V3',
        chainName: 'Ethereum',
        chainId: 1,
        tokenSymbol: 'USDC',
      });
    });

    act(() => {
      result.current.actions.updateReserve('res-1', { supplyAmount: '5000', supplyInputMode: 'usd' });
    });

    act(() => {
      result.current.actions.updateReserve('res-1', { supplyInputMode: 'token' });
    });

    const entry = result.current.entries.find((e) => e.reserveId === 'res-1')!;
    expect(entry.supply.inputMode).toBe('token');
    expect(entry.supply.amount).toBe('5000');
  });

  it('supply toggle does not affect borrow side', () => {
    const { result } = renderHook(() => usePortfolioSimulation());

    act(() => {
      result.current.actions.setActive(true);
    });

    act(() => {
      result.current.actions.addReserve({
        reserveId: 'res-1',
        marketName: 'Aave V3',
        chainName: 'Ethereum',
        chainId: 1,
        tokenSymbol: 'USDC',
      });
    });

    act(() => {
      result.current.actions.updateReserve('res-1', { supplyAmount: '5000', supplyInputMode: 'usd', borrowAmount: '3000', borrowInputMode: 'usd' });
    });

    act(() => {
      result.current.actions.updateReserve('res-1', { supplyInputMode: 'token' }, 2500);
    });

    const entry = result.current.entries.find((e) => e.reserveId === 'res-1')!;
    expect(entry.borrow.amount).toBe('3000');
    expect(entry.borrow.inputMode).toBe('usd');
  });
});

describe('importReserves — auto-complete missing sides', () => {
  it('creates entry with both supply and borrow sides when wallet only has supply', () => {
    const { result } = renderHook(() => usePortfolioSimulation());
    act(() => { result.current.actions.setActive(true); });

    act(() => {
      result.current.actions.importReserves([
        {
          reserveId: 'r-weth',
          marketName: 'AaveV3Ethereum',
          chainName: 'Ethereum',
          chainId: 1,
          tokenSymbol: 'WETH',
          supply: { amount: '1737', inputMode: 'usd', walletValue: 1737, source: 'sdk' },
          borrow: { amount: '', inputMode: 'usd', walletValue: null },
          hidden: false,
          isOrphan: false,
          restrictedStatus: null,
        },
      ]);
    });

    const wethEntry = result.current.entries.find(e => e.reserveId === 'r-weth');
    expect(wethEntry).toBeDefined();
    expect(wethEntry!.supply.walletValue).toBe(1737);
    expect(wethEntry!.borrow.walletValue).toBeNull();
    expect(wethEntry!.borrow.amount).toBe('');
  });

  it('creates entry with both supply and borrow sides when wallet only has borrow', () => {
    const { result } = renderHook(() => usePortfolioSimulation());
    act(() => { result.current.actions.setActive(true); });

    act(() => {
      result.current.actions.importReserves([
        {
          reserveId: 'r-gho',
          marketName: 'AaveV3Ethereum',
          chainName: 'Ethereum',
          chainId: 1,
          tokenSymbol: 'GHO',
          supply: { amount: '', inputMode: 'usd', walletValue: null },
          borrow: { amount: '9674', inputMode: 'usd', walletValue: 9674, source: 'sdk' },
          hidden: false,
          isOrphan: false,
          restrictedStatus: null,
        },
      ]);
    });

    const ghoEntry = result.current.entries.find(e => e.reserveId === 'r-gho');
    expect(ghoEntry).toBeDefined();
    expect(ghoEntry!.borrow.walletValue).toBe(9674);
    expect(ghoEntry!.supply.walletValue).toBeNull();
  });

  it('keeps both sides when wallet already has both', () => {
    const { result } = renderHook(() => usePortfolioSimulation());
    act(() => { result.current.actions.setActive(true); });

    act(() => {
      result.current.actions.importReserves([
        {
          reserveId: 'r-usdt0',
          marketName: 'AaveV3Ethereum',
          chainName: 'Ethereum',
          chainId: 1,
          tokenSymbol: 'USDT0',
          supply: { amount: '10000', inputMode: 'usd', walletValue: 10000, source: 'sdk' },
          borrow: { amount: '5000', inputMode: 'usd', walletValue: 5000, source: 'sdk' },
          hidden: false,
          isOrphan: false,
          restrictedStatus: null,
        },
      ]);
    });

    const usdt0Entry = result.current.entries.find(e => e.reserveId === 'r-usdt0');
    expect(usdt0Entry).toBeDefined();
    expect(usdt0Entry!.supply.walletValue).toBe(10000);
    expect(usdt0Entry!.borrow.walletValue).toBe(5000);
  });

  it('handles multiple reserves with different side combinations', () => {
    const { result } = renderHook(() => usePortfolioSimulation());
    act(() => { result.current.actions.setActive(true); });

    act(() => {
      result.current.actions.importReserves([
        {
          reserveId: 'r-weth',
          marketName: 'AaveV3Ethereum',
          chainName: 'Ethereum',
          chainId: 1,
          tokenSymbol: 'WETH',
          supply: { amount: '1000', inputMode: 'usd', walletValue: 1000, source: 'sdk' },
          borrow: { amount: '', inputMode: 'usd', walletValue: null },
          hidden: false,
          isOrphan: false,
          restrictedStatus: null,
        },
        {
          reserveId: 'r-gho',
          marketName: 'AaveV3Ethereum',
          chainName: 'Ethereum',
          chainId: 1,
          tokenSymbol: 'GHO',
          supply: { amount: '', inputMode: 'usd', walletValue: null },
          borrow: { amount: '2000', inputMode: 'usd', walletValue: 2000, source: 'sdk' },
          hidden: false,
          isOrphan: false,
          restrictedStatus: null,
        },
      ]);
    });

    expect(result.current.entries).toHaveLength(2);
    const wethEntry = result.current.entries.find(e => e.reserveId === 'r-weth')!;
    const ghoEntry = result.current.entries.find(e => e.reserveId === 'r-gho')!;
    expect(wethEntry.supply.walletValue).toBe(1000);
    expect(wethEntry.borrow.walletValue).toBeNull();
    expect(ghoEntry.borrow.walletValue).toBe(2000);
    expect(ghoEntry.supply.walletValue).toBeNull();
  });
});
