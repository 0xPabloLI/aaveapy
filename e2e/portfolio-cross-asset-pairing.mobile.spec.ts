import { test } from '@playwright/test';

import {
  hasScenarios,
  installStubRoutes,
  runCrossAssetPairingScenario,
  scenarios,
  stubScenario,
} from './portfolio-cross-asset-pairing.helpers';

/**
 * Cross-asset pairing (min(1,2)) — mobile card variant (AAV-895).
 *
 * Bound to the `mobile-chromium` project by FILE, through
 * `playwright.config.ts`'s `chromium.testIgnore`, not by `test.skip(project)`.
 * See the desktop twin for the full rationale; the fixture, route stub and
 * runner they share live in `./portfolio-cross-asset-pairing.helpers`.
 */

test.describe('Cross-asset pairing (min(1,2)) — portfolio simulation (AAV-895)', () => {
  // ── Mobile (live staging data) ──────────────────────────────────

  test.describe('mobile', () => {
    if (!hasScenarios) {
      test('no cross-asset pairing scenarios found in staging data', () => {
        test.skip(true, 'No crossAssetPairing campaigns found in current staging data');
      });
    }

    for (const s of scenarios) {
      test(`cross-asset: ${s.sourceSymbol} [${s.sourceMarketLabel}] ${s.sourceSide} paired with ${s.pairedSymbol} ${s.pairedSide} (×${s.discountFactor})`, async ({
        page,
      }) => {
        await runCrossAssetPairingScenario(page, s, true);
      });
    }
  });

  // ── Mobile stub variant (AAV-1316) ──────────────────────────────
  // Never gated on staging data: the fixture is committed, so this runs in CI
  // and locally regardless of what real campaigns exist today.

  test.describe('stub mobile', () => {
    test(`cross-asset stub: ${stubScenario.sourceSymbol} [${stubScenario.sourceMarketLabel}] ${stubScenario.sourceSide} paired with ${stubScenario.pairedSymbol} ${stubScenario.pairedSide} (×${stubScenario.discountFactor})`, async ({
      page,
    }) => {
      await installStubRoutes(page);
      await runCrossAssetPairingScenario(page, stubScenario, true, { expectZeroBaseline: true });
    });
  });
});
