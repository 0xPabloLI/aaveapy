import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { CROSS_RESERVE_OFFSET_FIXTURE_URL, buildCrossReserveOffsetStub } from './crossReserveOffsetStub';
import { discoverOffsetScenarios, type OffsetScenario } from './reserveDiscovery';
import { installMarketsStubRoutes } from './stubRoutes';
import { toDiscovery } from './stagingReservesFetch';
import {
  OFFSET_SCENARIO_GAP_REASON,
  addReserveToPortfolio,
  enforceEmptyListGate,
  fetchStagingReserves,
  fillBorrowAmountDesktop,
  fillBorrowAmountMobile,
  fillSupplyAmount,
  foundValue,
  readIncentiveAfter,
  reserveGateFor,
  setupPortfolioMode,
} from './test-reserves';

/**
 * Cross-reserve Merkl offset — portfolio simulation E2E.
 *
 * Dynamically discovers reserves with Merkl netPositionConstraint from
 * the staging API at module load time, then verifies that adding an
 * offset borrow position reduces the target reserve's supply incentive
 * (the data-after attribute on the incentive cell).
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
 * Scenario selection lives in ./reserveDiscovery (AAV-1280): groups only
 * qualify when their computable breakdown APRs sum > 0, mirroring the UI's
 * render gates (active window, whitelist, AMOUNT variants) so a selected
 * scenario always renders a numeric incentive — never the '—' failure shape.
 * Unit-tested in src/test/reserveDiscovery.test.ts.
 *
 * staging has had ZERO cross-reserve scenarios on every capture so far, so the
 * cross-reserve ladder is also exercised hermetically against a real fixture
 * with one injected constraint (AAV-1316 precedent, AAV-1333). Desktop +
 * mobile variants are generated from the same scenario list.
 */

// ─── API Discovery ─────────────────────────────────────────────────

// Discover at module load (top-level await — Playwright supports ESM TLA).
// API base comes from the shared env-resolving fetcher (AAV-1280 leftover):
// CI sets VITE_API_BASE_URL to bypass Cloudflare/WAF 403s on the staging host.
// AAV-1352: tagged outcome — "staging unreachable" must not look like
// "staging has no offset campaign". The live variants fail on the former.
const scenarioDiscovery = toDiscovery(await fetchStagingReserves(), (reserves) =>
  discoverOffsetScenarios(reserves, new Date().toISOString()),
);
const allScenarios: OffsetScenario[] = foundValue(scenarioDiscovery) ?? [];
const crossReserveScenarios = allScenarios.filter((s) => s.type === 'cross-reserve').slice(0, 3);
const selfLoopScenarios = allScenarios.filter((s) => s.type === 'self-loop').slice(0, 5);
const hasScenarios = crossReserveScenarios.length > 0 || selfLoopScenarios.length > 0;
const scenarioGate = reserveGateFor(scenarioDiscovery, OFFSET_SCENARIO_GAP_REASON);

// Synthetic cross-reserve payload (AAV-1333): staging carries zero
// cross-reserve constraints, so without this the cross-reserve ladder would
// never execute. Built from a committed real payload; fails loudly if the
// fixture stops producing a derivable scenario.
const stub = buildCrossReserveOffsetStub(JSON.parse(readFileSync(CROSS_RESERVE_OFFSET_FIXTURE_URL, 'utf8')) as unknown);

// ─── Shared Scenario Runner ────────────────────────────────────────

/** Displayed-value precision is 4 decimals (`data-after`), so 0.01 is generous. */
const ZERO_EPS = 0.01;
/** 10% head-room absorbs APY compounding and other rungs' rounding. */
const RATIO_TOLERANCE = 0.9;

/**
 * Drive the plan's ladder and assert it rung by rung.
 *
 * `measured` is the FRACTION of the baseline incentive the borrow removed —
 * the only quantity the app's math guarantees (`eligible / gross`). Comparing
 * an absolute delta against `targetApr` is what AAV-1333 removed: the cell
 * renders APY while `targetApr` is an APR figure, and gross is a clamped
 * number the runner does not choose.
 */
