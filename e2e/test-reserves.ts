import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Shared E2E test reserve discovery — prevents hardcoded token breakage.
 *
 * Staging data changes over time (incentives expire, new chains launch, ltv
 * adjustments). Tests that hardcode a token symbol + market will break
 * when the staging data no longer matches their assumptions.
 *
 * This module fetches the staging API at module load and exposes:
 * - findIncentiveReserve(): a reserve with supply incentives AND ltv > 0
 * - findAnyActiveReserve(): any active, non-frozen reserve (for UI tests)
 *
 * Tests should use these instead of hardcoding 'USDC' / 'GHO' etc.
 * If no suitable reserve is found, tests skip gracefully.
 */

// Resolve API base from env: CI sets VITE_API_BASE_URL to the Railway direct
// URL (via LIVE_TEST_API_BASE_CI secret) to bypass Cloudflare/WAF 403s.
// Falls back to staging-api.aaveapy.com for local development.
const STAGING_API = process.env.VITE_API_BASE_URL || 'https://staging-api.aaveapy.com/api';

export interface TestReserve {
  symbol: string;
  marketLabel: string;
  reserveId: string;
  chainName: string;
  marketName: string;
  ltv: number;
}

// ─── Market label helper (mirrors src/lib/marketLabels.ts) ───────────

const ETHEREUM_MARKET_NAMES: Record<string, string> = {
  AaveV3Ethereum: 'Core',
  AaveV3EthereumLido: 'Prime',
  AaveV3EthereumHorizon: 'Horizon RWA',
  AaveV3EthereumEtherFi: 'EtherFi',
};

