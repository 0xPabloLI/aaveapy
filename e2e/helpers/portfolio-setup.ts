import { expect, type Page } from '@playwright/test';

/**
 * Shared setup helper for Portfolio E2E tests.
 *
 * Navigates to the dashboard, switches to Portfolio mode, searches for
 * the given token symbol, adds it to the portfolio, and returns the
 * supply input element.
 */
export async function setupPortfolioWithReserve(page: Page, symbol = 'USDC') {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible();
  await page.getByTestId('portfolio-mode-toggle').click();
  await page.getByRole('button', { name: 'Search tokens' }).click();
  await page.getByRole('textbox', { name: 'Search tokens to add' }).fill(symbol);
  const addBtn = page
    .getByRole('button', { name: /^Add .+ \(supply and borrow\)$/ })
    .first();
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  const supplyInput = page
    .getByRole('textbox', { name: new RegExp(`Supply amount for ${symbol}`, 'i') })
    .first();
  await expect(supplyInput).toBeVisible();
  return supplyInput;
}

export const PERCENT_RE = /\-?\d+\.\d{2}%/;
export const USD_PER_DAY_RE = /^[+-]?\$[\d,]+(\.\d{2})?$/;
