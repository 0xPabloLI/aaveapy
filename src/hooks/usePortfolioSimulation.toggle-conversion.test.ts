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
