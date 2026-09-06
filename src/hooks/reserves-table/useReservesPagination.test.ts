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

  describe('scenario-driven reorder keeps expanded row rendered', () => {
    it('grows the window when a pure reorder (same id set) moves the expanded row past it', () => {
      const initial = makeReserves(50);
      const expandedSimId = initial[8].reserveId;
      const { result, rerender } = renderHook(
        ({ data }: { data: ReserveWithSpread[] }) =>
          useReservesPagination({ sortedData: data, expandedReserveId: expandedSimId }),
        { initialProps: { data: initial } },
      );
      // Expanded at index 8 → needed 14 ≤ DEFAULT_VISIBLE_COUNT → default window.
      expect(result.current.minVisibleCount).toBeNull();

      // Simulate a live-rate re-sort: same id set, order changed, expanded row
      // lands at index 30 — past the default 20-row window.
      const reordered = [...initial];
      const [moved] = reordered.splice(8, 1);
      reordered.splice(30, 0, moved);
      rerender({ data: reordered });

      expect(result.current.minVisibleCount).toBe(36); // 30 + 6 buffer, clamped to list length
      expect(
        result.current.displayData.some((r) => r.reserveId === expandedSimId),
        'expanded row must stay rendered after a scenario-driven reorder',
      ).toBe(true);
    });

    it('does not churn the window when a pure reorder keeps the row inside it', () => {
      const initial = makeReserves(50);
      const expandedSimId = initial[8].reserveId;
      const { result, rerender } = renderHook(
        ({ data }: { data: ReserveWithSpread[] }) =>
          useReservesPagination({ sortedData: data, expandedReserveId: expandedSimId }),
        { initialProps: { data: initial } },
      );
      expect(result.current.minVisibleCount).toBeNull();

      const reordered = [...initial];
      const [moved] = reordered.splice(8, 1);
      reordered.splice(12, 0, moved); // index 12 → needed 18 ≤ 20 → still inside window
      rerender({ data: reordered });

      expect(result.current.minVisibleCount).toBeNull();
      expect(
        result.current.displayData.some((r) => r.reserveId === expandedSimId),
      ).toBe(true);
    });

    it('does not grow the window when the id set changes (filter path, AAV-1107)', () => {
      const initial = makeReserves(50);
      const expandedSimId = initial[8].reserveId;
      const { result, rerender } = renderHook(
        ({ data }: { data: ReserveWithSpread[] }) =>
          useReservesPagination({ sortedData: data, expandedReserveId: expandedSimId }),
        { initialProps: { data: initial } },
      );
      expect(result.current.minVisibleCount).toBeNull();

      // Filtered dataset: same length but entirely different reserves — the
      // expanded id no longer exists. Dataset membership changed, so the
      // reorder-grow path must stay off (AAV-1107: stale spacer).
      const filtered = Array.from({ length: 50 }, (_, i) => makeReserve(100 + i));
      rerender({ data: filtered });

      expect(result.current.minVisibleCount).toBeNull();
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

  describe('significant data change resets pagination (AAV-1107)', () => {
    it('resets minVisibleCount to null when sortedData grows significantly (filter removed)', () => {
      // Simulate: 30 reserves (Celo filter), expand row 25 (past DEFAULT_VISIBLE_COUNT),
      // then remove filter → 200 reserves. Auto-grow fired on expand (31 > 20),
      // but after data change it should reset.
      const smallData = makeReserves(30);
      const expandedSimId = smallData[25].reserveId;
      const { result, rerender } = renderHook(
        ({ data, expandedId }: { data: ReserveWithSpread[]; expandedId: string | null }) =>
          useReservesPagination({ sortedData: data, expandedReserveId: expandedId }),
        { initialProps: { data: smallData, expandedId: null } },
      );

      // Expand row 25 → auto-grow fires (25+6=31 > DEFAULT_VISIBLE_COUNT=20)
      rerender({ data: smallData, expandedId: expandedSimId });
      expect(result.current.minVisibleCount).toBe(30); // capped to 30 (only 30 reserves)

      // Remove filter → 200 reserves (significant change: 30 → 200)
      const bigData = makeReserves(200);
      // Keep expandedId the same — expansion is preserved across filter changes
      rerender({ data: bigData, expandedId: expandedSimId });

      // minVisibleCount should be reset to null (default 20)
      expect(result.current.minVisibleCount).toBeNull();
      expect(result.current.displayData).toHaveLength(DEFAULT_VISIBLE_COUNT);
    });

    it('resets minVisibleCount when sortedData shrinks significantly (filter applied)', () => {
      const bigData = makeReserves(100);
      const { result, rerender } = renderHook(
        ({ data }: { data: ReserveWithSpread[] }) =>
          useReservesPagination({ sortedData: data, expandedReserveId: null }),
        { initialProps: { data: bigData } },
      );

      // Show all → minVisibleCount = 100
      act(() => result.current.showAllRows());
      expect(result.current.minVisibleCount).toBe(100);

      // Apply filter → 5 reserves (significant change: 100 → 5)
      const smallData = makeReserves(5);
      rerender({ data: smallData });
      expect(result.current.minVisibleCount).toBeNull();
      expect(result.current.displayData).toHaveLength(5); // only 5 reserves
    });

    it('does NOT reset minVisibleCount on small data changes (data refresh)', () => {
      const data = makeReserves(50);
      const { result, rerender } = renderHook(
        ({ d }: { d: ReserveWithSpread[] }) =>
          useReservesPagination({ sortedData: d, expandedReserveId: null }),
        { initialProps: { d: data } },
      );

      // Show all → minVisibleCount = 50
      act(() => result.current.showAllRows());
      expect(result.current.minVisibleCount).toBe(50);

      // Small change: 50 → 52 (within threshold, should NOT reset)
      const refreshed = makeReserves(52);
      rerender({ d: refreshed });
      expect(result.current.minVisibleCount).toBe(50); // preserved
    });

    it('does NOT auto-grow minVisibleCount when sortedData changes under existing expansion', () => {
      // AAV-1107 core scenario: expand in a filtered view (30 reserves, row 25),
      // then unfilter to 80 reserves. Auto-grow should NOT re-fire because
      // expandedReserveId didn't change.
      const smallData = makeReserves(30);
      const expandedSimId = smallData[25].reserveId; // index 25
      const { result, rerender } = renderHook(
        ({ data, expandedId }: { data: ReserveWithSpread[]; expandedId: string | null }) =>
          useReservesPagination({ sortedData: data, expandedReserveId: expandedId }),
        { initialProps: { data: smallData, expandedId: null } },
      );

      // Expand row 25 → auto-grow fires (25+6=31 > 20)
      rerender({ data: smallData, expandedId: expandedSimId });
      expect(result.current.minVisibleCount).toBe(30); // capped to 30 (only 30 reserves)

      // Remove filter → 80 reserves. expandedReserveId is PRESERVED (same value).
      // The expanded row is now at index 25 in a list of 80 — past the first 20.
      // minVisibleCount should reset (significant data change), and auto-grow
      // should NOT re-fire (expandedReserveId didn't change).
      const bigData = makeReserves(80);
      // Overwrite index 25's reserveId to match the expanded id
      (bigData[25] as { reserveId: string }).reserveId = expandedSimId;
      rerender({ data: bigData, expandedId: expandedSimId });

      // minVisibleCount should be reset to null (significant data change 30→80)
      expect(result.current.minVisibleCount).toBeNull();
      // displayData should be the default 20 (not grown to 31)
      expect(result.current.displayData).toHaveLength(DEFAULT_VISIBLE_COUNT);
      // The expanded row (index 25) is NOT in displayData (past first 20)
      // This means renderedExpandedReserveId will be null → no scroll spacer
    });
  });
});
