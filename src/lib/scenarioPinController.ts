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

export function transitionScenarioPinController(
  state: ScenarioPinControllerState,
  input: ScenarioPinControllerInput,
): ScenarioPinControllerResult {
  if (!state.baselineReady) {
    return {
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

  return {
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
}
