import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  INCENTIVE_RESERVE_GAP_REASON,
  findIncentiveReserve,
  foundValue,
  reserveGateFor,
  setupPortfolioWithReserve,
} from './test-reserves';

/**
 * Shared fixtures for the portfolio incentive-calculation specs (AAV-1143).
 *
 * AAV-1395 split the suite into `.desktop` / `.mobile` files so each Playwright
 * project collects only its own tests instead of collecting-then-skipping.
 *
 * Uses data-cell, data-testid, data-current/data-after attributes.
 * Does NOT depend on a wallet address — uses manual entry.
 * Validation is format+existence only, not exact numeric values.
 *
 * Test reserve is dynamically discovered from staging API to avoid
 * breakage when hardcoded tokens lose incentives or change LTV.
 */

export const PERCENT_RE = /-?\d+\.\d{2}%/;
/**
 * `$` amount with the cell's own K/M/B abbreviation.
 *
 * Both the desktop td and the mobile span render `formatSignedReserveSizeUsd`,
 * which switches to `$1.23K` at $1,000 (src/lib/formatters.ts). The $1,000,000
 * position these tests fill puts the daily figure well past that threshold for
 * any high-APR reserve, so the suffix is required, not optional.
 */
export const USD_PER_DAY_RE = /^[+-]?\$[\d,]+(\.\d{2})?([KMB])?$/;

/**
 * Placeholders the two $/day cells use instead of a number:
 * - desktop td: '—' (em dash) when `usdPerDay === 0`
 * - mobile span: '–' (en dash) when there is no result at all
 *
 * A real value never contains either, so waiting for both to disappear is the
 * right "value arrived" signal for either platform.
 */
const USD_PER_DAY_PLACEHOLDERS = ['—', '–'];

// Dynamically discover a reserve with supply incentives AND ltv > 0.
// AAV-1352: an unreachable staging FAILS the live tests; only a real staging
// data gap skips. Conflating the two used to report this whole file green.
const reserveDiscovery = await findIncentiveReserve();
const testReserve = foundValue(reserveDiscovery);
export const reserveGate = reserveGateFor(reserveDiscovery, INCENTIVE_RESERVE_GAP_REASON);

/**
 * Wait for a cell to show a computed value instead of a placeholder.
 *
 * AAV-1299: whitelist (side-data) loads asynchronously, so incentive cells can
 * briefly render a placeholder before recovering; and staging data may drift
 * after discovery (campaign expires / caps fill), leaving it as the stable
 * final state. Wait generously (30s), then skip gracefully instead of failing —
 * mirrors the native-column pattern below.
 *
 * Both platform placeholders are checked (see USD_PER_DAY_PLACEHOLDERS): the
 * desktop cell renders '—' but the mobile cell renders '–', so an em-dash-only
 * guard would be unreachable on mobile and let the assertion below fail hard.
 */
export async function expectValueOrSkip(locator: Locator, label: string, timeout = 30_000) {
  try {
    await expect(async () => {
      const text = (await locator.textContent()) ?? '';
      const placeholder = USD_PER_DAY_PLACEHOLDERS.find((d) => text.includes(d));
      expect(placeholder, `${label} still shows '${placeholder}'`).toBeUndefined();
    }).toPass({ timeout });
  } catch {
    test.skip(true, `${label} stays a placeholder on staging — incentive not computable at test time`);
  }
}

/**
 * Read `data-current` from the metric span inside a cell, skipping when absent.
 *
 * React omits the attribute when `metric.current` is null, and null is a
 * legitimate state (`PortfolioSimulationMetric.current: number | null`), so on
 * staging data the span may not exist at all. `getAttribute` on a locator that
 * never resolves blocks until the test timeout (120s here), so bound the wait
 * with an attach check and skip: with no current value the "current does not
 * change" invariant is not evaluable.
 */
export async function readDataCurrentOrSkip(cell: Locator, label: string): Promise<string> {
  const span = cell.locator('span[data-current]').first();
  try {
    await expect(span).toBeAttached({ timeout: 10_000 });
  } catch {
    test.skip(true, `${label}: no data-current on staging — current value is null, invariant not evaluable`);
  }
  return (await span.getAttribute('data-current')) ?? '';
}

export async function setupPortfolio(page: Page) {
  if (!testReserve) throw new Error('No suitable reserve found');
  return setupPortfolioWithReserve(page, testReserve);
}
