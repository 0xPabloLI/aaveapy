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
 * Cross-reserve Merkl offset — portfolio simulation (mobile cards).
 *
 * Same discovery + plan contract as the desktop half; the runner switches the
 * fill helpers and the incentive reader to the mobile card shape.
 *
 * AAV-1395: mobile-only file. `playwright.config.ts` ignores it in the desktop
 * project, so the tests are never collected-then-skipped per platform.
 */

test.describe('Cross-reserve Merkl offset — portfolio simulation', () => {
  test.describe('mobile', () => {
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
        await runCrossReserveScenario(page, s, true);
      });
    }

    for (const s of selfLoopScenarios) {
      test(`self-loop: ${s.targetSymbol} [${s.targetMarketLabel}] gross $${s.plan.targetSupplyUsd} offset by own borrow`, async ({
        page,
      }) => {
        await runSelfLoopScenario(page, s, true);
      });
    }

    test(`cross-reserve stub: ${stub.scenario.targetSymbol} gross $${stub.scenario.plan.targetSupplyUsd} offset by ${stub.scenario.offsetSymbol} borrow`, async ({
      page,
    }) => {
      await installMarketsStubRoutes(page, stub.payload);
      await runCrossReserveScenario(page, stub.scenario, true);
    });
  });
});
