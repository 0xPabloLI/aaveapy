import { expect, test, type Page } from '@playwright/test';
import {
  addReserveToPortfolio,
  fillBorrowAmountDesktop,
  fillBorrowAmountMobile,
  fillSupplyAmount,
  getMarketChipLabel,
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
 * If no cross-offset campaigns are found in staging data, all tests skip.
 * Desktop + mobile variants are generated from the same scenario list.
 */

// ─── Types ─────────────────────────────────────────────────────────

interface CrossOffsetScenario {
  type: 'cross-reserve' | 'self-loop';
  targetSymbol: string;
  targetMarketLabel: string;
  targetReserveId: string;
  targetApr: number;
  chainName: string;
  offsetSymbol?: string;
  offsetMarketLabel?: string;
  offsetReserveId?: string;
}

// ─── API Discovery ─────────────────────────────────────────────────

const STAGING_API = 'https://staging-api.aaveapy.com/api';

async function discoverScenarios(): Promise<CrossOffsetScenario[]> {
  try {
    const resp = await fetch(`${STAGING_API}/markets`);
    if (!resp.ok) return [];
    const data = (await resp.json()) as { reserves?: Record<string, unknown>[] };
    const reserves = data.reserves ?? [];
    const idMap: Record<string, Record<string, unknown>> = {};
    for (const r of reserves) idMap[r.reserveId as string] = r;

    const scenarios: CrossOffsetScenario[] = [];
    const seen = new Set<string>();

    for (const r of reserves) {
      const merklSupplys = (r.merklSupplys ?? []) as Record<string, unknown>[];
      for (const g of merklSupplys) {
        const constraint = g.netPositionConstraint as
          | { offsetReserveIds: string[] }
          | null
          | undefined;
        if (!constraint) continue;
        const offsets = constraint.offsetReserveIds;
        const nonSelf = offsets.filter((id) => id !== r.reserveId);
        const breakdowns = (g.breakdowns ?? []) as { campaignApr?: number }[];
        const apr = breakdowns.reduce((s, b) => s + (b.campaignApr ?? 0), 0);
        if (apr <= 0) continue;

        // Skip reserves that cannot be added to portfolio or have supply disabled
        if (r.isFrozen || r.isPaused || r.isActive === false) continue;
        if (r.supplyDisabled === true) continue;
        // AAV-1250: LTV clamping prevents borrow when ltv=0 (frozen/non-collateral)
        // Filter out reserves with ltv=0 or undefined — they can't be borrowed against
        if (!r.ltv || r.ltv === 0) continue;

        const marketLabel = getMarketChipLabel(
          r.marketName as string,
          r.chainName as string,
        );
        const type = nonSelf.length > 0 ? 'cross-reserve' : 'self-loop';
        const dedupKey = `${r.reserveId as string}:${type}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        if (type === 'cross-reserve') {
          const offsetReserve = idMap[nonSelf[0]];
          if (!offsetReserve) continue;
          // Skip if offset reserve cannot be added or has borrow disabled
          if (offsetReserve.isFrozen || offsetReserve.isPaused || offsetReserve.isActive === false) continue;
          if (offsetReserve.borrowDisabled === true) continue;
          // AAV-1250: offset reserve also needs ltv > 0 for borrow to not be clamped to 0
          if (!offsetReserve.ltv || offsetReserve.ltv === 0) continue;
          scenarios.push({
            type,
            targetSymbol: r.tokenSymbol as string,
            targetMarketLabel: marketLabel,
            targetReserveId: r.reserveId as string,
            targetApr: apr,
            chainName: r.chainName as string,
            offsetSymbol: offsetReserve.tokenSymbol as string,
            offsetMarketLabel: getMarketChipLabel(
              offsetReserve.marketName as string,
              offsetReserve.chainName as string,
            ),
            offsetReserveId: offsetReserve.reserveId as string,
          });
        } else {
          scenarios.push({
            type,
            targetSymbol: r.tokenSymbol as string,
            targetMarketLabel: marketLabel,
            targetReserveId: r.reserveId as string,
            targetApr: apr,
            chainName: r.chainName as string,
          });
        }
      }
    }

    // Sort: cross-reserve first, then by APR descending
    scenarios.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'cross-reserve' ? -1 : 1;
      return b.targetApr - a.targetApr;
    });

    return scenarios;
  } catch {
    return [];
  }
}

// Discover at module load (top-level await — Playwright supports ESM TLA)
const allScenarios = await discoverScenarios();
const crossReserveScenarios = allScenarios.filter((s) => s.type === 'cross-reserve').slice(0, 3);
const selfLoopScenarios = allScenarios.filter((s) => s.type === 'self-loop').slice(0, 5);
const hasScenarios = crossReserveScenarios.length > 0 || selfLoopScenarios.length > 0;

// ─── Shared Scenario Runner ────────────────────────────────────────

async function runCrossReserveScenario(
  page: Page,
  s: CrossOffsetScenario,
  isMobile: boolean,
) {
  test.setTimeout(180_000);
  await setupPortfolioMode(page);

  // Add target reserve, supply $100000 (large enough for LTV clamping at common ltv rates)
  const added = await addReserveToPortfolio(page, s.targetSymbol, s.targetMarketLabel);
  expect(added, `Should find and add ${s.targetSymbol} (${s.targetMarketLabel})`).toBe(true);
  await fillSupplyAmount(page, s.targetSymbol, '100000');
  const baselineAfter = await readIncentiveAfter(page, s.targetReserveId, 'supply', isMobile);
  expect(baselineAfter, 'Baseline after incentive should be positive').toBeGreaterThan(0);

  // Add offset reserve with supply to give it borrowing power (AAV-1250: LTV clamping)
  const offsetAdded = await addReserveToPortfolio(
    page,
    s.offsetSymbol!,
    s.offsetMarketLabel!,
  );
  expect(offsetAdded, `Should find and add ${s.offsetSymbol} (${s.offsetMarketLabel})`).toBe(
    true,
  );
  // Supply on offset reserve so its borrow is not LTV-clamped to 0
  await fillSupplyAmount(page, s.offsetSymbol!, '100000');

  const fillOffsetBorrow = isMobile
    ? (amount: string) =>
        fillBorrowAmountMobile(page, s.offsetReserveId!, s.offsetSymbol!, amount)
    : (amount: string) => fillBorrowAmountDesktop(page, s.offsetSymbol!, amount);

  await fillOffsetBorrow('500');
  const halfOffsetAfter = await readIncentiveAfter(
    page,
    s.targetReserveId,
    'supply',
    isMobile,
  );

  // Assert: incentive decreased
  expect(
    halfOffsetAfter,
    'Incentive should decrease when offset borrow is added',
  ).toBeLessThan(baselineAfter);

  // Full offset: borrow = $1000 (well within maxBorrow at $100000 supply)
  await fillOffsetBorrow('1000');
  const fullOffsetAfter = await readIncentiveAfter(
    page,
    s.targetReserveId,
    'supply',
    isMobile,
  );

  // Assert: further decrease, proportional to Merkl APR
  expect(
    fullOffsetAfter,
    'Full offset should not increase from half offset',
  ).toBeLessThanOrEqual(halfOffsetAfter + 0.01);
  expect(
    baselineAfter - fullOffsetAfter,
    'Decrease should be proportional to Merkl APR (>= 40% of advertised APR)',
  ).toBeGreaterThanOrEqual(s.targetApr * 0.4);

  // Over-offset: borrow > target supply ($2000) — should clamp via offset logic
  await fillOffsetBorrow('2000');
  const overOffsetAfter = await readIncentiveAfter(
    page,
    s.targetReserveId,
    'supply',
    isMobile,
  );
  expect(
    Math.abs(overOffsetAfter - fullOffsetAfter),
    'Over-offset should clamp (no further change beyond full offset)',
  ).toBeLessThanOrEqual(0.05);
}

async function runSelfLoopScenario(
  page: Page,
  s: CrossOffsetScenario,
  isMobile: boolean,
) {
  test.setTimeout(180_000);
  await setupPortfolioMode(page);

  const added = await addReserveToPortfolio(page, s.targetSymbol, s.targetMarketLabel);
  expect(added).toBe(true);
  await fillSupplyAmount(page, s.targetSymbol, '100000');
  const baselineAfter = await readIncentiveAfter(page, s.targetReserveId, 'supply', isMobile);
  expect(baselineAfter, 'Baseline after incentive should be positive').toBeGreaterThan(0);

  const fillOwnBorrow = isMobile
    ? (amount: string) =>
        fillBorrowAmountMobile(page, s.targetReserveId, s.targetSymbol, amount)
    : (amount: string) => fillBorrowAmountDesktop(page, s.targetSymbol, amount);

  // Half offset: borrow = $50000 (50% of supply, within LTV limit)
  await fillOwnBorrow('50000');
  const halfOffsetAfter = await readIncentiveAfter(
    page,
    s.targetReserveId,
    'supply',
    isMobile,
  );
  expect(
    halfOffsetAfter,
    'Incentive should decrease when own borrow is added',
  ).toBeLessThan(baselineAfter);

  // Full offset: borrow = $100000 (= supply, may be LTV-clamped to supply×ltv/100)
  await fillOwnBorrow('100000');
  const fullOffsetAfter = await readIncentiveAfter(
    page,
    s.targetReserveId,
    'supply',
    isMobile,
  );
  expect(fullOffsetAfter, 'Full offset should not increase from half offset').toBeLessThanOrEqual(
    halfOffsetAfter + 0.01,
  );
  expect(
    baselineAfter - fullOffsetAfter,
    'Decrease should be proportional to Merkl APR (>= 40% of advertised APR)',
  ).toBeGreaterThanOrEqual(s.targetApr * 0.4);

  // Over-offset: borrow = $200000 (> supply, should be LTV-clamped)
  await fillOwnBorrow('200000');
  const overOffsetAfter = await readIncentiveAfter(
    page,
    s.targetReserveId,
    'supply',
    isMobile,
  );
  expect(
    Math.abs(overOffsetAfter - fullOffsetAfter),
    'Over-offset should clamp',
  ).toBeLessThanOrEqual(0.05);
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
      test(
        `cross-reserve: ${s.targetSymbol} [${s.targetMarketLabel}] supply offset by ${s.offsetSymbol} borrow`,
        async ({ page }) => {
          await runCrossReserveScenario(page, s, false);
        },
      );
    }

    for (const s of selfLoopScenarios) {
      test(
        `self-loop: ${s.targetSymbol} [${s.targetMarketLabel}] supply offset by own borrow`,
        async ({ page }) => {
          await runSelfLoopScenario(page, s, false);
        },
      );
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
