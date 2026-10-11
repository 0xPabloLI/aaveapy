import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  AAV1316_STUB_INJECTION,
  CROSS_ASSET_PAIRING_FIXTURE_URL,
  buildCrossAssetPairingStub,
} from './crossAssetPairingStub';
import { discoverCrossAssetPairingScenarios, type CrossAssetScenario } from './reserveDiscovery';
import {
  addReserveToPortfolio,
  fetchStagingReserves,
  fillBorrowAmountDesktop,
  fillBorrowAmountMobile,
  fillSupplyAmount,
  readIncentiveAfter,
  setupPortfolioMode,
} from './test-reserves';

/**
 * Cross-asset pairing (min(1,2)) — E2E test for AAV-895.
 *
 * Merkl min(1,2) opportunities (e.g. "Borrow ETH using cbETH as collateral")
 * reward users based on min(sourcePos, pairedPos × discountFactor), NOT the
 * full position. This test verifies that the frontend correctly applies this
 * formula in portfolio simulation mode.
 *
 * Test flow:
 * 1. Discover reserves with crossAssetPairing from staging API
 * 2. Add source reserve to portfolio with a borrow/supply position
 * 3. Read baseline incentive (without paired asset)
 * 4. Add paired reserve with supply/borrow position
 * 5. Verify incentive changes proportionally to min() formula
 *
 * Scenario selection lives in ./reserveDiscovery (AAV-1308): both rate sides
 * are scanned and each group is gated by the UI's own render gates
 * (computable campaign, position room, LTV funding), so a selected scenario
 * always renders a numeric incentive and never a clamped position — the two
 * ways this spec could otherwise go quietly false-green. Self-pairings and
 * same-symbol pairs are excluded because the fill helpers type into inputs
 * located by token symbol. Unit-tested in src/test/reserveDiscovery.test.ts.
 *
 * If no crossAssetPairing campaigns are found in staging data, all tests skip.
 * Desktop + mobile variants are generated from the same scenario list.
 *
 * AAV-1316 stub variant: because staging has never carried a crossAssetPairing
 * campaign, the live tests above have never actually executed. The `stub`
 * describes below inject a synthetic pairing into a committed real-payload
 * fixture, serve it through page.route (the app validates the payload with the
 * same schema as a live response), and run the SAME runner — proving the
 * min(1,2) chain (baseline 0 → ladder → clamp) is reachable end to end,
 * hermetically (no real network), in CI and locally. The scenario is selected
 * by the real discovery gates on the injected payload
 * (e2e/crossAssetPairingStub.ts, unit-tested in
 * src/test/crossAssetPairingStub.test.ts).
 */

// Discover at module load (top-level await — Playwright supports ESM TLA).
// API base comes from the shared env-resolving fetcher; CI sets
// VITE_API_BASE_URL to bypass Cloudflare/WAF 403s on the staging host.
const allScenarios: CrossAssetScenario[] = discoverCrossAssetPairingScenarios(
  await fetchStagingReserves(),
  new Date().toISOString(),
);
// Limit to top 2 scenarios to keep CI runtime reasonable
const scenarios = allScenarios.slice(0, 2);
const hasScenarios = scenarios.length > 0;

// ─── Stub variant (AAV-1316) ─────────────────────────────────────

// Built once at module load from the committed fixture. A throw here is a
// fixture/injection bug and fails the whole file loudly on purpose — the stub
// variant exists to replace silent skips with real executions (SY3/SY4).
const stub = buildCrossAssetPairingStub(
  JSON.parse(readFileSync(CROSS_ASSET_PAIRING_FIXTURE_URL, 'utf8')) as unknown,
  AAV1316_STUB_INJECTION,
);
const stubScenario: CrossAssetScenario = stub.scenarios[0];

/**
 * Serve the stub payload to the browser: `/markets` returns the injected
 * payload, `/meta/side-data` a minimal deterministic body (only `generatedAt`
 * is required by the schema; empty forecast/campaignAccess keep the incentive
 * math on the breakdown-APR path instead of forecast-TV recomputation).
 * Pathname matching is host-agnostic on purpose: the app's API base differs
 * between dev (staging host from apiBase.ts) and CI (VITE_API_BASE_URL), and
 * both end in /markets and /meta/side-data.
 */
async function installStubRoutes(page: Page) {
  await page.route(
    (url) => url.pathname.endsWith('/markets'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(stub.payload),
      }),
  );
  await page.route(
    (url) => url.pathname.endsWith('/meta/side-data'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ generatedAt: '2026-01-01T00:00:00.000Z' }),
      }),
  );
}

// ─── Shared Scenario Runner ────────────────────────────────────────

