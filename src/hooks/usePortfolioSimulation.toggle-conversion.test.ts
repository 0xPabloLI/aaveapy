// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePortfolioSimulation } from './usePortfolioSimulation';

describe('updateInputMode — amount conversion', () => {
  it('converts USD→Token amount when priceInUsd is provided', () => {
    const { result } = renderHook(() => usePortfolioSimulation());

    act(() => {
      result.current.actions.setActive(true);
    });

    let positionId: string;
    act(() => {
      positionId = result.current.actions.addPosition({
        reserveId: 'res-1',
        marketName: 'Aave V3',
        chainName: 'Ethereum',
        tokenSymbol: 'USDC',
        side: 'supply',
        amount: '5000',
        inputMode: 'usd',
      });
    });

    const posBefore = result.current.positions.find((p) => p.positionId === positionId)!;
    expect(posBefore.amount).toBe('5000');
    expect(posBefore.inputMode).toBe('usd');

    act(() => {
      result.current.actions.updateInputMode(positionId, 'token', 2500);
    });

    const posAfter = result.current.positions.find((p) => p.positionId === positionId)!;
    expect(posAfter.inputMode).toBe('token');
    expect(Number(posAfter.amount)).toBeCloseTo(2, 5);
    expect(posAfter.amount).not.toBe('5000');
  });

  it('converts Token→USD amount when priceInUsd is provided', () => {
    const { result } = renderHook(() => usePortfolioSimulation());

    act(() => {
      result.current.actions.setActive(true);
    });

    let positionId: string;
    act(() => {
      positionId = result.current.actions.addPosition({
        reserveId: 'res-1',
        marketName: 'Aave V3',
        chainName: 'Ethereum',
        tokenSymbol: 'USDC',
        side: 'supply',
        amount: '2',
        inputMode: 'token',
      });
    });

    act(() => {
      result.current.actions.updateInputMode(positionId, 'usd', 2500);
    });

    const pos = result.current.positions.find((p) => p.positionId === positionId)!;
    expect(pos.inputMode).toBe('usd');
    expect(Number(pos.amount)).toBeCloseTo(5000, 2);
  });

  it('round-trips USD→Token→USD back to ~original', () => {
    const { result } = renderHook(() => usePortfolioSimulation());

    act(() => {
      result.current.actions.setActive(true);
    });

    let positionId: string;
    act(() => {
      positionId = result.current.actions.addPosition({
        reserveId: 'res-1',
        marketName: 'Aave V3',
        chainName: 'Ethereum',
        tokenSymbol: 'USDC',
        side: 'supply',
        amount: '5000',
        inputMode: 'usd',
      });
    });

    act(() => {
      result.current.actions.updateInputMode(positionId, 'token', 2500);
    });

    const afterFirst = result.current.positions.find((p) => p.positionId === positionId)!;
    expect(afterFirst.inputMode).toBe('token');

    act(() => {
      result.current.actions.updateInputMode(positionId, 'usd', 2500);
    });

    const afterRoundTrip = result.current.positions.find((p) => p.positionId === positionId)!;
    expect(afterRoundTrip.inputMode).toBe('usd');
    expect(Math.abs(Number(afterRoundTrip.amount) - 5000)).toBeLessThan(0.01);
  });

  it('clears amount when priceInUsd is invalid (≤0)', () => {
    const { result } = renderHook(() => usePortfolioSimulation());

    act(() => {
      result.current.actions.setActive(true);
    });

    let positionId: string;
    act(() => {
      positionId = result.current.actions.addPosition({
        reserveId: 'res-1',
        marketName: 'Aave V3',
        chainName: 'Ethereum',
        tokenSymbol: 'USDC',
        side: 'supply',
        amount: '5000',
        inputMode: 'usd',
      });
    });

    act(() => {
      result.current.actions.updateInputMode(positionId, 'token', 0);
    });

    const pos = result.current.positions.find((p) => p.positionId === positionId)!;
    expect(pos.inputMode).toBe('token');
    expect(pos.amount).toBe('');
  });

  it('does not convert when priceInUsd is omitted (backward compat)', () => {
    const { result } = renderHook(() => usePortfolioSimulation());

    act(() => {
      result.current.actions.setActive(true);
    });

    let positionId: string;
    act(() => {
      positionId = result.current.actions.addPosition({
        reserveId: 'res-1',
        marketName: 'Aave V3',
        chainName: 'Ethereum',
        tokenSymbol: 'USDC',
        side: 'supply',
        amount: '5000',
        inputMode: 'usd',
      });
    });

    act(() => {
      result.current.actions.updateInputMode(positionId, 'token');
    });

    const pos = result.current.positions.find((p) => p.positionId === positionId)!;
    expect(pos.inputMode).toBe('token');
    expect(pos.amount).toBe('5000');
  });

  it('supply toggle does not affect borrow position', () => {
    const { result } = renderHook(() => usePortfolioSimulation());

    act(() => {
      result.current.actions.setActive(true);
    });

    let supplyId: string;
    let borrowId: string;
    act(() => {
      supplyId = result.current.actions.addPosition({
        reserveId: 'res-1',
        marketName: 'Aave V3',
        chainName: 'Ethereum',
        tokenSymbol: 'USDC',
        side: 'supply',
        amount: '5000',
        inputMode: 'usd',
      });
      borrowId = result.current.actions.addPosition({
        reserveId: 'res-1',
        marketName: 'Aave V3',
        chainName: 'Ethereum',
        tokenSymbol: 'USDC',
        side: 'borrow',
        amount: '3000',
        inputMode: 'usd',
      });
    });

    act(() => {
      result.current.actions.updateInputMode(supplyId, 'token', 2500);
    });

    const borrow = result.current.positions.find((p) => p.positionId === borrowId)!;
    expect(borrow.amount).toBe('3000');
    expect(borrow.inputMode).toBe('usd');
  });
});

