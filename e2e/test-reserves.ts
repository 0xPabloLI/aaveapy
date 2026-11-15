import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  getMarketChipLabel,
  pickIncentiveReserve,
  forecastAvailableCampaignIdsFromSideData,
  type DiscoveryReserve,
  type PickedReserve,
} from './reserveDiscovery';
import {
  STAGING_FETCH_TIMEOUT_MS,
  createReservesFetcher,
  decideReserveGate,
  gateEffect,
  isUnreachableAllowed,
  unreachableDiscovery,
  type ReserveDiscovery,
  type ReserveGate,
  type ReservesFetchOutcome,
} from './stagingReservesFetch';

/**
 * Shared E2E test reserve discovery — prevents hardcoded token breakage.
 *
 * Staging data changes over time (incentives expire, new chains launch, ltv
 * adjustments). Tests that hardcode a token symbol + market will break
 * when the staging data no longer matches their assumptions.
 *
 * This module fetches the staging API lazily (first discovery call) and exposes:
 * - findIncentiveReserve(): a reserve with a COMPUTABLE supply incentive AND ltv > 0
 * - findAnyActiveReserve(): any active, non-frozen reserve (for UI tests)
 *
 * Pure selection logic lives in ./reserveDiscovery (zero-dependency, unit
 * tested in src/test/reserveDiscovery.test.ts — AAV-1299).
 *
 * Tests should use these instead of hardcoding 'USDC' / 'GHO' etc.
 *
 * AAV-1352: discovery returns a tagged result, not `T | null`. "Staging has
 * nothing that qualifies" (data gap) and "staging could not be reached" are
 * different facts, and skipping on the second one is how an entire spec file
 * used to report green while verifying nothing.
 *
 * Wiring is one call site per spec, so a new consumer cannot half-wire it:
 *
 *   const discovery = await findIncentiveReserve();
 *   const testReserve = foundValue(discovery);            // null unless found
 *   const reserveGate = reserveGateFor(discovery, INCENTIVE_RESERVE_GAP_REASON);
 *   test.beforeEach(() => { enforceReserveGate(reserveGate); });
 *
 * A data gap still skips; an unreachable staging fails the live tests
 * (opt-out: `E2E_ALLOW_STAGING_UNREACHABLE=1`).
 * See docs/specs/aav-1352-staging-discovery-fetch-outcome.md.
 */

// Resolve API base from env: CI sets VITE_API_BASE_URL to the Railway direct
// URL (via LIVE_TEST_API_BASE_CI secret) to bypass Cloudflare/WAF 403s.
// Falls back to staging-api.aaveapy.com for local development.
const STAGING_API = process.env.VITE_API_BASE_URL || 'https://staging-api.aaveapy.com/api';

export type TestReserve = PickedReserve;

// ─── API fetch with cache ────────────────────────────────────────────

type ReserveData = DiscoveryReserve;

const reservesFetcher = createReservesFetcher({ url: `${STAGING_API}/markets` });

/**
 * Fetch (and cache per process) the staging `/markets` reserves.
 * Shared by specs that run their own module-load discovery (AAV-1280):
 * API base resolution — CI's VITE_API_BASE_URL bypassing Cloudflare/WAF —
 * lives here only, so hardcoded staging URLs can't silently false-skip.
 *
 * Returns the tagged outcome: `unreachable` is NOT an empty list. Timeout and
 * retry policy live in `./stagingReservesFetch`.
 */
export function fetchStagingReserves(): Promise<ReservesFetchOutcome> {
  return reservesFetcher.get();
}

let forecastAvailableCampaignIdsCache: Set<string> | null = null;

/**
 * Campaign ids the backend COULD forecast, read from `/meta/side-data`.
 *
 * The incentive specs assert that a value responds to position size, and a
 * forecast-backed campaign is the only way to know that response is real: a
 * forecast-requiring campaign absent from `forecast.items` is one the UI marks
 * with '*' and the "No forecast data — using current APR" footnote. It is NOT a
 * '—' placeholder — see `forecastAvailableCampaignIdsFromSideData`. Discovery
 * therefore prefers forecast-backed campaigns.
 *
 * Returns `null` when the fetch fails, which DISABLES the gate: a degraded
 * side-data endpoint must not silently turn the incentive suites into no-ops,
 * and "nothing is available" would exclude every forecast-requiring campaign.
 */