async function runCrossAssetPairingScenario(
  page: Page,
  s: CrossAssetScenario,
  isMobile: boolean,
  opts?: { expectZeroBaseline?: boolean },
) {
  test.setTimeout(180_000);
  await setupPortfolioMode(page);

  // Step 1: Add source reserve with a position on the source side
  // For sourceSide=borrow: add reserve and set borrow amount
  // For sourceSide=supply: add reserve and set supply amount
  const sourceAdded = await addReserveToPortfolio(page, s.sourceSymbol, s.sourceMarketLabel);
  expect(sourceAdded, `Should find and add ${s.sourceSymbol} (${s.sourceMarketLabel})`).toBe(true);

  // If source is borrow, we need to supply first to get borrowing power (LTV clamping)
  if (s.sourceSide === 'borrow') {
    await fillSupplyAmount(page, s.sourceSymbol, '100000');
  }

  // Set source position
  const fillSourcePosition =
    s.sourceSide === 'borrow'
      ? isMobile
        ? (amount: string) => fillBorrowAmountMobile(page, s.sourceReserveId, s.sourceSymbol, amount)
        : (amount: string) => fillBorrowAmountDesktop(page, s.sourceSymbol, amount)
      : (amount: string) => fillSupplyAmount(page, s.sourceSymbol, amount);

  // Use $1000 as source position
  await fillSourcePosition('1000');
  const baselineAfter = await readIncentiveAfter(page, s.sourceReserveId, s.sourceSide, isMobile);

  // Baseline: without paired asset, min(source, 0 × discountFactor) = 0.
  // The live variant only asserts non-NaN (real reserves may carry other
  // incentives); the stub variant's fixture guarantees the injected group is
  // the source reserve's ONLY computable supply-side incentive, so the
  // AAV-1316 acceptance baseline — paired = 0 ⇒ incentive = 0 — is assertable.
  if (opts?.expectZeroBaseline) {
    expect(baselineAfter, 'Stub baseline: no paired position ⇒ zero incentive').toBeCloseTo(0, 6);
  } else {
    expect(baselineAfter, 'Baseline incentive without paired position').not.toBeNaN();
  }

  // Step 2: Add paired reserve with a position on the paired side
  const pairedAdded = await addReserveToPortfolio(page, s.pairedSymbol, s.pairedMarketLabel);
  expect(pairedAdded, `Should find and add ${s.pairedSymbol} (${s.pairedMarketLabel})`).toBe(true);

  // If paired is borrow, need supply for LTV
  if (s.pairedSide === 'borrow') {
    await fillSupplyAmount(page, s.pairedSymbol, '100000');
  }

  const fillPairedPosition =
    s.pairedSide === 'borrow'
      ? isMobile
        ? (amount: string) => fillBorrowAmountMobile(page, s.pairedReserveId, s.pairedSymbol, amount)
        : (amount: string) => fillBorrowAmountDesktop(page, s.pairedSymbol, amount)
      : (amount: string) => fillSupplyAmount(page, s.pairedSymbol, amount);

  // Step 3: Add small paired position ($500)
  // effective = min(1000, 500 × discountFactor)
  // If discountFactor < 2, effective < 1000 → incentive should increase from baseline
  await fillPairedPosition('500');
  const halfPairedAfter = await readIncentiveAfter(page, s.sourceReserveId, s.sourceSide, isMobile);

  // Incentive should be higher than baseline (0 or low) when paired position is added
  expect(halfPairedAfter, 'Incentive should increase when paired position is added').toBeGreaterThan(baselineAfter);

  // Step 4: Increase paired position ($2000) — now source ($1000) is the binding constraint
  // effective = min(1000, 2000 × discountFactor) = 1000 (if discountFactor >= 0.5)
  await fillPairedPosition('2000');
  const fullPairedAfter = await readIncentiveAfter(page, s.sourceReserveId, s.sourceSide, isMobile);

  // With enough paired position, incentive should be at least as high as half-paired
  expect(fullPairedAfter, 'Full paired should not decrease from half paired').toBeGreaterThanOrEqual(
    halfPairedAfter - 0.01,
  );

  // Step 5: Increase paired further ($5000) — should clamp at source position
  await fillPairedPosition('5000');
  const overPairedAfter = await readIncentiveAfter(page, s.sourceReserveId, s.sourceSide, isMobile);

  // Over-paired should not increase beyond full-paired (source is binding)
  expect(
    Math.abs(overPairedAfter - fullPairedAfter),
    'Over-paired should clamp (no further change beyond source binding)',
  ).toBeLessThanOrEqual(0.05);
}

// ─── Tests ─────────────────────────────────────────────────────────

test.describe('Cross-asset pairing (min(1,2)) — portfolio simulation (AAV-895)', () => {
  // ── Desktop ──────────────────────────────────────────────────────

  test.describe('desktop', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop table only');
    });

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

  // ── Mobile ───────────────────────────────────────────────────────

  test.describe('mobile', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile card only');
    });

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

  // ── Stub variant (AAV-1316) ──────────────────────────────────────
  // Never gated on staging data: the fixture is committed, so these run in
  // CI and locally regardless of what real campaigns exist today.

  test.describe('stub desktop', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop table only');
    });

    test(`cross-asset stub: ${stubScenario.sourceSymbol} [${stubScenario.sourceMarketLabel}] ${stubScenario.sourceSide} paired with ${stubScenario.pairedSymbol} ${stubScenario.pairedSide} (×${stubScenario.discountFactor})`, async ({
      page,
    }) => {
      await installStubRoutes(page);
      await runCrossAssetPairingScenario(page, stubScenario, false, { expectZeroBaseline: true });
    });
  });

  test.describe('stub mobile', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile card only');
    });

    test(`cross-asset stub: ${stubScenario.sourceSymbol} [${stubScenario.sourceMarketLabel}] ${stubScenario.sourceSide} paired with ${stubScenario.pairedSymbol} ${stubScenario.pairedSide} (×${stubScenario.discountFactor})`, async ({
      page,
    }) => {
      await installStubRoutes(page);
      await runCrossAssetPairingScenario(page, stubScenario, true, { expectZeroBaseline: true });
    });
  });
});
