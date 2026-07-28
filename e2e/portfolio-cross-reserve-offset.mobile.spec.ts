import { test } from '@playwright/test';
import {
  crossReserveScenarios,
  selfLoopScenarios,
  hasScenarios,
  runCrossReserveScenario,
  runSelfLoopScenario,
} from './helpers/cross-offset-setup';

/**
 * Cross-reserve Merkl offset — portfolio simulation E2E (Mobile).
 *
 * Mobile-only — routed via `*.mobile.spec.ts` glob in playwright.config.ts.
 */

test.describe('Cross-reserve Merkl offset — portfolio simulation', () => {
  test.describe('mobile', () => {
    if (!hasScenarios) {
      test('no cross-offset scenarios found in staging data', () => {
        test.skip('No cross-offset Merkl campaigns found in current staging data');
      });
    }

    for (const s of crossReserveScenarios) {
      test(
        `cross-reserve: ${s.targetSymbol} [${s.targetMarketLabel}] supply offset by ${s.offsetSymbol} borrow`,
        async ({ page }) => {
          await runCrossReserveScenario(page, s, true);
        },
      );
    }

    for (const s of selfLoopScenarios) {
      test(
        `self-loop: ${s.targetSymbol} [${s.targetMarketLabel}] supply offset by own borrow`,
        async ({ page }) => {
          await runSelfLoopScenario(page, s, true);
        },
      );
    }
  });
});
