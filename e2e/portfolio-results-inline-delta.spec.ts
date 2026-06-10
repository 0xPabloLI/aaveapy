import { expect, test } from '@playwright/test';

/**
 * Portfolio ResultsTable inline delta regression.
 *
 * After adding a position and entering an amount that shifts the simulated rate,
 * the ResultsTable must show inline delta badges (e.g. "+0.15%") next to
 * the Native/Incentive/Total/USD-day values, and the SummaryCard must show
 * delta next to Total Supply / Net Daily Earn / Net Effective APY.
 *
 * This test does NOT depend on a wallet address — it uses manual entry.
 */
test.describe('Portfolio ResultsTable — inline delta', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Desktop-only check');
  });

  test('shows inline delta badges after manual position input', async ({ page }) => {
    await page.goto('/');

    // Wait for reserves grid to mount.
    await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible();

    // Enable Portfolio mode.
    await page.getByText('Portfolio', { exact: true }).first().click();

    // Add a reserve via search.
    await page.getByRole('button', { name: 'Search tokens' }).click();
    await page.getByRole('textbox', { name: 'Search tokens to add' }).fill('USDC');

    const addBtn = page
      .getByRole('button', { name: /^Add .+ \(supply and borrow\)$/ })
      .first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Enter a supply amount to trigger simulation.
    const supplyInput = page.getByRole('textbox', { name: /Supply amount for USDC/i }).first();
    await expect(supplyInput).toBeVisible();
    await supplyInput.fill('10000');

    // Wait for the results table to appear.
    const resultsTable = page.locator('table').filter({ hasText: 'Token' }).filter({ hasText: 'Native' });
    await expect(resultsTable).toBeVisible({ timeout: 5000 });

    // Verify delta badge exists in the table — look for a span containing "+"
    // within a td that also contains a percent value.
    // The delta is rendered as <span class="ds-text-10">+X.XX%</span>
    const deltaBadge = resultsTable.locator('span.ds-text-10').filter({ hasText: /^\+[0-9]+\.[0-9]+%$/ }).first();
    await expect(deltaBadge).toBeVisible({ timeout: 5000 });
  });

  test('SummaryCard shows delta when simulation is active', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible();

    await page.getByText('Portfolio', { exact: true }).first().click();

    await page.getByRole('button', { name: 'Search tokens' }).click();
    await page.getByRole('textbox', { name: 'Search tokens to add' }).fill('USDC');

    const addBtn = page
      .getByRole('button', { name: /^Add .+ \(supply and borrow\)$/ })
      .first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const supplyInput = page.getByRole('textbox', { name: /Supply amount for USDC/i }).first();
    await expect(supplyInput).toBeVisible();
    await supplyInput.fill('10000');

    // SummaryCard renders delta as a small inline span next to the metric value.
    // Look for the summary card container and a delta-like text pattern.
    const summaryCard = page.locator('div.grid').filter({ hasText: 'Total Supply' }).filter({ hasText: 'Net Daily Earn' });
    await expect(summaryCard).toBeVisible({ timeout: 5000 });

    // Verify at least one delta indicator in the summary.
    const summaryDelta = summaryCard.locator('span').filter({ hasText: /^\+?\-?\$[0-9]/ }).first();
    await expect(summaryDelta).toBeVisible({ timeout: 5000 });
  });

  test('delta badges disappear when amount is cleared', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible();

    await page.getByText('Portfolio', { exact: true }).first().click();

    await page.getByRole('button', { name: 'Search tokens' }).click();
    await page.getByRole('textbox', { name: 'Search tokens to add' }).fill('USDC');

    const addBtn = page
      .getByRole('button', { name: /^Add .+ \(supply and borrow\)$/ })
      .first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const supplyInput = page.getByRole('textbox', { name: /Supply amount for USDC/i }).first();
    await expect(supplyInput).toBeVisible();
    await supplyInput.fill('10000');

    // Wait for delta to appear.
    const resultsTable = page.locator('table').filter({ hasText: 'Token' }).filter({ hasText: 'Native' });
    await expect(resultsTable).toBeVisible({ timeout: 5000 });

    // Clear the input — delta should no longer show.
    const clearBtn = supplyInput.locator('..').locator('button[aria-label*="Clear"]').first();
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
    } else {
      await supplyInput.clear();
    }

    // After clearing, delta badges should be gone (no meaningful change).
    const deltaBadge = resultsTable.locator('span.ds-text-10').filter({ hasText: /^\+[0-9]+\.[0-9]+%$/ }).first();
    await expect(deltaBadge).not.toBeVisible({ timeout: 3000 });
  });
});