describe('importPositions — auto-complete missing sides', () => {
  const makeWalletPos = (overrides: Partial<{
    reserveId: string;
    marketName: string;
    chainName: string;
    tokenSymbol: string;
    side: 'supply' | 'borrow';
    amount: string;
    walletValue: number | null;
    isOrphan: boolean;
    source: 'sdk' | 'onchain-v3' | 'onchain-v4';
  }>) => ({
    positionId: `w-${Math.random()}`,
    reserveId: overrides.reserveId ?? 'r1',
    marketName: overrides.marketName ?? 'AaveV3Ethereum',
    chainName: overrides.chainName ?? 'Ethereum',
    tokenSymbol: overrides.tokenSymbol ?? 'USDC',
    side: overrides.side ?? 'supply',
    amount: overrides.amount ?? '5000',
    inputMode: 'usd' as const,
    walletValue: overrides.walletValue ?? 5000,
    hidden: false,
    isOrphan: overrides.isOrphan ?? false,
    source: overrides.source ?? 'sdk',
  });

  it('creates both supply and borrow rows when wallet only has supply', () => {
    const { result } = renderHook(() => usePortfolioSimulation());
    act(() => { result.current.actions.setActive(true); });

    act(() => {
      result.current.actions.importPositions([
        makeWalletPos({ reserveId: 'r-weth', tokenSymbol: 'WETH', side: 'supply', amount: '1737', walletValue: 1737 }),
      ]);
    });

    const wethPositions = result.current.positions.filter(p => p.reserveId === 'r-weth');
    expect(wethPositions).toHaveLength(2);
    expect(wethPositions.find(p => p.side === 'supply')?.walletValue).toBe(1737);
    expect(wethPositions.find(p => p.side === 'borrow')?.walletValue).toBeNull();
    expect(wethPositions.find(p => p.side === 'borrow')?.amount).toBe('');
  });

  it('creates both supply and borrow rows when wallet only has borrow', () => {
    const { result } = renderHook(() => usePortfolioSimulation());
    act(() => { result.current.actions.setActive(true); });

    act(() => {
      result.current.actions.importPositions([
        makeWalletPos({ reserveId: 'r-gho', tokenSymbol: 'GHO', side: 'borrow', amount: '9674', walletValue: 9674 }),
      ]);
    });

    const ghoPositions = result.current.positions.filter(p => p.reserveId === 'r-gho');
    expect(ghoPositions).toHaveLength(2);
    expect(ghoPositions.find(p => p.side === 'borrow')?.walletValue).toBe(9674);
    expect(ghoPositions.find(p => p.side === 'supply')?.walletValue).toBeNull();
  });

  it('keeps both sides when wallet already has both', () => {
    const { result } = renderHook(() => usePortfolioSimulation());
    act(() => { result.current.actions.setActive(true); });

    act(() => {
      result.current.actions.importPositions([
        makeWalletPos({ reserveId: 'r-usdt0', tokenSymbol: 'USDT0', side: 'supply', amount: '10000', walletValue: 10000 }),
        makeWalletPos({ reserveId: 'r-usdt0', tokenSymbol: 'USDT0', side: 'borrow', amount: '5000', walletValue: 5000 }),
      ]);
    });

    const usdt0Positions = result.current.positions.filter(p => p.reserveId === 'r-usdt0');
    expect(usdt0Positions).toHaveLength(2);
    expect(usdt0Positions.find(p => p.side === 'supply')?.walletValue).toBe(10000);
    expect(usdt0Positions.find(p => p.side === 'borrow')?.walletValue).toBe(5000);
  });

  it('handles multiple reserves with different side combinations', () => {
    const { result } = renderHook(() => usePortfolioSimulation());
    act(() => { result.current.actions.setActive(true); });

    act(() => {
      result.current.actions.importPositions([
        makeWalletPos({ reserveId: 'r-weth', tokenSymbol: 'WETH', side: 'supply', amount: '1000', walletValue: 1000 }),
        makeWalletPos({ reserveId: 'r-gho', tokenSymbol: 'GHO', side: 'borrow', amount: '2000', walletValue: 2000 }),
      ]);
    });

    expect(result.current.positions).toHaveLength(4);
    const wethSupply = result.current.positions.find(p => p.reserveId === 'r-weth' && p.side === 'supply');
    const wethBorrow = result.current.positions.find(p => p.reserveId === 'r-weth' && p.side === 'borrow');
    const ghoSupply = result.current.positions.find(p => p.reserveId === 'r-gho' && p.side === 'supply');
    const ghoBorrow = result.current.positions.find(p => p.reserveId === 'r-gho' && p.side === 'borrow');
    expect(wethSupply?.walletValue).toBe(1000);
    expect(wethBorrow?.walletValue).toBeNull();
    expect(ghoBorrow?.walletValue).toBe(2000);
    expect(ghoSupply?.walletValue).toBeNull();
  });
});
