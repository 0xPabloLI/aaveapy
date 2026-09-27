import { expect, test, type Page } from '@playwright/test';
import { discoverOffsetScenarios, type OffsetScenario } from './reserveDiscovery';
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
 * Assertions are behavioural (relative changes, proportional to Merkl APR),
 * not value-specific, to remain resilient to APR changes over time.
 *
 * Scenario selection lives in ./reserveDiscovery (AAV-1280): groups only
 * qualify when their computable breakdown APRs sum > 0, mirroring the UI's
 * render gates (active window, whitelist, AMOUNT variants) so a selected
 * scenario always renders a numeric incentive — never the '—' failure shape.
 * Unit-tested in src/test/reserveDiscovery.test.ts.
 *
 * If no cross-offset campaigns are found in staging data, all tests skip.
 * Desktop + mobile variants are generated from the same scenario list.
 */

// ─── API Discovery ─────────────────────────────────────────────────

// Discover at module load (top-level await — Playwright supports ESM TLA).
// API base comes from the shared env-resolving fetcher (AAV-1280 leftover):
// CI sets VITE_API_BASE_URL to bypass Cloudflare/WAF 403s on the staging host.
const allScenarios: OffsetScenario[] = discoverOffsetScenarios(await fetchStagingReserves(), new Date().toISOString());
const crossReserveScenarios = allScenarios.filter((s) => s.type === 'cross-reserve').slice(0, 3);
const selfLoopScenarios = allScenarios.filter((s) => s.type === 'self-loop').slice(0, 5);
const hasScenarios = crossReserveScenarios.length > 0 || selfLoopScenarios.length > 0;

// ─── Shared Scenario Runner ────────────────────────────────────────

async function runCrossReserveScenario(page: Page, s: OffsetScenario, isMobile: boolean) {
  test.setTimeout(180_000);
  await setupPortfolioMode(page);

  // Add target reserve, supply $100000 (large enough for LTV clamping at common ltv rates)
  const added = await addReserveToPortfolio(page, s.targetSymbol, s.targetMarketLabel);
  expect(added, `Should find and add ${s.targetSymbol} (${s.targetMarketLabel})`).toBe(true);
  await fillSupplyAmount(page, s.targetSymbol, '100000');
  const baselineAfter = await readIncentiveAfter(page, s.targetReserveId, 'supply', isMobile);
  expect(baselineAfter, 'Baseline after incentive should be positive').toBeGreaterThan(0);

  // Add offset reserve with supply to give it borrowing power (AAV-1250: LTV clamping)
  const offsetAdded = await addReserveToPortfolio(page, s.offsetSymbol!, s.offsetMarketLabel!);
  expect(offsetAdded, `Should find and add ${s.offsetSymbol} (${s.offsetMarketLabel})`).toBe(true);
  // Supply on offset reserve so its borrow is not LTV-clamped to 0
  await fillSupplyAmount(page, s.offsetSymbol!, '100000');

  const fillOffsetBorrow = isMobile
    ? (amount: string) => fillBorrowAmountMobile(page, s.offsetReserveId!, s.offsetSymbol!, amount)
    : (amount: string) => fillBorrowAmountDesktop(page, s.offsetSymbol!, amount);

  await fillOffsetBorrow('500');
  const halfOffsetAfter = await readIncentiveAfter(page, s.targetReserveId, 'supply', isMobile);

  // Assert: incentive decreased
  expect(halfOffsetAfter, 'Incentive should decrease when offset borrow is added').toBeLessThan(baselineAfter);

  // Full offset: borrow = $1000 (well within maxBorrow at $100000 supply)
  await fillOffsetBorrow('1000');
  const fullOffsetAfter = await readIncentiveAfter(page, s.targetReserveId, 'supply', isMobile);

  // Assert: further decrease, proportional to Merkl APR
  expect(fullOffsetAfter, 'Full offset should not increase from half offset').toBeLessThanOrEqual(
    halfOffsetAfter + 0.01,
  );
  expect(
    baselineAfter - fullOffsetAfter,
    'Decrease should be proportional to Merkl APR (>= 40% of advertised APR)',
  ).toBeGreaterThanOrEqual(s.targetApr * 0.4);

  // Over-offset: borrow > target supply ($2000) — should clamp via offset logic
  await fillOffsetBorrow('2000');
  const overOffsetAfter = await readIncentiveAfter(page, s.targetReserveId, 'supply', isMobile);
  expect(
    Math.abs(overOffsetAfter - fullOffsetAfter),
    'Over-offset should clamp (no further change beyond full offset)',
  ).toBeLessThanOrEqual(0.05);
}

