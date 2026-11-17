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
 * Cross-asset pairing (min(1,2)) — desktop table variant (AAV-895).
 *
 * Bound to the `chromium` project by FILE, through `playwright.config.ts`'s
 * `mobile-chromium.testIgnore`, not by `test.skip(project)`. A platform rename
 * therefore cannot silently turn these variants into skips — the anti-pattern
 * AGENTS.md (Coding Conventions) forbids. The mobile twin lives in
 * `portfolio-cross-asset-pairing.mobile.spec.ts`; the fixture, route stub and
 * runner they share live in `./portfolio-cross-asset-pairing.helpers`.
 *
 * Three variants per platform:
 * - live: scenarios discovered from staging data (skips when staging carries no
 *   crossAssetPairing campaign, which has been the case since launch).
 * - stub: the committed fixture (AAV-1316) — always executes.
 * - same-symbol stub (AAV-1317): WETH×WETH across Celo/Base — the pair class
 *   the pre-AAV-1317 symbol-based fills could not serve; the runner's
 *   row-ownership assertions make a wrong-row fill fail by name.
 */

test.describe('Cross-asset pairing (min(1,2)) — portfolio simulation (AAV-895)', () => {
  // ── Desktop (live staging data) ─────────────────────────────────

  test.describe('desktop', () => {
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
        await runCrossAssetPairingScenario(page, s, false);
      });
    }
  });

  // ── Desktop stub variant (AAV-1316) ─────────────────────────────
  // Never gated on staging data: the fixture is committed, so this runs in CI
  // and locally regardless of what real campaigns exist today.

  test.describe('stub desktop', () => {
    test(`cross-asset stub: ${stubScenario.sourceSymbol} [${stubScenario.sourceMarketLabel}] ${stubScenario.sourceSide} paired with ${stubScenario.pairedSymbol} ${stubScenario.pairedSide} (×${stubScenario.discountFactor})`, async ({
      page,
    }) => {
      await installStubRoutes(page);
      await runCrossAssetPairingScenario(page, stubScenario, false, { expectZeroBaseline: true });
    });

    // AAV-1317: the same-symbol variant. Both rows render "WETH", so a
    // symbol-based fill types into the first row; the runner asserts the
    // SOURCE row keeps 1,000 while the PAIRED row holds each ladder step.
    test(`cross-asset same-symbol stub: ${stubSameSymbolScenario.sourceSymbol} [${stubSameSymbolScenario.sourceMarketLabel}] ${stubSameSymbolScenario.sourceSide} paired with ${stubSameSymbolScenario.pairedSymbol} [${stubSameSymbolScenario.pairedMarketLabel}] ${stubSameSymbolScenario.pairedSide} (×${stubSameSymbolScenario.discountFactor})`, async ({
      page,
    }) => {
      await installStubRoutes(page, stubSameSymbolPayload);
      await runCrossAssetPairingScenario(page, stubSameSymbolScenario, false, { expectZeroBaseline: true });
    });

    // AAV-1317: with two same-symbol candidates, a market label that matches
    // neither must fail explicitly — the old `.first()` fallback silently
    // added a possibly-wrong reserve.
    test('same-symbol Add flow: no market-label match fails explicitly (AAV-1317)', async ({ page }) => {
      await installStubRoutes(page, stubSameSymbolPayload);
      await setupPortfolioMode(page);
      const added = await addReserveToPortfolio(page, stubSameSymbolScenario.sourceSymbol, 'No Such Market Label');
      expect(added, 'Two WETH candidates and no label match ⇒ explicit false, not a silent .first()').toBe(false);
    });
  });
});
