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

const STAGING_API = 'https://staging-api.aaveapy.com/api';

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
  await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible();
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
