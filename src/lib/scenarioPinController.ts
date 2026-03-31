export interface ScenarioPinControllerState {
  baselineReady: boolean;
  lastScenarioKey: string | null;
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
  expandScrollFollowsScenarioSort: boolean;
  hasRequiredVisibleCount: boolean;
  isExpandedStillVisible: boolean;
}

export interface ScenarioPinControllerResult {
  nextState: ScenarioPinControllerState;
  shouldSchedulePin: boolean;
  pinReserveId: string | null;
}

function didOrderChange(prevIds: string[], nextIds: string[]): boolean {
  return prevIds.length !== nextIds.length || prevIds.some((id, index) => id !== nextIds[index]);
}

export function createScenarioPinControllerState(): ScenarioPinControllerState {
  return {
    baselineReady: false,
    lastScenarioKey: null,
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
    if (input.expandScrollFollowsScenarioSort && input.expandedReserveId) {
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
    const orderChangedForPending = didOrderChange(
      pendingScenarioPin.baselineSortedIds,
      input.sortedIds,
    );
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
      lastSortedIds: input.sortedIds,
      pendingScenarioPin,
    },
    shouldSchedulePin,
    pinReserveId,
  };
}
