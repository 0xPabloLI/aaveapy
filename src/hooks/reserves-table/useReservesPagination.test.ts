// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DEFAULT_VISIBLE_COUNT, useReservesPagination } from './useReservesPagination';
import type { ReserveWithSpread } from '@/types/aave';

/**
 * Build a minimal `ReserveWithSpread` skeleton with stable identifiers — only
 * the fields read by the pagination hook (`reserveId`, plus enough metadata
 * for `getReserveKey` / `getReserveSimulationId`) need to be populated.
 */
function makeReserve(index: number): ReserveWithSpread {
  return {
    reserveId: `reserve-${index}`,
    chainName: 'mainnet',
    marketName: 'core',
    underlyingAsset: `0x${index.toString(16).padStart(40, '0')}`,
  } as unknown as ReserveWithSpread;
}

function makeReserves(count: number): ReserveWithSpread[] {
  return Array.from({ length: count }, (_, i) => makeReserve(i));
}

describe('useReservesPagination', () => {
  describe('default windowing', () => {
    it('caps displayData to DEFAULT_VISIBLE_COUNT and reports showAll=false when more rows exist', () => {
      const sortedData = makeReserves(50);
      const { result } = renderHook(() =>
        useReservesPagination({ sortedData, expandedReserveId: null }),
      );

      expect(result.current.displayData).toHaveLength(DEFAULT_VISIBLE_COUNT);
      expect(result.current.displayData[0]).toBe(sortedData[0]);
      expect(result.current.displayData[DEFAULT_VISIBLE_COUNT - 1]).toBe(
        sortedData[DEFAULT_VISIBLE_COUNT - 1],
      );
      expect(result.current.showAll).toBe(false);
      expect(result.current.minVisibleCount).toBeNull();
      expect(result.current.defaultVisibleCount).toBe(DEFAULT_VISIBLE_COUNT);
    });

    it('returns the raw list reference (no slice) when sortedData is already smaller than the default window', () => {
      const sortedData = makeReserves(5);
      const { result } = renderHook(() =>
        useReservesPagination({ sortedData, expandedReserveId: null }),
      );

      expect(result.current.displayData).toBe(sortedData);
      expect(result.current.showAll).toBe(false); // showAll requires explicit "Show all" click
    });
  });

  describe('showAllRows / resetVisibleCount', () => {
    it('showAllRows reveals every row and flips showAll to true', () => {
      const sortedData = makeReserves(50);
      const { result } = renderHook(() =>
        useReservesPagination({ sortedData, expandedReserveId: null }),
      );

      act(() => result.current.showAllRows());

      expect(result.current.displayData).toHaveLength(50);
      expect(result.current.showAll).toBe(true);
      expect(result.current.minVisibleCount).toBe(50);
    });

    it('resetVisibleCount returns to the default window', () => {
      const sortedData = makeReserves(50);
      const { result } = renderHook(() =>
        useReservesPagination({ sortedData, expandedReserveId: null }),
      );

      act(() => result.current.showAllRows());
      expect(result.current.minVisibleCount).toBe(50);

      act(() => result.current.resetVisibleCount());
      expect(result.current.minVisibleCount).toBeNull();
      expect(result.current.displayData).toHaveLength(DEFAULT_VISIBLE_COUNT);
      expect(result.current.showAll).toBe(false);
    });

    it('showAllRows on an empty list is a no-op (minVisibleCount stays null)', () => {
      const { result } = renderHook(() =>
        useReservesPagination({ sortedData: [], expandedReserveId: null }),
      );

      act(() => result.current.showAllRows());
      expect(result.current.minVisibleCount).toBeNull();
      expect(result.current.showAll).toBe(false);
    });
  });

  describe('scrollToReserveId auto-expansion', () => {
    it('grows minVisibleCount to targetIndex+6 when the target sits past the default window', () => {
      const sortedData = makeReserves(50);
      // Target at index 30 → needs at least 36 visible rows.
      const targetReserveId = sortedData[30].reserveId;
      const { result } = renderHook(() =>
        useReservesPagination({
          sortedData,
          expandedReserveId: null,
          scrollToReserveId: targetReserveId,
        }),
      );

      expect(result.current.minVisibleCount).toBe(36);
      expect(result.current.displayData).toHaveLength(36);
    });

    it('does not shrink the window if the target already fits inside DEFAULT_VISIBLE_COUNT', () => {
      const sortedData = makeReserves(50);
      const targetReserveId = sortedData[3].reserveId;
      const { result } = renderHook(() =>
        useReservesPagination({
          sortedData,
          expandedReserveId: null,
          scrollToReserveId: targetReserveId,
        }),
      );

      // Target is at index 3; default window already covers it. minVisibleCount stays null.
      expect(result.current.minVisibleCount).toBeNull();
      expect(result.current.displayData).toHaveLength(DEFAULT_VISIBLE_COUNT);
    });
  });

  describe('expandedReserveId auto-expansion', () => {
    it('grows the window to expandedIndex+6 when the row is past DEFAULT_VISIBLE_COUNT', () => {
      const sortedData = makeReserves(50);
      // Use the simulation id of the row at index 25 → needs at least 31 visible.
      const expandedSimId = sortedData[25].reserveId;
      const { result } = renderHook(() =>
        useReservesPagination({ sortedData, expandedReserveId: expandedSimId }),
      );

      expect(result.current.minVisibleCount).toBe(31);
    });

    it('keeps the grown window after the row collapses (persistence)', () => {
      const sortedData = makeReserves(50);
      const expandedSimId = sortedData[25].reserveId;
      const { result, rerender } = renderHook(
        ({ expandedReserveId }: { expandedReserveId: string | null }) =>
          useReservesPagination({ sortedData, expandedReserveId }),
        { initialProps: { expandedReserveId: expandedSimId } },
      );

      expect(result.current.minVisibleCount).toBe(31);
      rerender({ expandedReserveId: null });
      expect(result.current.minVisibleCount).toBe(31); // persisted
    });
  });

  describe('empty-list reset', () => {
    it('clears a stale minVisibleCount when sortedData drops to empty', () => {
      const sortedData = makeReserves(50);
      const { result, rerender } = renderHook(
        ({ data }: { data: ReserveWithSpread[] }) =>
          useReservesPagination({ sortedData: data, expandedReserveId: null }),
        { initialProps: { data: sortedData } },
      );

      act(() => result.current.showAllRows());
      expect(result.current.minVisibleCount).toBe(50);

      rerender({ data: [] });
      expect(result.current.minVisibleCount).toBeNull();
      expect(result.current.displayData).toEqual([]);
      expect(result.current.showAll).toBe(false);
    });
  });
});
