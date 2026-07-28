import { expect, test } from '@playwright/test';

/**
 * Portfolio ResultsTable inline delta regression.
 *
 * After adding a position and entering an amount that shifts the simulated rate,
 * the ResultsTable must show inline delta badges (e.g. "+$88.35") in the
 * Earn $/day column, and the SummaryCard must show delta next to
 * Total Supply / Net Daily Earn / Net Effective APY.
 *
 * This test does NOT depend on a wallet address — it uses manual entry.
 * Desktop-only — routed via mobile-chromium `testIgnore` in playwright.config.ts.
 */

async function setupPortfolioWithReserve(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible();
  await page.getByTestId('portfolio-mode-toggle').click();
  await page.getByRole('button', { name: 'Search tokens' }).click();
  await page.getByRole('textbox', { name: 'Search tokens to add' }).fill('USDC');
  const addBtn = page
    .getByRole('button', { name: /^Add .+ \(supply and borrow\)$/ })
    .first();
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  const supplyInput = page.getByRole('textbox', { name: /Supply amount for USDC/i }).first();
  await expect(supplyInput).toBeVisible();
  return supplyInput;
}

test.describe('Portfolio ResultsTable — inline delta', () => {
  test('shows inline delta badges after manual position input', async ({ page }) => {
    const supplyInput = await setupPortfolioWithReserve(page);
    await supplyInput.fill('1000000');

    const resultsTable = page.locator('table').filter({ hasText: 'Reserve' }).filter({ hasText: 'Native' });
    await expect(resultsTable).toBeVisible({ timeout: 5000 });

    const deltaBadge = resultsTable.locator('td').filter({ hasText: /^[+-]\$/ }).first();
    await expect(deltaBadge).toBeVisible({ timeout: 5000 });
  });

  // AAV-1150: SummaryCard DOM selector needs investigation
  test.skip('SummaryCard shows delta when simulation is active', async ({ page }) => {
    const supplyInput = await setupPortfolioWithReserve(page);
    await supplyInput.fill('1000000');

    const summaryCard = page.locator('div.grid').filter({ hasText: 'Total Supply' }).filter({ hasText: 'Net Daily Earn' });
    await expect(summaryCard).toBeVisible({ timeout: 5000 });

    const summaryDelta = summaryCard.locator('span').filter({ hasText: /^\+?\-?\$[0-9]/ }).first();
    await expect(summaryDelta).toBeVisible({ timeout: 5000 });
  });

  test('delta badges disappear when amount is cleared', async ({ page }) => {
    const supplyInput = await setupPortfolioWithReserve(page);
    await supplyInput.fill('1000000');

    const resultsTable = page.locator('table').filter({ hasText: 'Reserve' }).filter({ hasText: 'Native' });
    await expect(resultsTable).toBeVisible({ timeout: 5000 });

    const clearBtn = supplyInput.locator('..').locator('button[aria-label*="Clear"]').first();
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
    } else {
      await supplyInput.clear();
    }

    const deltaBadge = resultsTable.locator('td').filter({ hasText: /^[+-]\$/ }).first();
    await expect(deltaBadge).not.toBeVisible({ timeout: 3000 });
  });
});
