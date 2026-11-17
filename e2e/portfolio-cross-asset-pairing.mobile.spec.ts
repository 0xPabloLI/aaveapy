import { expect, test } from '@playwright/test';

import { addReserveToPortfolio, enforceEmptyListGate, setupPortfolioMode } from './test-reserves';

import {
  hasScenarios,
  installStubRoutes,
  liveScenarioGate,
  runCrossAssetPairingScenario,
  scenarios,
  stubSameSymbolPayload,
  stubSameSymbolScenario,
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
      // AAV-1352: fail when staging was unreachable, skip only on a data gap.
      test('staging discovery did not yield cross-asset pairing scenarios', () => {
        enforceEmptyListGate(liveScenarioGate);
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

    // AAV-1317: same-symbol variant — see the desktop twin for rationale.
    // On mobile the helper must also switch the card to the right side tab
    // before the input even exists in the DOM.
    test(`cross-asset same-symbol stub: ${stubSameSymbolScenario.sourceSymbol} [${stubSameSymbolScenario.sourceMarketLabel}] ${stubSameSymbolScenario.sourceSide} paired with ${stubSameSymbolScenario.pairedSymbol} [${stubSameSymbolScenario.pairedMarketLabel}] ${stubSameSymbolScenario.pairedSide} (×${stubSameSymbolScenario.discountFactor})`, async ({
      page,
    }) => {
      await installStubRoutes(page, stubSameSymbolPayload);
      await runCrossAssetPairingScenario(page, stubSameSymbolScenario, true, { expectZeroBaseline: true });
    });

    // AAV-1317: explicit-failure contract for the Add flow — see desktop twin.
    test('same-symbol Add flow: no market-label match fails explicitly (AAV-1317)', async ({ page }) => {
      await installStubRoutes(page, stubSameSymbolPayload);
      await setupPortfolioMode(page);
      const added = await addReserveToPortfolio(page, stubSameSymbolScenario.sourceSymbol, 'No Such Market Label');
      expect(added, 'Two WETH candidates and no label match ⇒ explicit false, not a silent .first()').toBe(false);
    });
  });
});
