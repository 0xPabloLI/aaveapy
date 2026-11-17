import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { CROSS_RESERVE_OFFSET_FIXTURE_URL, buildCrossReserveOffsetStub } from './crossReserveOffsetStub';
import { classifyIncentiveReading } from './incentiveReading';
import { discoverOffsetScenarios, type OffsetScenario } from './reserveDiscovery';
import { toDiscovery } from './stagingReservesFetch';
import {
  OFFSET_SCENARIO_GAP_REASON,
  addReserveToPortfolio,
  fetchStagingReserves,
  fillBorrowAmountDesktop,
  fillBorrowAmountMobile,
  fillSupplyAmount,
  foundValue,
  readIncentiveAfter,
  readIncentiveCellState,
  reserveGateFor,
  setupPortfolioMode,
} from './test-reserves';

/**
 * Shared scenario discovery + runner for the cross-reserve offset ladder
 * (AAV-1395 split the spec into `.desktop` / `.mobile` so each Playwright
 * project collects only its own tests instead of collecting-then-skipping).
 *
 * Scenario selection lives in ./reserveDiscovery (AAV-1280): groups only
 * qualify when their computable breakdown APRs sum > 0, mirroring the UI's
 * render gates (active window, whitelist, AMOUNT variants) so a selected
 * scenario always renders a numeric incentive — never the '—' failure shape.
 * Unit-tested in src/test/reserveDiscovery.test.ts.
 *
 * staging has had ZERO cross-reserve scenarios on every capture so far, so the
 * cross-reserve ladder is also exercised hermetically against a real fixture
 * with one injected constraint + one injected non-responding group (AAV-1333 /
 * AAV-1395).
 */

// Discover at module load (top-level await — Playwright supports ESM TLA).
// API base comes from the shared env-resolving fetcher (AAV-1280 leftover):
// CI sets VITE_API_BASE_URL to bypass Cloudflare/WAF 403s on the staging host.
// AAV-1352: tagged outcome — "staging unreachable" must not look like
// "staging has no offset campaign". The live variants fail on the former.
const scenarioDiscovery = toDiscovery(await fetchStagingReserves(), (reserves) =>
  discoverOffsetScenarios(reserves, new Date().toISOString()),
);
const allScenarios: OffsetScenario[] = foundValue(scenarioDiscovery) ?? [];
export const crossReserveScenarios = allScenarios.filter((s) => s.type === 'cross-reserve').slice(0, 3);
export const selfLoopScenarios = allScenarios.filter((s) => s.type === 'self-loop').slice(0, 5);
export const hasScenarios = crossReserveScenarios.length > 0 || selfLoopScenarios.length > 0;
export const scenarioGate = reserveGateFor(scenarioDiscovery, OFFSET_SCENARIO_GAP_REASON);

// Synthetic cross-reserve payload (AAV-1333): staging carries zero
// cross-reserve constraints, so without this the cross-reserve ladder would
// never execute. Built from a committed real payload; fails loudly if the
// fixture stops producing a derivable scenario.
export const stub = buildCrossReserveOffsetStub(
  JSON.parse(readFileSync(CROSS_RESERVE_OFFSET_FIXTURE_URL, 'utf8')) as unknown,
);

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

    // AAV-1395: a vanished cell read as 0 used to satisfy every assertion
    // below (measured = 1). Require the row to survive the input, then let the
    // classifier decide whether the cell's shape is legitimate for this rung.
    const row = page.locator(`[data-reserve-id="${s.targetReserveId}"]`);
    expect(await row.count(), `${rung}: target row disappeared after typing the borrow`).toBeGreaterThan(0);
    const reading = await readIncentiveCellState(page, s.targetReserveId, 'supply', isMobile);
    const verdict = classifyIncentiveReading(reading, step.expectedAfterZero);
    expect(verdict.ok, `${rung}: ${verdict.ok ? '' : verdict.reason}`).toBe(true);
    const after = reading.value;

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

export async function runCrossReserveScenario(page: Page, s: OffsetScenario, isMobile: boolean) {
  test.setTimeout(180_000);
  await setupPortfolioMode(page);

  // Target supply is the plan's gross: it is already ≤ supply room, so the app
  // computes with exactly the number the plan derived from (AAV-1333).
  const added = await addReserveToPortfolio(page, s.targetSymbol, s.targetMarketLabel);
  expect(added, `Should find and add ${s.targetSymbol} (${s.targetMarketLabel})`).toBe(true);
  await fillSupplyAmount(page, s.targetReserveId, s.targetSymbol, String(s.plan.targetSupplyUsd));
  const baseline = await readIncentiveAfter(page, s.targetReserveId, 'supply', isMobile);
  expect(baseline, 'Baseline after incentive should be positive').toBeGreaterThan(0);

  // Offset reserve funds the borrow at the plan's funding amount; its LTV
  // capacity is what sized gross (the ladder stays inside it by construction).
  const offsetAdded = await addReserveToPortfolio(page, s.offsetSymbol!, s.offsetMarketLabel!);
  expect(offsetAdded, `Should find and add ${s.offsetSymbol} (${s.offsetMarketLabel})`).toBe(true);
  await fillSupplyAmount(page, s.offsetReserveId!, s.offsetSymbol!, String(s.plan.offsetSupplyUsd));

  const fillOffsetBorrow = isMobile
    ? (amount: string) => fillBorrowAmountMobile(page, s.offsetReserveId!, s.offsetSymbol!, amount)
    : (amount: string) => fillBorrowAmountDesktop(page, s.offsetReserveId!, s.offsetSymbol!, amount);

  await assertLadderRungs(page, s, isMobile, fillOffsetBorrow, baseline);
}

export async function runSelfLoopScenario(page: Page, s: OffsetScenario, isMobile: boolean) {
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
