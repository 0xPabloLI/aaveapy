import { expect, test, type Page } from '@playwright/test';
import { getMarketChipLabel } from './test-reserves';

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
 * If no crossAssetPairing campaigns are found in staging data, all tests skip.
 * Desktop + mobile variants are generated from the same scenario list.
 */

// ─── Types ─────────────────────────────────────────────────────────

interface CrossAssetScenario {
  sourceSymbol: string;
  sourceMarketLabel: string;
  sourceReserveId: string;
  sourceSide: 'supply' | 'borrow';
  pairedSymbol: string;
  pairedMarketLabel: string;
  pairedReserveId: string;
  pairedSide: 'supply' | 'borrow';
  discountFactor: number;
  chainName: string;
  apr: number;
}

// ─── API Discovery ─────────────────────────────────────────────────

const STAGING_API = 'https://staging-api.aaveapy.com/api';

async function discoverCrossAssetScenarios(): Promise<CrossAssetScenario[]> {
  try {
    const resp = await fetch(`${STAGING_API}/markets`);
    if (!resp.ok) return [];
    const data = (await resp.json()) as { reserves?: Record<string, unknown>[] };
    const reserves = data.reserves ?? [];
    const idMap: Record<string, Record<string, unknown>> = {};
    for (const r of reserves) idMap[r.reserveId as string] = r;

    const scenarios: CrossAssetScenario[] = [];
    const seen = new Set<string>();

    // Check both merklSupplys and merklBorrows for crossAssetPairing
    for (const r of reserves) {
      if (r.isFrozen || r.isPaused || r.isActive === false) continue;

      const sides: Array<{ key: string; side: 'supply' | 'borrow' }> = [
        { key: 'merklSupplys', side: 'supply' },
        { key: 'merklBorrows', side: 'borrow' },
      ];

      for (const { key, side } of sides) {
        const groups = (r[key] ?? []) as Record<string, unknown>[];
        for (const g of groups) {
          const pairing = g.crossAssetPairing as
            | {
                sourceSide: 'supply' | 'borrow';
                pairedReserveId: string;
                pairedSide: 'supply' | 'borrow';
                discountFactor: number;
              }
            | null
            | undefined;
          if (!pairing) continue;

          // Get APR from breakdowns
          const breakdowns = (g.breakdowns ?? []) as { campaignApr?: number }[];
          const apr = breakdowns.reduce((s, b) => s + (b.campaignApr ?? 0), 0);
          if (apr <= 0) continue;

          // Look up paired reserve
          const pairedReserve = idMap[pairing.pairedReserveId];
          if (!pairedReserve) continue;
          if (pairedReserve.isFrozen || pairedReserve.isPaused || pairedReserve.isActive === false) continue;

          // Check that source reserve can be borrowed/supplied
          if (side === 'supply' && r.supplyDisabled === true) continue;
          if (side === 'borrow' && r.borrowDisabled === true) continue;
          // Need ltv > 0 for portfolio borrow to work (AAV-1250 LTV clamping)
          if (!r.ltv || r.ltv === 0) continue;

          // Check paired reserve can be supplied/borrowed
          if (pairing.pairedSide === 'supply' && pairedReserve.supplyDisabled === true) continue;
          if (pairing.pairedSide === 'borrow' && pairedReserve.borrowDisabled === true) continue;
          if (!pairedReserve.ltv || pairedReserve.ltv === 0) continue;

          const dedupKey = `${r.reserveId}:${side}`;
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);

          scenarios.push({
            sourceSymbol: r.tokenSymbol as string,
            sourceMarketLabel: getMarketChipLabel(
              r.marketName as string,
              r.chainName as string,
            ),
            sourceReserveId: r.reserveId as string,
            sourceSide: side,
            pairedSymbol: pairedReserve.tokenSymbol as string,
            pairedMarketLabel: getMarketChipLabel(
              pairedReserve.marketName as string,
              pairedReserve.chainName as string,
            ),
            pairedReserveId: pairedReserve.reserveId as string,
            pairedSide: pairing.pairedSide,
            discountFactor: pairing.discountFactor,
            chainName: r.chainName as string,
            apr,
          });
        }
      }
    }

    // Sort by APR descending — test highest-impact scenarios first
    scenarios.sort((a, b) => b.apr - a.apr);
    return scenarios;
  } catch {
    return [];
  }
}

