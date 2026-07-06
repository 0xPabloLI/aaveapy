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
      hasScenarioInput: true,
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
      hasScenarioInput: true,
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
      hasScenarioInput: true,
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
      hasScenarioInput: true,
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    }).nextState;

    const result = step(state, {
      scenarioKey: '101\0',
      sortedIds: ['a', 'b', 'c'],
      expandedReserveId: 'b',
      hasScenarioInput: true,
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
      hasScenarioInput: true,
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    }).nextState;

    const waitResult = step(state, {
      scenarioKey: '200\0',
      sortedIds: ['b', 'a', 'c'],
      expandedReserveId: 'b',
      hasScenarioInput: true,
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
      hasScenarioInput: true,
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    });
    expect(scheduleAfterBuffer.shouldSchedulePin).toBe(true);
    expect(scheduleAfterBuffer.pinReserveId).toBe('b');
  });

  it('waits for delayed reorder after scenario change and then schedules pin', () => {
    let state = createScenarioPinControllerState();
    state = step(state, {
      scenarioKey: '100\0',
      sortedIds: ['a', 'b', 'c'],
      expandedReserveId: 'b',
      hasScenarioInput: true,
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    }).nextState;

    const changedNoReorder = step(state, {
      scenarioKey: '200\0',
      sortedIds: ['a', 'b', 'c'],
      expandedReserveId: 'b',
      hasScenarioInput: true,
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    });
    state = changedNoReorder.nextState;
    expect(changedNoReorder.shouldSchedulePin).toBe(false);

    const delayedReorder = step(state, {
      scenarioKey: '200\0',
      sortedIds: ['b', 'a', 'c'],
      expandedReserveId: 'b',
      hasScenarioInput: true,
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    });
    expect(delayedReorder.shouldSchedulePin).toBe(true);
    expect(delayedReorder.pinReserveId).toBe('b');
  });

  it('keeps pin inactive when scenario input is cleared to empty without reordering', () => {
    let state = createScenarioPinControllerState();
    const scenarioWithInput = ['100', '', 'usd', '1'].join('\0');
    const scenarioCleared = ['', '', 'usd', '1'].join('\0');
    state = step(state, {
      scenarioKey: scenarioWithInput,
      sortedIds: ['a', 'b', 'c'],
      expandedReserveId: 'b',
      hasScenarioInput: true,
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    }).nextState;

    const cleared = step(state, {
      scenarioKey: scenarioCleared,
      sortedIds: ['a', 'b', 'c'],
      expandedReserveId: 'b',
      hasScenarioInput: false,
      expandScrollFollowsScenarioSort: false,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    });
    expect(cleared.shouldSchedulePin).toBe(false);
    expect(cleared.pinReserveId).toBeNull();
  });

  it('schedules pin when scenario input is cleared to empty and list reorders', () => {
    let state = createScenarioPinControllerState();
    const scenarioWithInput = ['100', '', 'usd', '1'].join('\0');
    const scenarioCleared = ['', '', 'usd', '1'].join('\0');
    state = step(state, {
      scenarioKey: scenarioWithInput,
      sortedIds: ['a', 'b', 'c'],
      expandedReserveId: 'b',
      hasScenarioInput: true,
      expandScrollFollowsScenarioSort: true,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    }).nextState;

    const cleared = step(state, {
      scenarioKey: scenarioCleared,
      sortedIds: ['b', 'a', 'c'],
      expandedReserveId: 'b',
      hasScenarioInput: false,
      expandScrollFollowsScenarioSort: false,
      hasRequiredVisibleCount: true,
      isExpandedStillVisible: true,
    });
    expect(cleared.shouldSchedulePin).toBe(true);
    expect(cleared.pinReserveId).toBe('b');
  });

  /**
   * Regression: Shared Scenario 下用户在 debounce 窗口内连打第二次输入，
   * 触发下面这条时序，pin 会被静默丢弃：
   *
   *   t0: baseline scenario=100, ids=[a,b,c], 展开 b（visible-count 满足）
   *   t1: 第一次输入 debounce commit → scenario=200，列表已重排为 [b,a,c]，
   *       但 b 在 pagination 窗口边界外（`hasRequiredVisibleCount=false`），
   *       controller 记下 pending{ baseline=[a,b,c], key=200 }，本轮不 schedule。
   *   t2: 用户在 buffer 未解之前再次改动输入 → scenario=300，此时列表快照
   *       已经是 [b,a,c]，`state.lastSortedIds` 也已更新为 [b,a,c]。
   *       scenarioChanged=true 触发 pending 重建，baseline 被覆盖为 [b,a,c]。
   *   t3: visible-count buffer 解开（`hasRequiredVisibleCount=true`），
   *       scenarioKey 稳定在 300，sortedIds 仍为 [b,a,c]。
   *       此时 orderChangedForPending 用 [b,a,c] vs [b,a,c] → false → pin 丢失。
   *
   * 用户主观感受：连打两次输入后，展开行没有 pin 到 sticky 栏下方；
   * 只打一次时正常。语义上 b 相对于「用户上次看到的顺序 [a,b,c]」已经上移，
   * 修复后 t3 应当 schedule pin。当前实现无法感知这个「跨输入的累积重排」，
   * 所以本用例目前预期失败（`it.fails`），fix 落地后应改回 `it`。
   */
  it.fails(
    'preserves pin across rapid scenario inputs when reorder is buffered by visible-count window',
    () => {
      let state = createScenarioPinControllerState();

      // t0: baseline
      state = step(state, {
        scenarioKey: '100\0',
        sortedIds: ['a', 'b', 'c'],
        expandedReserveId: 'b',
        hasScenarioInput: true,
        expandScrollFollowsScenarioSort: true,
        hasRequiredVisibleCount: true,
        isExpandedStillVisible: true,
      }).nextState;

      // t1: 第一次输入 commit，列表重排但 visible-count buffer 未满
      const firstInput = step(state, {
        scenarioKey: '200\0',
        sortedIds: ['b', 'a', 'c'],
        expandedReserveId: 'b',
        hasScenarioInput: true,
        expandScrollFollowsScenarioSort: true,
        hasRequiredVisibleCount: false,
        isExpandedStillVisible: true,
      });
      state = firstInput.nextState;
      expect(firstInput.shouldSchedulePin).toBe(false);

      // t2: 用户在 buffer 未解之前再次改输入 —— 列表快照已是 t1 的重排结果
      const secondInput = step(state, {
        scenarioKey: '300\0',
        sortedIds: ['b', 'a', 'c'],
        expandedReserveId: 'b',
        hasScenarioInput: true,
        expandScrollFollowsScenarioSort: true,
        hasRequiredVisibleCount: false,
        isExpandedStillVisible: true,
      });
      state = secondInput.nextState;
      expect(secondInput.shouldSchedulePin).toBe(false);

      // t3: visible-count buffer 解开，scenarioKey 稳定，顺序未再变。
      // 期望：pin 依然 schedule（跨输入的累积重排 [a,b,c] → [b,a,c]）。
      // 现状：pending baseline 已被 t2 覆盖为 [b,a,c]，orderChangedForPending=false，
      // 因此本断言当前失败——这正是 root cause #2 的物理复现。
      const bufferResolved = step(state, {
        scenarioKey: '300\0',
        sortedIds: ['b', 'a', 'c'],
        expandedReserveId: 'b',
        hasScenarioInput: true,
        expandScrollFollowsScenarioSort: true,
        hasRequiredVisibleCount: true,
        isExpandedStillVisible: true,
      });
      expect(bufferResolved.shouldSchedulePin).toBe(true);
      expect(bufferResolved.pinReserveId).toBe('b');
    },
  );
});

