import { test } from '@playwright/test';

import {
  crossReserveScenarios,
  hasScenarios,
  runCrossReserveScenario,
  runSelfLoopScenario,
  scenarioGate,
  selfLoopScenarios,
  stub,
} from './portfolio-cross-reserve-offset.helpers';
import { installMarketsStubRoutes } from './stubRoutes';
import { enforceEmptyListGate } from './test-reserves';

/**
 * Cross-reserve Merkl offset — portfolio simulation (desktop table).
 *
 * Dynamically discovers reserves with a Merkl netPositionConstraint from the
 * staging API at module load time, then verifies that adding an offset borrow
 * position reduces the target reserve's supply incentive (the data-after
 * attribute on the incentive cell).
 *
 * Two scenario types:
 * - cross-reserve: target supply + different offset reserve borrow
 * - self-loop: same reserve supply + borrow (looping offset)
 *
 * Assertions are behavioural and DIMENSIONLESS (AAV-1333): every scenario
 * carries a `plan` derived by discovery from the same numbers the app clamps
 * with (supply room, borrow room, LTV, campaign cap). The runner types the
 * plan's amounts verbatim and asserts the measured FRACTIONAL decrease is at
 * least `expectedDecreaseRatio × 0.9` — so an APY cell, a multi-campaign
 * display, an APR/APY toggle, or a room-clamped gross can no longer turn a
 * hand-picked constant into a false red. The rung that is expected to floor
 * the eligible position at 0 additionally asserts the cell reads ~0.
 *
 * AAV-1395: desktop-only file. `playwright.config.ts` ignores it in the mobile
 * project, so the tests are never collected-then-skipped per platform.
 */

test.describe('Cross-reserve Merkl offset — portfolio simulation', () => {
  test.describe('desktop', () => {
    if (!hasScenarios) {
      // AAV-1352: fail when staging was unreachable, skip only on a data gap.
      test('staging discovery did not yield cross-offset scenarios', () => {
        enforceEmptyListGate(scenarioGate);
      });
    }

    for (const s of crossReserveScenarios) {
      test(`cross-reserve: ${s.targetSymbol} [${s.targetMarketLabel}] gross $${s.plan.targetSupplyUsd} offset by ${s.offsetSymbol} borrow`, async ({
        page,
      }) => {
        await runCrossReserveScenario(page, s, false);
      });
    }

    for (const s of selfLoopScenarios) {
      test(`self-loop: ${s.targetSymbol} [${s.targetMarketLabel}] gross $${s.plan.targetSupplyUsd} offset by own borrow`, async ({
        page,
      }) => {
        await runSelfLoopScenario(page, s, false);
      });
    }

    // Synthetic cross-reserve payload (AAV-1333/AAV-1395) — never gated on
    // staging data: the fixture is committed, so the cross-reserve ladder
    // executes in CI and locally even though staging carries zero
    // netPositionConstraint campaigns.
    test(`cross-reserve stub: ${stub.scenario.targetSymbol} gross $${stub.scenario.plan.targetSupplyUsd} offset by ${stub.scenario.offsetSymbol} borrow`, async ({
      page,
    }) => {
      await installMarketsStubRoutes(page, stub.payload);
      await runCrossReserveScenario(page, stub.scenario, false);
    });
  });
});