async function assertLadderRungs(
  page: Page,
  s: OffsetScenario,
  isMobile: boolean,
  fillBorrow: (amount: string) => Promise<void>,
  baseline: number,
) {
  let previous = baseline;
  for (const [index, step] of s.plan.steps.entries()) {
    const rung = `rung ${index + 1}/${s.plan.steps.length} (borrow $${step.borrowUsd})`;
    await fillBorrow(String(step.borrowUsd));
    const after = await readIncentiveAfter(page, s.targetReserveId, 'supply', isMobile);

    expect(after, `${rung}: incentive must not increase`).toBeLessThanOrEqual(previous + ZERO_EPS);
    if (step.expectedAfterZero) {
      expect(after, `${rung}: fully offset → eligible floors at 0`).toBeLessThanOrEqual(ZERO_EPS);
    }
    const measured = (baseline - after) / baseline;
    expect(
      measured,
      `${rung}: must remove ≥ ${RATIO_TOLERANCE} × ${step.expectedDecreaseRatio} of the baseline`,
    ).toBeGreaterThanOrEqual(step.expectedDecreaseRatio * RATIO_TOLERANCE);
    previous = after;
  }
}

async function runCrossReserveScenario(page: Page, s: OffsetScenario, isMobile: boolean) {
  test.setTimeout(180_000);
  await setupPortfolioMode(page);

  // Target supply is the plan's gross: it is already ≤ supply room, so the app
  // computes with exactly the number the plan derived from (AAV-1333).
  const added = await addReserveToPortfolio(page, s.targetSymbol, s.targetMarketLabel);
  expect(added, `Should find and add ${s.targetSymbol} (${s.targetMarketLabel})`).toBe(true);
  await fillSupplyAmount(page, s.targetReserveId, s.targetSymbol, String(s.plan.targetSupplyUsd));
  const baseline = await readIncentiveAfter(page, s.targetReserveId, 'supply', isMobile);
  expect(baseline, 'Baseline after incentive should be positive').toBeGreaterThan(0);

  // Offset reserve funds the borrow (AAV-1250 LTV clamping) at the plan's
  // funding amount, so its capacity is the one the plan assumed.
  const offsetAdded = await addReserveToPortfolio(page, s.offsetSymbol!, s.offsetMarketLabel!);
  expect(offsetAdded, `Should find and add ${s.offsetSymbol} (${s.offsetMarketLabel})`).toBe(true);
  await fillSupplyAmount(page, s.offsetReserveId!, s.offsetSymbol!, String(s.plan.offsetSupplyUsd));

  const fillOffsetBorrow = isMobile
    ? (amount: string) => fillBorrowAmountMobile(page, s.offsetReserveId!, s.offsetSymbol!, amount)
    : (amount: string) => fillBorrowAmountDesktop(page, s.offsetReserveId!, s.offsetSymbol!, amount);

  await assertLadderRungs(page, s, isMobile, fillOffsetBorrow, baseline);
}

async function runSelfLoopScenario(page: Page, s: OffsetScenario, isMobile: boolean) {
  test.setTimeout(180_000);
  await setupPortfolioMode(page);

  const added = await addReserveToPortfolio(page, s.targetSymbol, s.targetMarketLabel);
  expect(added).toBe(true);
  await fillSupplyAmount(page, s.targetReserveId, s.targetSymbol, String(s.plan.targetSupplyUsd));
  const baseline = await readIncentiveAfter(page, s.targetReserveId, 'supply', isMobile);
  expect(baseline, 'Baseline after incentive should be positive').toBeGreaterThan(0);

  const fillOwnBorrow = isMobile
    ? (amount: string) => fillBorrowAmountMobile(page, s.targetReserveId, s.targetSymbol, amount)
    : (amount: string) => fillBorrowAmountDesktop(page, s.targetReserveId, s.targetSymbol, amount);

  await assertLadderRungs(page, s, isMobile, fillOwnBorrow, baseline);
}

// ─── Tests ─────────────────────────────────────────────────────────

test.describe('Cross-reserve Merkl offset — portfolio simulation', () => {
  // ── Desktop ──────────────────────────────────────────────────────

  test.describe('desktop', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop table only');
    });

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

    // Synthetic cross-reserve payload (AAV-1333) — never gated on staging data:
    // the fixture is committed, so the cross-reserve ladder executes in CI and
    // locally even though staging carries zero netPositionConstraint campaigns.
    test(`cross-reserve stub: ${stub.scenario.targetSymbol} gross $${stub.scenario.plan.targetSupplyUsd} offset by ${stub.scenario.offsetSymbol} borrow`, async ({
      page,
    }) => {
      await installMarketsStubRoutes(page, stub.payload);
      await runCrossReserveScenario(page, stub.scenario, false);
    });
  });

  // ── Mobile ───────────────────────────────────────────────────────

  test.describe('mobile', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile card only');
    });

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
