import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import type { ReserveWithSpread } from '@/types/aave';
import { getReserveSimulationId } from '@/lib/rateSimulationCalculator';
import type { ScenarioInputMode } from '@/components/dashboard/ScenarioControls';
import {
  createScenarioPinControllerState,
  transitionScenarioPinController,
} from '@/lib/scenarioPinController';
import {
  scrollExpandedSimulationIntoView,
  shouldScrollExpandedSimulationIntoView,
} from '@/lib/scrollExpandedSimulationIntoView';

interface ScenarioKeyInputs {
  supplyInput: string;
  borrowInput: string;
  inputMode: ScenarioInputMode;
  meritMerklNetPosition: boolean;
}

interface UseScenarioPinScrollOptions {
  reserves: ReserveWithSpread[];
  sortedData: ReserveWithSpread[];
  isMobile: boolean;
  expandedReserveId: string | null;
  setExpandedReserveId: Dispatch<SetStateAction<string | null>>;
  /** Latest "visible row count" from pagination; `null` = fall back to `defaultVisibleCount`. */
  minVisibleCount: number | null;
  /** Pagination's default cap (typically `DEFAULT_VISIBLE_COUNT`). */
  defaultVisibleCount: number;
  /** True when any scenario input is non-empty. */
  hasSharedScenario: boolean;
  /** True when the active sort column reads scenario values (and thus list order can change on input). */
  expandScrollFollowsScenarioSort: boolean;
  scenarioKey: ScenarioKeyInputs;
}

export interface SchedulePinScrollOpts {
  instant?: boolean;
  onSettled?: () => void;
}

export interface UseScenarioPinScrollResult {
  /**
   * Imperatively schedule a pin-scroll to the row identified by
   * `reserveId`. Returns a cancel function. Caller is responsible for
   * storing it (the hook already wires this internally for the
   * simulation / filter pin effects).
   */
  schedulePinScrollToReserve: (
    reserveId: string,
    delayMs: number,
    opts?: SchedulePinScrollOpts,
  ) => (() => void) | null | undefined;
  /**
   * Click handler for the market chip on a reserve row. Stages the
   * filter-pin-target ref so the upcoming `reserves` change keeps the
   * row in view, *but only if the row is already expanded* — clicking a
   * market chip never implicitly expands a collapsed row.
   */
  handleMarketChipClick: (reserveId: string) => void;
}

/**
 * Owns the pin-scroll subsystem of the reserves table — both the
 * scenario-driven pin (re-pins the expanded row whenever scenario inputs
 * shift the list order) and the filter-driven pin (re-pins after a
 * `reserves`-set change such as a market filter).
 *
 * **High-risk area**: behaviour here is constrained by
 * `docs/design/frontend-interaction-guardrails.md` § "Simulation pin
 * scroll". Do not change semantics — only relocate code.
 */