export function getMarketChipLabel(marketName: string, chainName: string): string {
  if (chainName !== 'Ethereum') return chainName;
  if (ETHEREUM_MARKET_NAMES[marketName]) return ETHEREUM_MARKET_NAMES[marketName];
  if (marketName.startsWith('AaveV4')) {
    return marketName.replace(/^AaveV4/i, '').replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  return marketName;
}

// ─── API fetch with cache ────────────────────────────────────────────

type ReserveData = Record<string, unknown>;

let reservesCache: ReserveData[] | null = null;

async function fetchReserves(): Promise<ReserveData[]> {
  if (reservesCache) return reservesCache;
  try {
    const resp = await fetch(`${STAGING_API}/markets`);
    if (!resp.ok) return [];
    const data = (await resp.json()) as { reserves?: ReserveData[] };
    reservesCache = data.reserves ?? [];
    return reservesCache;
  } catch {
    return [];
  }
}

// ─── Predicates ──────────────────────────────────────────────────────

function isUsableReserve(r: ReserveData): boolean {
  if (r.isFrozen || r.isPaused || r.isActive === false) return false;
  if (r.supplyDisabled === true) return false;
  return true;
}

function hasSupplyIncentive(r: ReserveData): boolean {
  const merklSupplys = (r.merklSupplys ?? []) as unknown[];
  const meritSupplys = (r.meritSupplys ?? []) as unknown[];
  return merklSupplys.length > 0 || meritSupplys.length > 0;
}

function hasLtv(r: ReserveData): boolean {
  const ltv = r.ltv as number | undefined;
  return typeof ltv === 'number' && ltv > 0;
}

function toTestReserve(r: ReserveData): TestReserve {
  return {
    symbol: r.tokenSymbol as string,
    marketLabel: getMarketChipLabel(r.marketName as string, r.chainName as string),
    reserveId: r.reserveId as string,
    chainName: r.chainName as string,
    marketName: r.marketName as string,
    ltv: r.ltv as number,
  };
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Find a reserve with supply incentives AND ltv > 0 on staging.
 * Used by incentive calculation tests that need real APR data.
 *
 * Prefers reserves with higher ltv (more borrowing headroom for LTV clamping).
 * Returns null if no suitable reserve is found.
 */
export async function findIncentiveReserve(): Promise<TestReserve | null> {
  const reserves = await fetchReserves();
  const candidates = reserves.filter(
    (r) => isUsableReserve(r) && hasSupplyIncentive(r) && hasLtv(r),
  );
  if (candidates.length === 0) return null;
  // Sort by ltv descending — higher ltv = more borrowing headroom
  candidates.sort((a, b) => (b.ltv as number) - (a.ltv as number));
  return toTestReserve(candidates[0]);
}

/**
 * Find any active, non-frozen reserve with ltv > 0.
 * Used by UI tests (decimal input, spacing) that don't need incentive data
 * but do need a reserve that can be added to the portfolio.
 *
 * Falls back to common stablecoins (USDC, USDT, WETH) for reliability.
 */
export async function findAnyActiveReserve(): Promise<TestReserve | null> {
  const reserves = await fetchReserves();
  const candidates = reserves.filter((r) => isUsableReserve(r) && hasLtv(r));
  if (candidates.length === 0) return null;

  // Prefer common stablecoins for UI tests (predictable decimal behavior)
  const preferredSymbols = ['USDC', 'USDT', 'DAI', 'WETH', 'GHO'];
  for (const sym of preferredSymbols) {
    const match = candidates.find((r) => (r.tokenSymbol as string) === sym);
    if (match) return toTestReserve(match);
  }
  return toTestReserve(candidates[0]);
}

/**
 * Shared setup helper — adds a reserve to portfolio mode and returns the supply input.
 * Works for both dynamically discovered and hardcoded reserves.
 */
export async function setupPortfolioWithReserve(
  page: Page,
  reserve: TestReserve,
): Promise<Locator> {
  await page.goto('/');
  // App-ready signal: the portfolio-mode toggle renders in both modes (single
  // mode: ScenarioControls header; portfolio mode: PortfolioPanel) only after
  // market data loads. The previous signal — the "Borrow amount" input — is
  // layout/state-dependent and flapped under parallel load.
  await expect(page.getByTestId('portfolio-mode-toggle')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('portfolio-mode-toggle').click();
  await page.getByRole('button', { name: 'Search tokens' }).click();
  await page.getByRole('textbox', { name: 'Search tokens to add' }).fill(reserve.symbol);
  await page.waitForTimeout(500);

  const addButtons = page.getByRole('button', {
    name: `Add ${reserve.symbol} (supply and borrow)`,
  });
  const count = await addButtons.count();
  if (count === 0) {
    throw new Error(`No Add button found for ${reserve.symbol}`);
  }

  // Pick the button matching the market label (handles same-symbol on multiple chains)
  let clicked = false;
  for (let i = 0; i < count; i++) {
    const btn = addButtons.nth(i);
    const text = await btn.textContent();
    if (text && text.includes(reserve.marketLabel)) {
      await btn.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    await addButtons.first().click();
  }

  const supplyInput = page
    .getByRole('textbox', { name: new RegExp(`Supply amount for ${reserve.symbol}`, 'i') })
    .first();
  await expect(supplyInput).toBeVisible();
  return supplyInput;
}

// ─── Portfolio simulation UI helpers ───────────────────────────────
//
// Shared by the portfolio cross-reserve / cross-asset E2E specs
// (e.g. portfolio-cross-reserve-offset, portfolio-cross-asset-pairing).
// They mirror the granular add/fill flow those specs use to add multiple
// reserves in sequence — distinct from setupPortfolioWithReserve, which adds
// a single reserve and returns the supply input.

/** Navigate to the app and enter portfolio simulation mode. */
export async function setupPortfolioMode(page: Page) {
  await page.goto('/');
  // App-ready signal: the portfolio-mode toggle renders in both modes (single
  // mode: ScenarioControls header; portfolio mode: PortfolioPanel) only after
  // market data loads. The previous signal — the "Borrow amount" input — is
  // layout/state-dependent and flapped under parallel load.
  await expect(page.getByTestId('portfolio-mode-toggle')).toBeVisible({
    timeout: 120_000,
  });
  await page.getByTestId('portfolio-mode-toggle').click();
}

/**
 * Open the token search (if needed) and add a reserve by symbol + market label.
 * Returns false if no matching "Add" button is found (caller should skip).
 */
export async function addReserveToPortfolio(
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

export async function fillSupplyAmount(page: Page, symbol: string, amount: string) {
  const input = page
    .getByRole('textbox', { name: new RegExp(`Supply amount for ${symbol}`, 'i') })
    .first();
  await input.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(amount);
  await page.waitForTimeout(800);
}

export async function fillBorrowAmountDesktop(page: Page, symbol: string, amount: string) {
  const input = page
    .getByRole('textbox', { name: new RegExp(`Borrow amount for ${symbol}`, 'i') })
    .first();
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(amount);
  await page.waitForTimeout(800);
}

export async function fillBorrowAmountMobile(
  page: Page,
  reserveId: string,
  symbol: string,
  amount: string,
) {
  const card = page.locator(`[data-reserve-id="${reserveId}"]`).first();
  await card.waitFor({ state: 'attached', timeout: 10000 });
  // Ensure the card is in viewport (InkAprCalculator + TopOpportunities push cards down on mobile)
  await card.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await page.waitForTimeout(500);
  // Note: Borrow is a role="tab" element, not role="button"
  const borrowTab = card.getByRole('tab', { name: 'Borrow', exact: true });
  await borrowTab.waitFor({ state: 'visible', timeout: 10000 });
  const tabState = await borrowTab.getAttribute('aria-selected');
  if (tabState !== 'true') {
    await borrowTab.click();
    await page.waitForTimeout(300);
  }
  const input = card
    .getByRole('textbox', { name: new RegExp(`Borrow amount for ${symbol}`, 'i') })
    .first();
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(amount);
  await page.waitForTimeout(800);
}

/**
 * Read the incentive "after" value for a reserve's supply or borrow side.
 * Returns 0 if the cell has no data-after span (no incentive).
 * Works for both desktop (table row) and mobile (card) layouts.
 */
export async function readIncentiveAfter(
  page: Page,
  reserveId: string,
  side: 'supply' | 'borrow',
  isMobile: boolean,
): Promise<number> {
  const cellName = side === 'supply' ? 'supply-incentive' : 'borrow-incentive';

  if (isMobile) {
    const card = page.locator(`[data-reserve-id="${reserveId}"]`).first();
    await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    // Note: Supply/Borrow are role="tab" elements, not role="button"
    const tab = card.getByRole('tab', {
      name: side === 'supply' ? 'Supply' : 'Borrow',
      exact: true,
    });
    if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(300);
    }
    const afterSpan = card
      .locator(`span[data-cell="${cellName}"] span[data-after]`)
      .first();
    const hasAfterSpan = (await afterSpan.count()) > 0;
    if (!hasAfterSpan) return 0;
    const attr = await afterSpan.getAttribute('data-after');
    return attr ? parseFloat(attr) : 0;
  }

  const row = page.locator(`tr[data-reserve-id="${reserveId}"]`).first();
  const incentiveCell = row.locator(`td[data-cell="${cellName}"]`);
  const afterSpan = incentiveCell.locator('span[data-after]').first();
  const hasAfterSpan = (await afterSpan.count()) > 0;
  if (!hasAfterSpan) return 0;
  const attr = await afterSpan.getAttribute('data-after');
  return attr ? parseFloat(attr) : 0;
}