// Discover at module load (top-level await — Playwright supports ESM TLA)
const allScenarios = await discoverCrossAssetScenarios();
// Limit to top 2 scenarios to keep CI runtime reasonable
const scenarios = allScenarios.slice(0, 2);
const hasScenarios = scenarios.length > 0;

// ─── UI Helpers ────────────────────────────────────────────────────

async function setupPortfolioMode(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible({
    timeout: 120_000,
  });
  await page.getByTestId('portfolio-mode-toggle').click();
}

async function addReserveToPortfolio(
  page: Page,
  symbol: string,
  marketLabel: string,
): Promise<boolean> {
  const searchInput = page.getByRole('textbox', { name: 'Search tokens to add' });
  if (!(await searchInput.isVisible({ timeout: 3000 }).catch(() => false))) {
    await page.getByRole('button', { name: 'Search tokens' }).click();
  }
  await searchInput.fill(symbol);
  await page.waitForTimeout(500);

  const addButtons = page.getByRole('button', {
    name: `Add ${symbol} (supply and borrow)`,
  });
  const count = await addButtons.count();
  if (count === 0) return false;
  if (count === 1) {
    await addButtons.first().click();
    return true;
  }
  for (let i = 0; i < count; i++) {
    const btn = addButtons.nth(i);
    const text = await btn.textContent();
    if (text && text.includes(marketLabel)) {
      await btn.click();
      return true;
    }
  }
  await addButtons.first().click();
  return true;
}

async function fillSupplyAmount(page: Page, symbol: string, amount: string) {
  const input = page
    .getByRole('textbox', { name: new RegExp(`Supply amount for ${symbol}`, 'i') })
    .first();
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(amount);
  await page.waitForTimeout(800);
}

async function fillBorrowAmountDesktop(page: Page, symbol: string, amount: string) {
  const input = page
    .getByRole('textbox', { name: new RegExp(`Borrow amount for ${symbol}`, 'i') })
    .first();
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(amount);
  await page.waitForTimeout(800);
}

async function fillBorrowAmountMobile(
  page: Page,
  reserveId: string,
  symbol: string,
  amount: string,
) {
  const card = page.locator(`[data-reserve-id="${reserveId}"]`).first();
  await card.getByRole('button', { name: 'Borrow', exact: true }).click();
  await page.waitForTimeout(300);
  const input = card
    .getByRole('textbox', { name: new RegExp(`Borrow amount for ${symbol}`, 'i') })
    .first();
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(amount);
  await page.waitForTimeout(800);
}

/**
 * Read the incentive "after" value for a reserve.
 * Returns 0 if the cell shows "—" (no incentive).
 * Works for both supply and borrow incentive cells.
 */
async function readIncentiveAfter(
  page: Page,
  reserveId: string,
  side: 'supply' | 'borrow',
  isMobile: boolean,
): Promise<number> {
  const cellName = side === 'supply' ? 'supply-incentive' : 'borrow-incentive';

  if (isMobile) {
    const card = page.locator(`[data-reserve-id="${reserveId}"]`).first();
    // Ensure correct tab is active
    const tab = card.getByRole('button', { name: side === 'supply' ? 'Supply' : 'Borrow', exact: true });
    if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(300);
    }
    const afterSpan = card
      .locator(`span[data-cell="${cellName}"] span[data-after]`)
      .first();
    const hasAfterSpan = await afterSpan.count() > 0;
    if (!hasAfterSpan) return 0;
    const attr = await afterSpan.getAttribute('data-after');
    return attr ? parseFloat(attr) : 0;
  }

  // Desktop
  const row = page.locator(`tr[data-reserve-id="${reserveId}"]`).first();
  const incentiveCell = row.locator(`td[data-cell="${cellName}"]`);
  const afterSpan = incentiveCell.locator('span[data-after]').first();
  const hasAfterSpan = await afterSpan.count() > 0;
  if (!hasAfterSpan) return 0;
  const attr = await afterSpan.getAttribute('data-after');
  return attr ? parseFloat(attr) : 0;
}

