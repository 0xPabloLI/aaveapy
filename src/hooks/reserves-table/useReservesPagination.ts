import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ReserveWithSpread } from '@/types/aave';
import { getReserveKey } from '@/lib/reserveKey';
import { getReserveSimulationId } from '@/lib/rateSimulationCalculator';

/** Default number of rows shown before the user opts into "Show all". */
export const DEFAULT_VISIBLE_COUNT = 20;

interface UseReservesPaginationOptions {
  /** Reserve list after sorting; pagination is a slice off this. */
  sortedData: ReserveWithSpread[];
  /**
   * Optional reserve identifier (matched via `getReserveKey`) the table
   * should auto-expand to. When supplied, `minVisibleCount` grows so the
   * target row is rendered together with a 5-row trailing buffer.
   */
  scrollToReserveId?: string | null;
  /**
   * Currently expanded reserve simulation id (matched via
   * `getReserveSimulationId`). When set, `minVisibleCount` grows so the
   * expanded row remains rendered together with a 5-row buffer — even
   * after the row collapses.
   */
  expandedReserveId: string | null;
}

export interface UseReservesPaginationResult {
  /** `sortedData` capped at the active visible-count window. */
  displayData: ReserveWithSpread[];
  /** True when every row of `sortedData` is currently rendered. */
  showAll: boolean;
  /**
   * Latest user-visible count. `null` means "fall back to
   * `DEFAULT_VISIBLE_COUNT`". Exposed so the host can feed it back into
   * effects that need to reason about how much of the list is rendered
   * (e.g. the scenario-pin scroll controller).
   */
  minVisibleCount: number | null;
  /** Constant pass-through so callers can render "Show N more" affordances. */
  defaultVisibleCount: number;
  /** Reveal every row in `sortedData` (no-op when the list is empty). */
  showAllRows: () => void;
  /** Collapse back to `DEFAULT_VISIBLE_COUNT`. */
  resetVisibleCount: () => void;
}

/**
 * Owns the "Show more / Show less" pagination window for the reserves
 * table along with the two implicit auto-expansion behaviours that
 * originally lived inline in `ReservesTable`:
 *
 * 1. When an external `scrollToReserveId` is provided, grow the window
 *    so the target row is rendered (target index + 5 buffer rows).
 * 2. When a row is expanded, grow the window so the expanded row stays
 *    visible — and keep the new size even if it collapses.
 *
 * Also resets `minVisibleCount` to `null` whenever `sortedData` empties
 * out, so a stale "Show less" state never survives a filter wipe.
 */
