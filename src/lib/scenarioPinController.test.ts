import { describe, expect, it } from 'vitest';
import {
  createScenarioPinControllerState,
  transitionScenarioPinController,
  type ScenarioPinControllerState,
} from './scenarioPinController';

function step(
  state: ScenarioPinControllerState,
  input: Parameters<typeof transitionScenarioPinController>[1],
) {
  return transitionScenarioPinController(state, input);
}

describe('scenario pin controller', () => {
  it('schedules pin on each scenario debounce update that reorders list', () => {
    let state = createScenarioPinControllerState();

    const baseline = step(state, {
      scenarioKey: '100\0',
      sortedIds: ['a', 'b', 'c'],
      expandedReserveId: 'b',
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    });
    state = baseline.nextState;
    expect(baseline.shouldSchedulePin).toBe(false);

    const firstReorder = step(state, {
      scenarioKey: '200\0',
      sortedIds: ['b', 'a', 'c'],
      expandedReserveId: 'b',
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    });
    state = firstReorder.nextState;
    expect(firstReorder.shouldSchedulePin).toBe(true);
    expect(firstReorder.pinReserveId).toBe('b');

    const secondReorder = step(state, {
      scenarioKey: '300\0',
      sortedIds: ['a', 'c', 'b'],
      expandedReserveId: 'b',
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    });
    expect(secondReorder.shouldSchedulePin).toBe(true);
    expect(secondReorder.pinReserveId).toBe('b');
  });

  it('does not schedule pin when scenario changed but list order did not change', () => {
    let state = createScenarioPinControllerState();
    state = step(state, {
      scenarioKey: '100\0',
      sortedIds: ['a', 'b', 'c'],
      expandedReserveId: 'b',
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    }).nextState;

    const result = step(state, {
      scenarioKey: '101\0',
      sortedIds: ['a', 'b', 'c'],
      expandedReserveId: 'b',
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    });
    expect(result.shouldSchedulePin).toBe(false);
    expect(result.pinReserveId).toBeNull();
  });

  it('waits for visible-count buffer before scheduling pin for a reorder update', () => {
    let state = createScenarioPinControllerState();
    state = step(state, {
      scenarioKey: '100\0',
      sortedIds: ['a', 'b', 'c'],
      expandedReserveId: 'b',
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    }).nextState;

    const waitResult = step(state, {
      scenarioKey: '200\0',
      sortedIds: ['b', 'a', 'c'],
      expandedReserveId: 'b',
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: false,
      isExpandedStillVisible: true,
    });
    state = waitResult.nextState;
    expect(waitResult.shouldSchedulePin).toBe(false);

    const scheduleAfterBuffer = step(state, {
      scenarioKey: '200\0',
      sortedIds: ['b', 'a', 'c'],
      expandedReserveId: 'b',
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    });
    expect(scheduleAfterBuffer.shouldSchedulePin).toBe(true);
    expect(scheduleAfterBuffer.pinReserveId).toBe('b');
  });
});
