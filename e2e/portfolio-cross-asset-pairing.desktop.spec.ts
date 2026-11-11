import { test } from '@playwright/test';

import {
  hasScenarios,
  installStubRoutes,
  runCrossAssetPairingScenario,
  scenarios,
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
 * Two variants per platform:
 * - live: scenarios discovered from staging data (skips when staging carries no
 *   crossAssetPairing campaign, which has been the case since launch).
 * - stub: the committed fixture (AAV-1316) — always executes.
 */

test.describe('Cross-asset pairing (min(1,2)) — portfolio simulation (AAV-895)', () => {
  // ── Desktop (live staging data) ─────────────────────────────────

  test.describe('desktop', () => {
    if (!hasScenarios) {
      test('no cross-asset pairing scenarios found in staging data', () => {
        test.skip(true, 'No crossAssetPairing campaigns found in current staging data');
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
  });
});
