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
 */

/** Token + market to use for portfolio tests — must have supply incentives on staging (AAV-1250 E2E fix). */
const PORTFOLIO_TEST_TOKEN = 'GHO';
const PORTFOLIO_TEST_MARKET = 'Monad';

async function setupPortfolioWithReserve(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible();
  await page.getByTestId('portfolio-mode-toggle').click();
  await page.getByRole('button', { name: 'Search tokens' }).click();
  await page.getByRole('textbox', { name: 'Search tokens to add' }).fill(PORTFOLIO_TEST_TOKEN);
  await page.waitForTimeout(500);
  const addButtons = page.getByRole('button', {
    name: `Add ${PORTFOLIO_TEST_TOKEN} (supply and borrow)`,
  });
  const count = await addButtons.count();
  if (count === 0) throw new Error(`No Add button found for ${PORTFOLIO_TEST_TOKEN}`);
  let clicked = false;
  for (let i = 0; i < count; i++) {
    const btn = addButtons.nth(i);
    const text = await btn.textContent();
    if (text && text.includes(PORTFOLIO_TEST_MARKET)) {
      await btn.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) await addButtons.first().click();
  const supplyInput = page.getByRole('textbox', { name: new RegExp(`Supply amount for ${PORTFOLIO_TEST_TOKEN}`, 'i') }).first();
  await expect(supplyInput).toBeVisible();
  return supplyInput;
}

test.describe('Portfolio ResultsTable — inline delta', () => {
  test.describe('desktop', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop table only');
    });

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
});