// ─── Shared Scenario Runner ────────────────────────────────────────

async function runCrossAssetPairingScenario(
  page: Page,
  s: CrossAssetScenario,
  isMobile: boolean,
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
  const fillSourcePosition = s.sourceSide === 'borrow'
    ? (isMobile
        ? (amount: string) => fillBorrowAmountMobile(page, s.sourceReserveId, s.sourceSymbol, amount)
        : (amount: string) => fillBorrowAmountDesktop(page, s.sourceSymbol, amount))
    : (amount: string) => fillSupplyAmount(page, s.sourceSymbol, amount);

  // Use $1000 as source position
  await fillSourcePosition('1000');
  const baselineAfter = await readIncentiveAfter(page, s.sourceReserveId, s.sourceSide, isMobile);

  // Baseline: without paired asset, incentive should be 0 or very low
  // because min(source, 0 × discountFactor) = 0
  // The incentive cell might show 0 or a very small value
  expect(baselineAfter, 'Baseline incentive without paired position').not.toBeNaN();

  // Step 2: Add paired reserve with a position on the paired side
  const pairedAdded = await addReserveToPortfolio(page, s.pairedSymbol, s.pairedMarketLabel);
  expect(pairedAdded, `Should find and add ${s.pairedSymbol} (${s.pairedMarketLabel})`).toBe(true);

  // If paired is borrow, need supply for LTV
  if (s.pairedSide === 'borrow') {
    await fillSupplyAmount(page, s.pairedSymbol, '100000');
  }

  const fillPairedPosition = s.pairedSide === 'borrow'
    ? (isMobile
        ? (amount: string) => fillBorrowAmountMobile(page, s.pairedReserveId, s.pairedSymbol, amount)
        : (amount: string) => fillBorrowAmountDesktop(page, s.pairedSymbol, amount))
    : (amount: string) => fillSupplyAmount(page, s.pairedSymbol, amount);

  // Step 3: Add small paired position ($500)
  // effective = min(1000, 500 × discountFactor)
  // If discountFactor < 2, effective < 1000 → incentive should increase from baseline
  await fillPairedPosition('500');
  const halfPairedAfter = await readIncentiveAfter(page, s.sourceReserveId, s.sourceSide, isMobile);

  // Incentive should be higher than baseline (0 or low) when paired position is added
  expect(
    halfPairedAfter,
    'Incentive should increase when paired position is added',
  ).toBeGreaterThan(baselineAfter);

  // Step 4: Increase paired position ($2000) — now source ($1000) is the binding constraint
  // effective = min(1000, 2000 × discountFactor) = 1000 (if discountFactor >= 0.5)
  await fillPairedPosition('2000');
  const fullPairedAfter = await readIncentiveAfter(page, s.sourceReserveId, s.sourceSide, isMobile);

  // With enough paired position, incentive should be at least as high as half-paired
  expect(
    fullPairedAfter,
    'Full paired should not decrease from half paired',
  ).toBeGreaterThanOrEqual(halfPairedAfter - 0.01);

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
        test.skip('No crossAssetPairing campaigns found in current staging data');
      });
    }

    for (const s of scenarios) {
      test(
        `cross-asset: ${s.sourceSymbol} [${s.sourceMarketLabel}] ${s.sourceSide} paired with ${s.pairedSymbol} ${s.pairedSide} (×${s.discountFactor})`,
        async ({ page }) => {
          await runCrossAssetPairingScenario(page, s, false);
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
      test('no cross-asset pairing scenarios found in staging data', () => {
        test.skip('No crossAssetPairing campaigns found in current staging data');
      });
    }

    for (const s of scenarios) {
      test(
        `cross-asset: ${s.sourceSymbol} [${s.sourceMarketLabel}] ${s.sourceSide} paired with ${s.pairedSymbol} ${s.pairedSide} (×${s.discountFactor})`,
        async ({ page }) => {
          await runCrossAssetPairingScenario(page, s, true);
        },
      );
    }
  });
});
