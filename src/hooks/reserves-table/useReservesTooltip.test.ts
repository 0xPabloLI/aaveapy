// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useReservesTooltip } from './useReservesTooltip';
import type { ReserveWithSpread } from '@/types/aave';

const makeReserve = (overrides: Partial<ReserveWithSpread> = {}): ReserveWithSpread =>
  ({
    reserveId: 'r-1',
    tokenSymbol: 'WETH',
    tokenAddress: '0xabc',
    marketName: 'Ethereum-Core',
    ...overrides,
  }) as ReserveWithSpread;

const makeMouseEvent = (rect: Partial<DOMRect> = {}) => {
  const fullRect: DOMRect = {
    top: 10,
    bottom: 30,
    left: 100,
    right: 200,
    width: 100,
    height: 20,
    x: 100,
    y: 10,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect;
  const stopPropagation = vi.fn();
  const event = {
    stopPropagation,
    currentTarget: { getBoundingClientRect: () => fullRect },
  } as unknown as React.MouseEvent;
  return { event, stopPropagation, fullRect };
};

describe('useReservesTooltip', () => {
  it('starts with no tooltip state', () => {
    const { result } = renderHook(() => useReservesTooltip());
    expect(result.current.tooltipState).toBeNull();
  });

  it('opens the tooltip with trigger geometry on incentive click', () => {
    const { result } = renderHook(() => useReservesTooltip());
    const reserve = makeReserve();
    const { event, stopPropagation, fullRect } = makeMouseEvent();

    act(() => result.current.handleIncentiveClick(event, reserve, 'supply', 4.5));

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    const state = result.current.tooltipState;
    expect(state).not.toBeNull();
    expect(state?.reserve).toBe(reserve);
    expect(state?.type).toBe('supply');
    expect(state?.position).toEqual({ x: fullRect.left, y: fullRect.bottom });
    expect(state?.triggerCenterX).toBe(fullRect.left + fullRect.width / 2);
    expect(state?.triggerHeight).toBe(fullRect.height);
    expect(state?.triggerRect).toEqual({
      top: fullRect.top,
      bottom: fullRect.bottom,
      left: fullRect.left,
      right: fullRect.right,
      width: fullRect.width,
      height: fullRect.height,
    });
  });

  it('still stops propagation but does not open the tooltip when apy is null', () => {
    const { result } = renderHook(() => useReservesTooltip());
    const { event, stopPropagation } = makeMouseEvent();

    act(() => result.current.handleIncentiveClick(event, makeReserve(), 'supply', null));

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(result.current.tooltipState).toBeNull();
  });

  it('still stops propagation but does not open the tooltip when apy is NaN', () => {
    const { result } = renderHook(() => useReservesTooltip());
    const { event, stopPropagation } = makeMouseEvent();

    act(() => result.current.handleIncentiveClick(event, makeReserve(), 'borrow', Number.NaN));

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(result.current.tooltipState).toBeNull();
  });

  it('records borrow type independently from supply', () => {
    const { result } = renderHook(() => useReservesTooltip());
    const { event } = makeMouseEvent();

    act(() => result.current.handleIncentiveClick(event, makeReserve(), 'borrow', 1.2));

    expect(result.current.tooltipState?.type).toBe('borrow');
  });

  it('closeTooltip clears the state', () => {
    const { result } = renderHook(() => useReservesTooltip());
    const { event } = makeMouseEvent();

    act(() => result.current.handleIncentiveClick(event, makeReserve(), 'supply', 4));
    expect(result.current.tooltipState).not.toBeNull();

    act(() => result.current.closeTooltip());
    expect(result.current.tooltipState).toBeNull();
  });

  it('setTooltipState allows direct replacement', () => {
    const { result } = renderHook(() => useReservesTooltip());

    act(() =>
      result.current.setTooltipState({
        reserve: makeReserve({ reserveId: 'r-2' }),
        type: 'supply',
        position: { x: 0, y: 0 },
        triggerCenterX: 0,
        triggerHeight: 0,
        triggerRect: { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 },
      }),
    );

    expect(result.current.tooltipState?.reserve.reserveId).toBe('r-2');
  });

  it('handler identity is stable across renders', () => {
    const { result, rerender } = renderHook(() => useReservesTooltip());
    const firstHandler = result.current.handleIncentiveClick;
    const firstClose = result.current.closeTooltip;
    rerender();
    expect(result.current.handleIncentiveClick).toBe(firstHandler);
    expect(result.current.closeTooltip).toBe(firstClose);
  });
});
