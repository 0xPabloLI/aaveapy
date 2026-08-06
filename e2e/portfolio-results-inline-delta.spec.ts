import { expect, test, type Page } from '@playwright/test';
import { findIncentiveReserve, setupPortfolioWithReserve } from './test-reserves';

/**
 * Portfolio ResultsTable inline delta regression.
 *
 * After adding a position and entering an amount that shifts the simulated rate,
 * the ResultsTable must show inline delta badges (e.g. "+$88.35") in the
 * Earn $/day column, and the SummaryCard must show delta next to
 * Total Supply / Net Daily Earn / Net Effective APY.
 *
 * This test does NOT depend on a wallet address — it uses manual entry.
 * Test reserve is dynamically discovered from staging API.
 */

const testReserve = await findIncentiveReserve();

async function setupPortfolio(page: Page) {
  if (!testReserve) throw new Error('No suitable reserve found');
  return setupPortfolioWithReserve(page, testReserve);
}

test.describe('Portfolio ResultsTable — inline delta', () => {
  test.describe('desktop', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name.includes('mobile'), 'Desktop table only');
      test.skip(!testReserve, 'No reserve with incentives + ltv > 0 on staging');
    });

    test('shows inline delta badges after manual position input', async ({ page }) => {
      const supplyInput = await setupPortfolio(page);
      await supplyInput.fill('1000000');

      const resultsTable = page.locator('table').filter({ hasText: 'Reserve' }).filter({ hasText: 'Native' });
      await expect(resultsTable).toBeVisible({ timeout: 5000 });

      const deltaBadge = resultsTable.locator('td').filter({ hasText: /^[+-]\$/ }).first();
      await expect(deltaBadge).toBeVisible({ timeout: 5000 });
    });

    // AAV-1150: SummaryCard DOM selector needs investigation
    test.skip('SummaryCard shows delta when simulation is active', async ({ page }) => {
      const supplyInput = await setupPortfolio(page);
      await supplyInput.fill('1000000');

      const summaryCard = page.locator('div.grid').filter({ hasText: 'Total Supply' }).filter({ hasText: 'Net Daily Earn' });
      await expect(summaryCard).toBeVisible({ timeout: 5000 });

      const summaryDelta = summaryCard.locator('span').filter({ hasText: /^\+?\-?\$[0-9]/ }).first();
      await expect(summaryDelta).toBeVisible({ timeout: 5000 });
    });

    test('delta badges disappear when amount is cleared', async ({ page }) => {
      const supplyInput = await setupPortfolio(page);
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