async function runSelfLoopScenario(page: Page, s: OffsetScenario, isMobile: boolean) {
  test.setTimeout(180_000);
  await setupPortfolioMode(page);

  const added = await addReserveToPortfolio(page, s.targetSymbol, s.targetMarketLabel);
  expect(added).toBe(true);
  await fillSupplyAmount(page, s.targetSymbol, '100000');
  const baselineAfter = await readIncentiveAfter(page, s.targetReserveId, 'supply', isMobile);
  expect(baselineAfter, 'Baseline after incentive should be positive').toBeGreaterThan(0);

  const fillOwnBorrow = isMobile
    ? (amount: string) => fillBorrowAmountMobile(page, s.targetReserveId, s.targetSymbol, amount)
    : (amount: string) => fillBorrowAmountDesktop(page, s.targetSymbol, amount);

  // Half offset: borrow = $50000 (50% of supply, within LTV limit)
  await fillOwnBorrow('50000');
  const halfOffsetAfter = await readIncentiveAfter(page, s.targetReserveId, 'supply', isMobile);
  expect(halfOffsetAfter, 'Incentive should decrease when own borrow is added').toBeLessThan(baselineAfter);

  // Full offset: borrow = $100000 (= supply, may be LTV-clamped to supply×ltv/100)
  await fillOwnBorrow('100000');
  const fullOffsetAfter = await readIncentiveAfter(page, s.targetReserveId, 'supply', isMobile);
  expect(fullOffsetAfter, 'Full offset should not increase from half offset').toBeLessThanOrEqual(
    halfOffsetAfter + 0.01,
  );
  expect(
    baselineAfter - fullOffsetAfter,
    'Decrease should be proportional to Merkl APR (>= 40% of advertised APR)',
  ).toBeGreaterThanOrEqual(s.targetApr * 0.4);

  // Over-offset: borrow = $200000 (> supply, should be LTV-clamped)
  await fillOwnBorrow('200000');
  const overOffsetAfter = await readIncentiveAfter(page, s.targetReserveId, 'supply', isMobile);
  expect(Math.abs(overOffsetAfter - fullOffsetAfter), 'Over-offset should clamp').toBeLessThanOrEqual(0.05);
}

// ─── Tests ─────────────────────────────────────────────────────────

test.describe('Cross-reserve Merkl offset — portfolio simulation', () => {
  // ── Desktop ──────────────────────────────────────────────────────

  test.describe('desktop', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop table only');
    });

    if (!hasScenarios) {
      test('no cross-offset scenarios found in staging data', () => {
        test.skip('No cross-offset Merkl campaigns found in current staging data');
      });
    }

    for (const s of crossReserveScenarios) {
      test(`cross-reserve: ${s.targetSymbol} [${s.targetMarketLabel}] supply offset by ${s.offsetSymbol} borrow`, async ({
        page,
      }) => {
        await runCrossReserveScenario(page, s, false);
      });
    }

    for (const s of selfLoopScenarios) {
      test(`self-loop: ${s.targetSymbol} [${s.targetMarketLabel}] supply offset by own borrow`, async ({ page }) => {
        await runSelfLoopScenario(page, s, false);
      });
    }
  });

  // ── Mobile ───────────────────────────────────────────────────────

  test.describe('mobile', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile card only');
    });

    if (!hasScenarios) {
      test('no cross-offset scenarios found in staging data', () => {
        test.skip('No cross-offset Merkl campaigns found in current staging data');
      });
    }

    for (const s of crossReserveScenarios) {
      test(`cross-reserve: ${s.targetSymbol} [${s.targetMarketLabel}] supply offset by ${s.offsetSymbol} borrow`, async ({
        page,
      }) => {
        await runCrossReserveScenario(page, s, true);
      });
    }

    for (const s of selfLoopScenarios) {
      test(`self-loop: ${s.targetSymbol} [${s.targetMarketLabel}] supply offset by own borrow`, async ({ page }) => {
        await runSelfLoopScenario(page, s, true);
      });
    }
  });
});
