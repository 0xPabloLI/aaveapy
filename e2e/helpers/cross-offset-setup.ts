import { expect, test, type Page } from '@playwright/test';

/**
 * Shared setup, types, API discovery, and scenario runners for
 * Cross-reserve Merkl offset E2E tests.
 *
 * Extracted from portfolio-cross-reserve-offset.spec.ts to allow
 * desktop/mobile spec files to share the same infrastructure.
 */

// ─── Types ─────────────────────────────────────────────────────────

export interface CrossOffsetScenario {
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

const ETHEREUM_MARKET_NAMES: Record<string, string> = {
  AaveV3Ethereum: 'Core',
  AaveV3EthereumLido: 'Prime',
  AaveV3EthereumHorizon: 'Horizon RWA',
  AaveV3EthereumEtherFi: 'EtherFi',
};

/** Replicates src/lib/marketLabels.ts getMarketChipLabel for E2E use. */
function getMarketChipLabel(marketName: string, chainName: string): string {
  if (chainName !== 'Ethereum') return chainName;
  if (ETHEREUM_MARKET_NAMES[marketName]) return ETHEREUM_MARKET_NAMES[marketName];
  if (marketName.startsWith('AaveV4')) {
    return marketName.replace(/^AaveV4/i, '').replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  return marketName;
}

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
export const crossReserveScenarios = allScenarios.filter((s) => s.type === 'cross-reserve').slice(0, 3);
export const selfLoopScenarios = allScenarios.filter((s) => s.type === 'self-loop').slice(0, 5);
export const hasScenarios = crossReserveScenarios.length > 0 || selfLoopScenarios.length > 0;

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
  // Open search if not already open
  const searchInput = page.getByRole('textbox', { name: 'Search tokens to add' });
  if (!(await searchInput.isVisible({ timeout: 3000 }).catch(() => false))) {
    await page.getByRole('button', { name: 'Search tokens' }).click();
  }
  await searchInput.fill(symbol);
  await page.waitForTimeout(500);

  // Find the Add button matching the market label (handles same-symbol on multiple chains)
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
  // Fallback: first result
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
  // Switch to borrow tab (exact match to avoid hitting "Clear X borrow" button)
  await card.getByRole('button', { name: 'Borrow', exact: true }).click();
  await page.waitForTimeout(300);
  const input = card
    .getByRole('textbox', { name: new RegExp(`Borrow amount for ${symbol}`, 'i') })
    .first();
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(amount);
  await page.waitForTimeout(800);
}

async function readSupplyIncentiveAfter(
  page: Page,
  reserveId: string,
  isMobile: boolean,
): Promise<number> {
  if (isMobile) {
    const card = page.locator(`[data-reserve-id="${reserveId}"]`).first();
    // Ensure supply tab is active (exact match to avoid hitting "Clear X supply" button)
    const supplyTab = card.getByRole('button', { name: 'Supply', exact: true });
    if (await supplyTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await supplyTab.click();
      await page.waitForTimeout(300);
    }
    const afterSpan = card
      .locator('span[data-cell="supply-incentive"] span[data-after]')
      .first();
    await expect(afterSpan).toBeVisible({ timeout: 5000 });
    const attr = await afterSpan.getAttribute('data-after');
    return attr ? parseFloat(attr) : NaN;
  }
  // Desktop
  const row = page.locator(`tr[data-reserve-id="${reserveId}"]`).first();
  const incentiveCell = row.locator('td[data-cell="supply-incentive"]');
  await expect(incentiveCell).not.toContainText('—', { timeout: 5000 });
  const afterSpan = incentiveCell.locator('span[data-after]').first();
  const attr = await afterSpan.getAttribute('data-after');
  return attr ? parseFloat(attr) : NaN;
}

// ─── Shared Scenario Runner ────────────────────────────────────────

export async function runCrossReserveScenario(
  page: Page,
  s: CrossOffsetScenario,
  isMobile: boolean,
) {
  test.setTimeout(120_000);
  await setupPortfolioMode(page);

  // Add target reserve, supply $1000
  const added = await addReserveToPortfolio(page, s.targetSymbol, s.targetMarketLabel);
  expect(added, `Should find and add ${s.targetSymbol} (${s.targetMarketLabel})`).toBe(true);
  await fillSupplyAmount(page, s.targetSymbol, '1000');
  const baselineAfter = await readSupplyIncentiveAfter(page, s.targetReserveId, isMobile);
  expect(baselineAfter, 'Baseline after incentive should be positive').toBeGreaterThan(0);

  // Add offset reserve, borrow $500 (50% of supply)
  const offsetAdded = await addReserveToPortfolio(
    page,
    s.offsetSymbol!,
    s.offsetMarketLabel!,
  );
  expect(offsetAdded, `Should find and add ${s.offsetSymbol} (${s.offsetMarketLabel})`).toBe(
    true,
  );

  const fillOffsetBorrow = isMobile
    ? (amount: string) =>
        fillBorrowAmountMobile(page, s.offsetReserveId!, s.offsetSymbol!, amount)
    : (amount: string) => fillBorrowAmountDesktop(page, s.offsetSymbol!, amount);

  await fillOffsetBorrow('500');
  const halfOffsetAfter = await readSupplyIncentiveAfter(
    page,
    s.targetReserveId,
    isMobile,
  );

  // Assert: incentive decreased
  expect(
    halfOffsetAfter,
    'Incentive should decrease when offset borrow is added',
  ).toBeLessThan(baselineAfter);

  // Full offset: borrow = supply ($1000)
  await fillOffsetBorrow('1000');
  const fullOffsetAfter = await readSupplyIncentiveAfter(
    page,
    s.targetReserveId,
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

  // Over-offset: borrow > supply ($2000) — should clamp
  await fillOffsetBorrow('2000');
  const overOffsetAfter = await readSupplyIncentiveAfter(
    page,
    s.targetReserveId,
    isMobile,
  );
  expect(
    Math.abs(overOffsetAfter - fullOffsetAfter),
    'Over-offset should clamp (no further change beyond full offset)',
  ).toBeLessThanOrEqual(0.05);
}

export async function runSelfLoopScenario(
  page: Page,
  s: CrossOffsetScenario,
  isMobile: boolean,
) {
  test.setTimeout(120_000);
  await setupPortfolioMode(page);

  const added = await addReserveToPortfolio(page, s.targetSymbol, s.targetMarketLabel);
  expect(added).toBe(true);
  await fillSupplyAmount(page, s.targetSymbol, '1000');
  const baselineAfter = await readSupplyIncentiveAfter(page, s.targetReserveId, isMobile);
  expect(baselineAfter, 'Baseline after incentive should be positive').toBeGreaterThan(0);

  const fillOwnBorrow = isMobile
    ? (amount: string) =>
        fillBorrowAmountMobile(page, s.targetReserveId, s.targetSymbol, amount)
    : (amount: string) => fillBorrowAmountDesktop(page, s.targetSymbol, amount);

  // Half offset: borrow = $500
  await fillOwnBorrow('500');
  const halfOffsetAfter = await readSupplyIncentiveAfter(
    page,
    s.targetReserveId,
    isMobile,
  );
  expect(
    halfOffsetAfter,
    'Incentive should decrease when own borrow is added',
  ).toBeLessThan(baselineAfter);

  // Full offset: borrow = $1000
  await fillOwnBorrow('1000');
  const fullOffsetAfter = await readSupplyIncentiveAfter(
    page,
    s.targetReserveId,
    isMobile,
  );
  expect(fullOffsetAfter, 'Full offset should not increase from half offset').toBeLessThanOrEqual(
    halfOffsetAfter + 0.01,
  );
  expect(
    baselineAfter - fullOffsetAfter,
    'Decrease should be proportional to Merkl APR (>= 40% of advertised APR)',
  ).toBeGreaterThanOrEqual(s.targetApr * 0.4);

  // Over-offset: borrow = $2000 — should clamp
  await fillOwnBorrow('2000');
  const overOffsetAfter = await readSupplyIncentiveAfter(
    page,
    s.targetReserveId,
    isMobile,
  );
  expect(
    Math.abs(overOffsetAfter - fullOffsetAfter),
    'Over-offset should clamp',
  ).toBeLessThanOrEqual(0.05);
}