export function useScenarioPinScroll(
  {
    reserves,
    sortedData,
    isMobile,
    expandedReserveId,
    setExpandedReserveId,
    minVisibleCount,
    defaultVisibleCount,
    hasSharedScenario,
    expandScrollFollowsScenarioSort,
    scenarioKey,
  }: UseScenarioPinScrollOptions,
): UseScenarioPinScrollResult {
  const scenarioPinControllerRef = useRef(createScenarioPinControllerState());
  const scenarioPinScheduleTokenRef = useRef(0);
  const cancelScenarioPinScrollRef = useRef<(() => void) | null>(null);
  const lastReservesKeyForFilterPinRef = useRef<string | null>(null);
  const cancelFilterPinScrollRef = useRef<(() => void) | null>(null);
  const pendingMarketFilterPinReserveIdRef = useRef<string | null>(null);

  const schedulePinScrollToReserve = useCallback(
    (reserveId: string, delayMs: number, opts?: SchedulePinScrollOpts) => {
      const mode = isMobile ? 'minimal-if-clipped' : 'pin-main-row-top';
      const instant = opts?.instant ?? false;
      const escapeId = (raw: string) =>
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(raw) : raw;
      const escapedId = escapeId(reserveId);

      let cancelled = false;
      let attempt = 0;
      const maxAttempts = 12;
      const retryMs = 70;
      let finalized = false;

      const finalizeAttempt = () => {
        if (finalized) return;
        finalized = true;
        opts?.onSettled?.();
      };

      const runAttempt = () => {
        if (cancelled) return;
        const anchor = document.querySelector(`[data-reserve-expanded-anchor="${escapedId}"]`);
        const row = document.querySelector(`tr[data-reserve-id="${escapedId}"]`);
        if (anchor instanceof HTMLElement || row instanceof HTMLElement) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (cancelled) return;
              // Keep pin-scroll deterministic: one primary pass + at most one
              // follow-up correction after layout settles. Repeated corrections
              // create visible "stair-step" jank on long pages.
              if (!shouldScrollExpandedSimulationIntoView(reserveId, { mode })) {
                finalizeAttempt();
                return;
              }
              scrollExpandedSimulationIntoView(reserveId, {
                mode,
                instant,
              });
              finalizeAttempt();
            });
          });
          return;
        }
        attempt += 1;
        if (attempt >= maxAttempts) {
          finalizeAttempt();
          return;
        }
        window.setTimeout(runAttempt, retryMs);
      };

      const starter = window.setTimeout(runAttempt, delayMs);
      return () => {
        cancelled = true;
        window.clearTimeout(starter);
        finalizeAttempt();
      };
    },
    [isMobile],
  );

  /**
   * Simulation pin scroll — normative spec + implementation steps:
   * `docs/design/frontend-interaction-guardrails.md` § "Simulation pin scroll".
   * Do not move to `expandedReserveId`-only effects or index-based scroll without updating that doc.
   */
  useEffect(() => {
    const { supplyInput, borrowInput, inputMode, meritMerklNetPosition } = scenarioKey;
    const composedKey = `${supplyInput}\0${borrowInput}\0${inputMode}\0${meritMerklNetPosition ? '1' : '0'}`;
    const ids = sortedData.map((r) => getReserveSimulationId(r));
    const expandedIndex = expandedReserveId
      ? sortedData.findIndex((r) => getReserveSimulationId(r) === expandedReserveId)
      : -1;
    const currentCount = minVisibleCount ?? defaultVisibleCount;
    const requiredCount =
      expandedIndex >= 0 ? Math.min(expandedIndex + 6, sortedData.length) : 0;
    const hasRequiredVisibleCount =
      expandedIndex >= 0 ? currentCount >= requiredCount : false;

    const controllerResult = transitionScenarioPinController(
      scenarioPinControllerRef.current,
      {
        scenarioKey: composedKey,
        sortedIds: ids,
        expandedReserveId,
        hasScenarioInput: hasSharedScenario,
        expandScrollFollowsScenarioSort,
        hasRequiredVisibleCount,
        isExpandedStillVisible: expandedIndex >= 0,
      },
    );
    scenarioPinControllerRef.current = controllerResult.nextState;

    if (!controllerResult.shouldSchedulePin || !controllerResult.pinReserveId) return;

    cancelFilterPinScrollRef.current?.();
    cancelFilterPinScrollRef.current = null;
    cancelScenarioPinScrollRef.current?.();
    const scheduleToken = scenarioPinScheduleTokenRef.current + 1;
    scenarioPinScheduleTokenRef.current = scheduleToken;
    cancelScenarioPinScrollRef.current = schedulePinScrollToReserve(
      controllerResult.pinReserveId,
      320,
      {
        // Keep first pass smooth; follow-up corrections (if any) remain instant.
        instant: false,
        onSettled: () => {
          if (scenarioPinScheduleTokenRef.current !== scheduleToken) return;
          cancelScenarioPinScrollRef.current = null;
        },
      },
    ) ?? null;
  }, [
    scenarioKey,
    sortedData,
    expandedReserveId,
    minVisibleCount,
    defaultVisibleCount,
    hasSharedScenario,
    expandScrollFollowsScenarioSort,
    schedulePinScrollToReserve,
  ]);

  // Filter pin scroll — re-pin the anchor row when the `reserves` set
  // changes (e.g., a market filter is applied / removed).
  useEffect(() => {
    const reservesKey = reserves.map((r) => getReserveSimulationId(r)).join('\0');
    if (lastReservesKeyForFilterPinRef.current === null) {
      lastReservesKeyForFilterPinRef.current = reservesKey;
      return;
    }
    if (reservesKey === lastReservesKeyForFilterPinRef.current) return;
    lastReservesKeyForFilterPinRef.current = reservesKey;

    const targetReserveId = pendingMarketFilterPinReserveIdRef.current ?? expandedReserveId;
    if (!targetReserveId) return;
    const stillVisible = sortedData.some((r) => getReserveSimulationId(r) === targetReserveId);
    if (!stillVisible) {
      pendingMarketFilterPinReserveIdRef.current = null;
      return;
    }

    pendingMarketFilterPinReserveIdRef.current = null;
    // Cancel any prior scheduled pin so filter-driven pin is the only jump.
    // Store the cancel fn in a ref so that unrelated sortedData changes
    // (which re-run this effect but bail at the reservesKey guard) do
    // not invoke effect cleanup and cancel the pending scroll.
    cancelScenarioPinScrollRef.current?.();
    cancelScenarioPinScrollRef.current = null;
    cancelFilterPinScrollRef.current?.();
    cancelFilterPinScrollRef.current = schedulePinScrollToReserve(targetReserveId, 280, { instant: true }) ?? null;
  }, [reserves, sortedData, expandedReserveId, schedulePinScrollToReserve]);

  // Unmount cleanup — cancel both in-flight pin schedules.
  useEffect(() => {
    return () => {
      cancelFilterPinScrollRef.current?.();
      cancelScenarioPinScrollRef.current?.();
    };
  }, []);

  // When expansion drops to null the filter-pin staging target is no
  // longer meaningful — clear it so a future market chip click starts fresh.
  useEffect(() => {
    if (!expandedReserveId) {
      pendingMarketFilterPinReserveIdRef.current = null;
    }
  }, [expandedReserveId]);

  const handleMarketChipClick = useCallback(
    (reserveId: string) => {
      // Preserve an already-expanded row across filter updates, but do not
      // implicitly expand a collapsed row just because its market chip was clicked.
      // The chip stops propagation, so row expansion stays an explicit action.
      const shouldKeepExpanded = expandedReserveId === reserveId;
      pendingMarketFilterPinReserveIdRef.current = shouldKeepExpanded ? reserveId : null;
      if (shouldKeepExpanded) {
        setExpandedReserveId(reserveId);
      }
    },
    [expandedReserveId, setExpandedReserveId],
  );

  return {
    schedulePinScrollToReserve,
    handleMarketChipClick,
  };
}