export function useReservesPagination(
  { sortedData, scrollToReserveId, expandedReserveId }: UseReservesPaginationOptions,
): UseReservesPaginationResult {
  const [minVisibleCount, setMinVisibleCount] = useState<number | null>(null);

  // Auto-expand to target reserve + 5 rows buffer when scrolling to a specific reserve.
  useEffect(() => {
    if (scrollToReserveId) {
      const targetIndex = sortedData.findIndex(
        (r) => getReserveKey(r) === scrollToReserveId,
      );
      if (targetIndex >= 0) {
        const neededCount = targetIndex + 6; // target row + 5 buffer rows
        if (neededCount > DEFAULT_VISIBLE_COUNT) {
          setMinVisibleCount(neededCount);
        }
      }
    }
  }, [scrollToReserveId, sortedData]);

  // Reset minVisibleCount when sortedData becomes empty to avoid stale "Show Less" state.
  useEffect(() => {
    if (sortedData.length === 0 && minVisibleCount !== null) {
      setMinVisibleCount(null);
    }
  }, [sortedData.length, minVisibleCount]);

  // Reset minVisibleCount when the dataset changes significantly (e.g., filter
  // applied/removed). This prevents stale pagination from keeping the scroll
  // spacer alive when the expanded row is no longer near the bottom of the
  // visible window (AAV-1107).
  const prevDataLengthRef = useRef(sortedData.length);
  useEffect(() => {
    const prev = prevDataLengthRef.current;
    const curr = sortedData.length;
    if (prev === curr) return;
    prevDataLengthRef.current = curr;
    if (minVisibleCount === null) return;
    // Only reset when the dataset changed significantly (> 50% of the larger
    // value). Small changes (data refresh, single reserve added/removed) should
    // not reset the user's pagination state.
    const threshold = Math.max(prev, curr, DEFAULT_VISIBLE_COUNT) * 0.5;
    if (Math.abs(curr - prev) > threshold) {
      setMinVisibleCount(null);
    }
  }, [sortedData.length]); // eslint-disable-line react-hooks/exhaustive-deps -- minVisibleCount read via closure; only re-run on length change

  // Auto-expand visible count when a row is expanded. Only fires on
  // user-initiated expansion (expandedReserveId changes), NOT on data changes
  // under an existing expansion. This prevents the scroll spacer from being
  // rendered after a filter is removed and the expanded row is deep in the
  // full list (AAV-1107).
  const prevExpandedRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevExpandedRef.current;
    prevExpandedRef.current = expandedReserveId;
    // Only auto-grow when expandedReserveId itself changed (user click),
    // not when sortedData changed under an existing expansion.
    if (expandedReserveId === prev || expandedReserveId === null) return;
    const expandedIndex = sortedData.findIndex(
      (r) => getReserveSimulationId(r) === expandedReserveId,
    );
    if (expandedIndex < 0) return;
    const neededCount = expandedIndex + 6; // expanded row + 5 buffer rows
    const currentCount = minVisibleCount ?? DEFAULT_VISIBLE_COUNT;
    if (neededCount > currentCount) {
      const nextCount = Math.min(neededCount, sortedData.length);
      setMinVisibleCount(nextCount > 0 ? nextCount : null);
    }
  }, [expandedReserveId, sortedData, minVisibleCount]);

  // Keep the expanded row rendered across scenario-driven re-sorts. Live rate
  // refreshes and shared-scenario input changes re-order `sortedData` WITHOUT
  // changing which reserves exist. If such a pure reorder moves the expanded
  // row deeper, past the visible window, the row would unmount mid-session
  // and the scenario-pin scroll could never fire — violating the normative
  // contract (docs/design/frontend-interaction-guardrails.md § "Simulation
  // pin scroll": scenario change + reorder + expanded row MUST pin).
  // Dataset changes (id set differs) reset the baseline instead of growing:
  // re-growing there resurrected the scroll spacer for a row the user no
  // longer sees (AAV-1107) — the significant-data-change reset below applies.
  const prevSortedIdSetKeyRef = useRef<string | null>(null);
  const prevExpandedIdRef = useRef<string | null>(null);
  const lastExpandedIndexRef = useRef<number | null>(null);
  useEffect(() => {
    const idSetKey = sortedData
      .map((r) => getReserveSimulationId(r))
      .sort()
      .join('\0');
    const prevKey = prevSortedIdSetKeyRef.current;
    prevSortedIdSetKeyRef.current = idSetKey;
    if (!expandedReserveId) {
      lastExpandedIndexRef.current = null;
      prevExpandedIdRef.current = null;
      return;
    }
    const expandedIndex = sortedData.findIndex(
      (r) => getReserveSimulationId(r) === expandedReserveId,
    );
    if (expandedIndex < 0) {
      lastExpandedIndexRef.current = null;
      prevExpandedIdRef.current = expandedReserveId;
      return;
    }
    const membershipChanged = prevKey === null || prevKey !== idSetKey;
    const expansionChanged = prevExpandedIdRef.current !== expandedReserveId;
    prevExpandedIdRef.current = expandedReserveId;
    if (membershipChanged || expansionChanged || lastExpandedIndexRef.current === null) {
      // Baseline (re)seeding: first observation, a dataset change, or a new
      // expansion. The click-grow effect owns those paths — record and wait.
      lastExpandedIndexRef.current = expandedIndex;
      return;
    }
    if (expandedIndex <= lastExpandedIndexRef.current) return; // moved shallower / unchanged
    lastExpandedIndexRef.current = expandedIndex;
    const neededCount = expandedIndex + 6; // expanded row + 5 buffer rows
    const currentCount = minVisibleCount ?? DEFAULT_VISIBLE_COUNT;
    if (neededCount <= currentCount) return;
    setMinVisibleCount(Math.min(neededCount, sortedData.length));
  }, [sortedData, expandedReserveId, minVisibleCount]);

  const displayData = useMemo(() => {
    const baseCount = minVisibleCount != null && minVisibleCount > 0
      ? minVisibleCount
      : DEFAULT_VISIBLE_COUNT;
    if (baseCount >= sortedData.length) return sortedData;
    return sortedData.slice(0, baseCount);
  }, [sortedData, minVisibleCount]);

  const showAll =
    sortedData.length > 0 && minVisibleCount !== null && minVisibleCount >= sortedData.length;

  const showAllRows = useCallback(() => {
    setMinVisibleCount(sortedData.length > 0 ? sortedData.length : null);
  }, [sortedData.length]);

  const resetVisibleCount = useCallback(() => {
    setMinVisibleCount(null);
  }, []);

  return {
    displayData,
    showAll,
    minVisibleCount,
    defaultVisibleCount: DEFAULT_VISIBLE_COUNT,
    showAllRows,
    resetVisibleCount,
  };
}
