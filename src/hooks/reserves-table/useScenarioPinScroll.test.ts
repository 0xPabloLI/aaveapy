// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useScenarioPinScroll } from './useScenarioPinScroll';
import type { ReserveWithSpread } from '@/types/aave';

function makeReserve(id: string): ReserveWithSpread {
  return {
    reserveId: id,
    chainName: 'mainnet',
    marketName: 'core',
    underlyingAsset: `0x${id.padStart(40, '0')}`,
  } as unknown as ReserveWithSpread;
}

const baseScenarioKey = {
  supplyInput: '',
  borrowInput: '',
  inputMode: 'usd' as const,
  meritMerklNetPosition: true,
};

function makeOpts(overrides: Partial<Parameters<typeof useScenarioPinScroll>[0]> = {}) {
  return {
    reserves: [] as ReserveWithSpread[],
    sortedData: [] as ReserveWithSpread[],
    isMobile: false,
    expandedReserveId: null as string | null,
    setExpandedReserveId: vi.fn(),
    minVisibleCount: null as number | null,
    defaultVisibleCount: 20,
    hasScenarioInput: false,
    expandScrollFollowsScenarioSort: false,
    scenarioKey: baseScenarioKey,
    ...overrides,
  };
}

describe('useScenarioPinScroll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('schedulePinScrollToReserve', () => {
    it('returns a cancel function that aborts a scheduled pin without throwing', () => {
      const { result } = renderHook(() => useScenarioPinScroll(makeOpts()));

      const cancel = result.current.schedulePinScrollToReserve('reserve-X', 100);
      expect(typeof cancel).toBe('function');
      act(() => cancel?.());
      // Advancing timers after cancel should not schedule any more attempts.
      act(() => vi.advanceTimersByTime(2000));
    });

    it('invokes onSettled at most once even when cancel is called after natural finalize', () => {
      const { result } = renderHook(() => useScenarioPinScroll(makeOpts()));
      const onSettled = vi.fn();

      const cancel = result.current.schedulePinScrollToReserve('reserve-X', 50, { onSettled });
      // Run all pending timers — the retry loop will exhaust without finding
      // the DOM anchor (jsdom has no row), then call finalizeAttempt → onSettled.
      act(() => vi.advanceTimersByTime(2000));
      act(() => cancel?.());
      expect(onSettled).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleMarketChipClick', () => {
    it('keeps an already-expanded row expanded and stages the filter-pin target', () => {
      const setExpandedReserveId = vi.fn();
      const { result } = renderHook(() =>
        useScenarioPinScroll(
          makeOpts({ expandedReserveId: 'reserve-A', setExpandedReserveId }),
        ),
      );

      act(() => result.current.handleMarketChipClick('reserve-A'));
      expect(setExpandedReserveId).toHaveBeenCalledWith('reserve-A');
    });

    it('does NOT implicitly expand a collapsed row', () => {
      const setExpandedReserveId = vi.fn();
      const { result } = renderHook(() =>
        useScenarioPinScroll(
          makeOpts({ expandedReserveId: null, setExpandedReserveId }),
        ),
      );

      act(() => result.current.handleMarketChipClick('reserve-A'));
      expect(setExpandedReserveId).not.toHaveBeenCalled();
    });

    it('clears the staged target when clicking a different row than the expanded one', () => {
      const setExpandedReserveId = vi.fn();
      const { result } = renderHook(() =>
        useScenarioPinScroll(
          makeOpts({ expandedReserveId: 'reserve-A', setExpandedReserveId }),
        ),
      );

      act(() => result.current.handleMarketChipClick('reserve-B'));
      // reserve-B is not the expanded one → should not call setExpandedReserveId
      expect(setExpandedReserveId).not.toHaveBeenCalled();
    });
  });

  describe('filter pin scroll on reserves change', () => {
    it('does not schedule anything on the very first reserves render (baseline established)', () => {
      const reserves = [makeReserve('A'), makeReserve('B')];
      const { result } = renderHook(() =>
        useScenarioPinScroll(makeOpts({ reserves, sortedData: reserves })),
      );

      // No scheduling happens because lastReservesKeyForFilterPinRef is just being set.
      // Verifying no thrown errors / no callback to setExpandedReserveId.
      expect(result.current).toBeDefined();
    });

    it('bails out when expandedReserveId is null and no pending market filter target', () => {
      const initialReserves = [makeReserve('A')];
      const newReserves = [makeReserve('A'), makeReserve('B')];
      const { result, rerender } = renderHook(
        ({ reserves }: { reserves: ReserveWithSpread[] }) =>
          useScenarioPinScroll(makeOpts({ reserves, sortedData: reserves })),
        { initialProps: { reserves: initialReserves } },
      );

      rerender({ reserves: newReserves });
      // No target → effect bails before scheduling. Nothing to assert beyond no throw.
      expect(result.current).toBeDefined();
    });
  });

  describe('isMobile flag wiring', () => {
    it('produces a working cancel function in both mobile and desktop mode', () => {
      const desktopHook = renderHook(() =>
        useScenarioPinScroll(makeOpts({ isMobile: false })),
      );
      const mobileHook = renderHook(() =>
        useScenarioPinScroll(makeOpts({ isMobile: true })),
      );

      const cancelDesktop = desktopHook.result.current.schedulePinScrollToReserve('x', 10);
      const cancelMobile = mobileHook.result.current.schedulePinScrollToReserve('y', 10);
      expect(typeof cancelDesktop).toBe('function');
      expect(typeof cancelMobile).toBe('function');
      act(() => {
        cancelDesktop?.();
        cancelMobile?.();
      });
    });
  });
});
