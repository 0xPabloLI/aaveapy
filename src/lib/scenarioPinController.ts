export interface ScenarioPinControllerState {
  baselineReady: boolean;
  lastScenarioKey: string | null;
  lastHasScenarioInput: boolean;
  lastSortedIds: string[];
  pendingScenarioPin: {
    scenarioKey: string;
    reserveId: string;
    baselineSortedIds: string[];
  } | null;
}

export interface ScenarioPinControllerInput {
  scenarioKey: string;
  sortedIds: string[];
  expandedReserveId: string | null;
  hasScenarioInput: boolean;
  expandScrollFollowsScenarioSort: boolean;
  hasRequiredVisibleCount: boolean;
  isExpandedStillVisible: boolean;
}

export interface ScenarioPinControllerResult {
  nextState: ScenarioPinControllerState;
  shouldSchedulePin: boolean;
  pinReserveId: string | null;
}

export function createScenarioPinControllerState(): ScenarioPinControllerState {
  return {
    baselineReady: false,
    lastScenarioKey: null,
    lastHasScenarioInput: false,
    lastSortedIds: [],
    pendingScenarioPin: null,
  };
}

/**
 * Structured trace of a controller transition. Emitted through
 * `scenarioPinDebugSink` in dev builds so we can reconstruct why a pin
 * did/didn't fire without adding console spam to production bundles.
 */
export interface ScenarioPinControllerTrace {
  phase: 'baseline' | 'transition';
  scenarioChanged: boolean;
  hasRequiredVisibleCount: boolean;
  isExpandedStillVisible: boolean;
  sortedIds: string[];
  pendingBefore: ScenarioPinControllerState['pendingScenarioPin'];
  pendingAfter: ScenarioPinControllerState['pendingScenarioPin'];
  shouldSchedulePin: boolean;
  pinReserveId: string | null;
}

export type ScenarioPinDebugSink = (trace: ScenarioPinControllerTrace) => void;

let scenarioPinDebugSink: ScenarioPinDebugSink | null = null;

/** Register (or clear with `null`) a dev-time trace sink. Not called in prod. */
export function setScenarioPinDebugSink(sink: ScenarioPinDebugSink | null): void {
  scenarioPinDebugSink = sink;
}

export function transitionScenarioPinController(
  state: ScenarioPinControllerState,
  input: ScenarioPinControllerInput,
): ScenarioPinControllerResult {
  const pendingBefore = state.pendingScenarioPin;
  if (!state.baselineReady) {
    const result: ScenarioPinControllerResult = {
      nextState: {
        baselineReady: true,
        lastScenarioKey: input.scenarioKey,
        lastHasScenarioInput: input.hasScenarioInput,
        lastSortedIds: input.sortedIds,
        pendingScenarioPin: null,
      },
      shouldSchedulePin: false,
      pinReserveId: null,
    };
    scenarioPinDebugSink?.({
      phase: 'baseline',
      scenarioChanged: false,
      hasRequiredVisibleCount: input.hasRequiredVisibleCount,
      isExpandedStillVisible: input.isExpandedStillVisible,
      sortedIds: input.sortedIds,
      pendingBefore,
      pendingAfter: null,
      shouldSchedulePin: false,
      pinReserveId: null,
    });
    return result;
  }

  const scenarioChanged = input.scenarioKey !== state.lastScenarioKey;
  let pendingScenarioPin = state.pendingScenarioPin;

  if (scenarioChanged) {
    const shouldFollowScenarioPin =
      input.expandScrollFollowsScenarioSort ||
      (state.lastHasScenarioInput && !input.hasScenarioInput);
    if (shouldFollowScenarioPin && input.expandedReserveId) {
      pendingScenarioPin = {
        scenarioKey: input.scenarioKey,
        reserveId: input.expandedReserveId,
        baselineSortedIds: state.lastSortedIds,
      };
    } else {
      pendingScenarioPin = null;
    }
  }

  let shouldSchedulePin = false;
  let pinReserveId: string | null = null;

  if (pendingScenarioPin) {
    const orderChangedForPending =
      input.sortedIds.length !== pendingScenarioPin.baselineSortedIds.length ||
      input.sortedIds.some((id, index) => id !== pendingScenarioPin.baselineSortedIds[index]);
    const expandedMatches = input.expandedReserveId === pendingScenarioPin.reserveId;
    const canSchedule =
      pendingScenarioPin.scenarioKey === input.scenarioKey &&
      orderChangedForPending &&
      expandedMatches &&
      input.isExpandedStillVisible &&
      input.hasRequiredVisibleCount;
    if (canSchedule) {
      shouldSchedulePin = true;
      pinReserveId = pendingScenarioPin.reserveId;
      pendingScenarioPin = null;
    } else if (
      pendingScenarioPin.scenarioKey !== input.scenarioKey ||
      !expandedMatches ||
      !input.isExpandedStillVisible
    ) {
      pendingScenarioPin = null;
    }
  }

  const result: ScenarioPinControllerResult = {
    nextState: {
      baselineReady: true,
      lastScenarioKey: input.scenarioKey,
      lastHasScenarioInput: input.hasScenarioInput,
      lastSortedIds: input.sortedIds,
      pendingScenarioPin,
    },
    shouldSchedulePin,
    pinReserveId,
  };
  scenarioPinDebugSink?.({
    phase: 'transition',
    scenarioChanged,
    hasRequiredVisibleCount: input.hasRequiredVisibleCount,
    isExpandedStillVisible: input.isExpandedStillVisible,
    sortedIds: input.sortedIds,
    pendingBefore,
    pendingAfter: pendingScenarioPin,
    shouldSchedulePin,
    pinReserveId,
  });
  return result;
}
