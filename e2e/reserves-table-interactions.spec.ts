import { expect, test } from '@playwright/test';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function waitForTableReady(page: Parameters<typeof test>[0]['page']) {
  await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Expand reserve details/i }).first()).toBeVisible();
}

async function expandFirstRow(page: Parameters<typeof test>[0]['page']) {
  await page.getByRole('button', { name: /Expand reserve details/i }).first().click();
  await expect(page.getByRole('button', { name: /Collapse reserve details/i })).toHaveCount(1);
}

test.describe('Reserves table interaction matrix', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForTableReady(page);
  });

  test('keeps expanded row when scenario input reshuffles order', async ({ page }) => {
    await expandFirstRow(page);

    const borrowInput = page.getByRole('textbox', { name: 'Borrow amount' });
    await borrowInput.fill('250000');

    // Shared scenario inputs are debounced, so expansion should survive delayed resort.
    await page.waitForTimeout(900);

    const collapseButton = page.getByRole('button', { name: /Collapse reserve details/i });
    await expect(collapseButton).toHaveCount(1);
    await expect(collapseButton).toBeVisible();
  });

  test('market filter preserves expansion for same market and clears when switching market', async ({ page }) => {
    await expandFirstRow(page);

    const rowMarketButton = page.locator('tbody button[aria-label^="Filter by "]').first();
    const rowMarketLabel = await rowMarketButton.getAttribute('aria-label');
    if (!rowMarketLabel) {
      throw new Error('Cannot read row market aria-label');
    }
    const rowMarketMatch = rowMarketLabel.match(/^Filter by (.+) market$/);
    if (!rowMarketMatch) {
      throw new Error(`Unexpected row market label format: ${rowMarketLabel}`);
    }
    const selectedMarket = rowMarketMatch[1];

    // Click row market badge -> table filters to the same market as expanded row.
    await rowMarketButton.click();
    await expect(page.getByRole('button', { name: /Collapse reserve details/i })).toHaveCount(1);

    const fallbackMarkets = [
      'Arbitrum', 'Avalanche', 'Base', 'BSC', 'Celo', 'Gnosis', 'Ink', 'Linea',
      'Mantle', 'MegaETH', 'Optimism', 'Plasma', 'Polygon', 'Scroll', 'Sonic', 'Core', 'Prime',
    ];
    const alternateMarket = fallbackMarkets.find((m) => m !== selectedMarket);
    if (!alternateMarket) {
      throw new Error('No alternate market candidate found');
    }

    // Switch to a different market chip in the top filter bar.
    await page.getByRole('button', { name: new RegExp(`^${escapeRegExp(alternateMarket)}$`) }).first().click();

    // Expanded row from previous market should be automatically cleaned up.
    await expect(page.getByRole('button', { name: /Collapse reserve details/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Expand reserve details/i }).first()).toBeVisible();
  });

  test('search filter cleanup removes stale expanded state', async ({ page }) => {
    await expandFirstRow(page);

    const searchInput = page.getByRole('textbox', { name: 'Search token' });
    await searchInput.fill('__no_match_for_e2e__');

    await expect(page.getByRole('button', { name: /Collapse reserve details/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Expand reserve details/i })).toHaveCount(0);
  });
});