export async function fetchForecastAvailableCampaignIds(): Promise<Set<string> | null> {
  if (forecastAvailableCampaignIdsCache) return forecastAvailableCampaignIdsCache;
  try {
    // Bounded like the /markets fetch: a hung side-data call used to block module
    // load forever with no output at all (AAV-1352).
    const resp = await fetch(`${STAGING_API}/meta/side-data`, {
      signal: AbortSignal.timeout(STAGING_FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) {
      console.warn(`[e2e] staging /meta/side-data HTTP ${resp.status} — forecast gate disabled for this run`);
      return null;
    }
    forecastAvailableCampaignIdsCache = forecastAvailableCampaignIdsFromSideData(await resp.json());
    return forecastAvailableCampaignIdsCache;
  } catch (error) {
    const detail = error instanceof Error ? error.message || error.name : String(error);
    console.warn(`[e2e] staging /meta/side-data unreachable (${detail}) — forecast gate disabled for this run`);
    return null;
  }
}

// ─── Predicates ──────────────────────────────────────────────────────

function isUsableReserve(r: ReserveData): boolean {
  if (r.isFrozen || r.isPaused || r.isActive === false) return false;
  if (r.supplyDisabled === true) return false;
  return true;
}

function hasLtv(r: ReserveData): boolean {
  const ltv = r.ltv as number | undefined;
  return typeof ltv === 'number' && ltv > 0;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Find a reserve with a computable supply incentive AND ltv > 0 on staging.
 * Used by incentive calculation tests that need real APR data.
 *
 * A campaign qualifies only when the UI can render a numeric percent for it:
 * campaignApr > 0 (or points-based), active time window, and not an AMOUNT
 * variant (AAV-1275). Merit arrays are ignored (Merit retired — AAV-1289).
 * Forecast-requiring campaigns absent from `forecast.items` are skipped too,
 * because their APR does not respond to position size (see
 * `fetchForecastAvailableCampaignIds`).
 * Prefers nonzero supply room, then highest net supply APR.
 * Returns `found` | `data-gap` | `unreachable` — never null (AAV-1352).
 */
export async function findIncentiveReserve(): Promise<ReserveDiscovery<TestReserve>> {
  const [reservesOutcome, forecastAvailableCampaignIds] = await Promise.all([
    fetchStagingReserves(),
    fetchForecastAvailableCampaignIds(),
  ]);
  if (reservesOutcome.status === 'unreachable') return unreachableDiscovery(reservesOutcome);
  const picked = pickIncentiveReserve(reservesOutcome.reserves, new Date().toISOString(), forecastAvailableCampaignIds);
  // NEVER returns null: null would invite `if (!r) test.skip(...)` — the exact
  // false-green shape this ticket removes (AAV-1352 review).
  return picked ? { status: 'found', value: picked } : { status: 'data-gap' };
}

/**
 * Find any active, non-frozen reserve with ltv > 0.
 * Used by UI tests (decimal input, spacing) that don't need incentive data
 * but do need a reserve that can be added to the portfolio.
 *
 * Falls back to common stablecoins (USDC, USDT, WETH) for reliability.
 * Returns `found` | `data-gap` | `unreachable` — never null (AAV-1352).
 */
export async function findAnyActiveReserve(): Promise<ReserveDiscovery<TestReserve>> {
  const outcome = await fetchStagingReserves();
  if (outcome.status === 'unreachable') return unreachableDiscovery(outcome);
  const candidates = outcome.reserves.filter((r) => isUsableReserve(r) && hasLtv(r));
  if (candidates.length === 0) return { status: 'data-gap' };

  // Prefer common stablecoins for UI tests (predictable decimal behavior)
  const preferredSymbols = ['USDC', 'USDT', 'DAI', 'WETH', 'GHO'];
  for (const sym of preferredSymbols) {
    const match = candidates.find((r) => (r.tokenSymbol as string) === sym);
    if (match) return { status: 'found', value: toTestReserve(match) };
  }
  return { status: 'found', value: toTestReserve(candidates[0]) };
}

// ─── Gate enforcement (AAV-1352) ─────────────────────────────────────

/** Gap reasons, single-sourced so skip text stays greppable across specs. */
export const INCENTIVE_RESERVE_GAP_REASON = 'No reserve with incentives + ltv > 0 on staging';
export const ACTIVE_RESERVE_GAP_REASON = 'No active reserve with ltv > 0 found on staging';
export const OFFSET_SCENARIO_GAP_REASON = 'No cross-offset Merkl campaigns found in current staging data';
export const CROSS_ASSET_SCENARIO_GAP_REASON = 'No crossAssetPairing campaigns found in current staging data';

/**
 * The one place the opt-out env is read: a spec cannot forget it, and cannot
 * pass a different value from its sibling (AAV-1352 review).
 */
export function reserveGateFor(discovery: ReserveDiscovery<unknown>, dataGapReason: string): ReserveGate {
  return decideReserveGate(discovery, {
    dataGapReason,
    allowUnreachable: isUnreachableAllowed(process.env),
  });
}

/** The discovered value, or null when the gate will skip/fail. Works for a reserve or a scenario list. */
export function foundValue<T>(discovery: ReserveDiscovery<T>): T | null {
  return discovery.status === 'found' ? discovery.value : null;
}

/**
 * Apply a gate (see `./stagingReservesFetch`).
 *
 * `fail` throws — inside `test.beforeEach` that is a real test failure, unlike
 * `test.fail()` which would mark an expected failure as a pass. Call this in
 * `beforeEach` (reserve-based specs) or in the placeholder test used when a
 * scenario list came back empty (scenario-based specs).
 */
export function enforceReserveGate(gate: ReserveGate): void {
  const effect = gateEffect(gate);
  if (effect.kind === 'throw') throw effect.error;
  if (effect.kind === 'skip') test.skip(true, effect.reason);
}

/**
 * For the placeholder test that only exists because a scenario list is empty.
 *
 * `run` here would mean the gate and the list disagree (the gate is derived
 * from the unfiltered list, the list from a capped/filtered view) — a silent
 * pass that verifies nothing, so it is escalated instead of ignored.
 */
export function enforceEmptyListGate(gate: ReserveGate): void {
  if (gate.action === 'run') {
    throw new Error('discovery gate says run but the scenario list is empty — gate and list disagree');
  }
  enforceReserveGate(gate);
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

// ─── Setup helpers ───────────────────────────────────────────────────

/**
 * Shared setup helper — adds a reserve to portfolio mode and returns the supply input.
 * Works for both dynamically discovered and hardcoded reserves.
 */
export async function setupPortfolioWithReserve(page: Page, reserve: TestReserve): Promise<Locator> {
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
 *
 * AAV-1317: when several markets list the same symbol, the market label is the
 * ONLY disambiguator — falling back to `.first()` would silently add a
 * possibly-wrong reserve and every downstream row-scoped assertion would then
 * chase the wrong row. No match ⇒ explicit false.
 */
export async function addReserveToPortfolio(page: Page, symbol: string, marketLabel: string): Promise<boolean> {
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
  return false;
}

/** Escape a token symbol for use inside a RegExp accessible-name matcher —
 * symbols like "USDC.e" or "USD₮0" carry regex metacharacters. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Accessible-name matcher for a portfolio amount input. The label reads
 * "supply amount for <SYM>" for a fresh position and "supply effective for
 * <SYM>" for a wallet-backed one (PortfolioTablePrimitives.CompactInput).
 * Exported so the cross-asset runner's row-ownership assertions match with
 * the exact same rule the fill helpers use (AAV-1317 review: one matcher,
 * not two copies that can drift).
 */
export function portfolioAmountInputName(side: 'supply' | 'borrow', symbol: string): RegExp {
  return new RegExp(`${side === 'supply' ? 'Supply' : 'Borrow'} (?:amount|effective) for ${escapeRegExp(symbol)}`, 'i');
}

/**
 * Fill ONE reserve row's supply/borrow amount in portfolio mode, desktop and
 * mobile (AAV-1317).
 *
 * The row anchor is `[data-reserve-id]` — the same anchor `readIncentiveAfter`
 * already uses — because a token symbol alone is ambiguous: 59 of the 441
 * staging reserves share their symbol with another reserve (2026-11-15
 * capture), and a symbol-keyed `.first()` types into whichever same-symbol row
 * sorts first. Mobile cards render only the active side's input behind pill
 * tabs, so the helper switches the tab when needed; desktop rows expose both
 * inputs and have no tabs, so the tab step is skipped there.
 */
async function fillPortfolioAmount(
  page: Page,
  reserveId: string,
  side: 'supply' | 'borrow',
  symbol: string,
  amount: string,
) {
  const row = page.locator(`[data-reserve-id="${reserveId}"]`).first();
  await row.waitFor({ state: 'attached', timeout: 10_000 });
  // Ensure the row is in viewport (InkAprCalculator + TopOpportunities push
  // content down, especially on mobile).
  await row.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await page.waitForTimeout(300);
  // Note: Supply/Borrow are role="tab" elements on mobile, not role="button".
  const tab = row.getByRole('tab', { name: side === 'supply' ? 'Supply' : 'Borrow', exact: true });
  if (await tab.isVisible()) {
    if ((await tab.getAttribute('aria-selected')) !== 'true') {
      await tab.click();
      await page.waitForTimeout(300);
    }
  }
  const input = row.getByRole('textbox', { name: portfolioAmountInputName(side, symbol) }).first();
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(amount);
  await page.waitForTimeout(800);
}

export async function fillSupplyAmount(page: Page, reserveId: string, symbol: string, amount: string) {
  await fillPortfolioAmount(page, reserveId, 'supply', symbol, amount);
}

export async function fillBorrowAmountDesktop(page: Page, reserveId: string, symbol: string, amount: string) {
  await fillPortfolioAmount(page, reserveId, 'borrow', symbol, amount);
}

export async function fillBorrowAmountMobile(page: Page, reserveId: string, symbol: string, amount: string) {
  await fillPortfolioAmount(page, reserveId, 'borrow', symbol, amount);
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
    const afterSpan = card.locator(`span[data-cell="${cellName}"] span[data-after]`).first();
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
