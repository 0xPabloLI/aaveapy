import { expect, test } from '@playwright/test';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function pickAlternateVisibleMarket(
  page: Parameters<typeof test>[0]['page'],
  selectedMarket: string,
): Promise<string | null> {
  const allButtons = page.getByRole('button');
  const count = await allButtons.count();
  for (let i = 0; i < count; i += 1) {
    const button = allButtons.nth(i);
    if (!(await button.isVisible())) continue;
    const label = ((await button.textContent()) ?? '').trim();
    if (!label || label === 'All') continue;
    if (label === selectedMarket) continue;

    const className = (await button.getAttribute('class')) ?? '';
    if (!className.includes('rounded-full')) continue;

    return label;
  }

  return null;
}

async function waitForTableReady(page: Parameters<typeof test>[0]['page']) {
  await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible();
  await expect(page.locator('tbody tr[data-reserve-id]').first()).toBeVisible();
}

async function expandFirstRow(page: Parameters<typeof test>[0]['page']): Promise<string> {
  const firstRow = page.locator('tbody tr[data-reserve-id]').first();
  const reserveId = await firstRow.getAttribute('data-reserve-id');
  if (!reserveId) {
    throw new Error('Cannot read data-reserve-id from first row');
  }

  await firstRow.click();
  await expect(firstRow).toHaveClass(/bg-muted\/30/);
  await expect(page.locator(`tbody tr[data-reserve-id="${reserveId}"] + tr`)).toHaveCount(1);
  return reserveId;
}

async function expectExpandedRowInViewport(
  page: Parameters<typeof test>[0]['page'],
  reserveId: string,
) {
  const expandedRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"]`);
  await expect(expandedRow).toHaveClass(/bg-muted\/30/);
  await expect(page.locator(`tbody tr[data-reserve-id="${reserveId}"] + tr`)).toHaveCount(1);

  const box = await expandedRow.boundingBox();
  if (!box) {
    throw new Error(`Expanded row ${reserveId} has no bounding box`);
  }
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeLessThan(1100);
}

test.describe('Reserves table interaction matrix', () => {
  test.beforeEach(async ({ page: _page }, testInfo) => {
    test.skip(
      testInfo.project.name.includes('mobile'),
      'Desktop table matrix only',
    );
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForTableReady(page);
  });

  test('keeps expanded row when scenario input reshuffles order', async ({ page }) => {
    const expandedReserveId = await expandFirstRow(page);

    const borrowInput = page.getByRole('textbox', { name: 'Borrow amount' });
    await borrowInput.fill('250000');

    // Shared scenario inputs are debounced, so expansion should survive delayed resort.
    await page.waitForTimeout(900);

    const expandedRow = page.locator(`tbody tr[data-reserve-id="${expandedReserveId}"]`);
    await expect(expandedRow).toHaveClass(/bg-muted\/30/);
    await expect(page.locator(`tbody tr[data-reserve-id="${expandedReserveId}"] + tr`)).toHaveCount(1);
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
    const expandedAfterSameMarket = page.locator('tbody tr[data-reserve-id].bg-muted\\/30');
    await expect(expandedAfterSameMarket).toHaveCount(1);
    const expandedAfterSameMarketId = await expandedAfterSameMarket.first().getAttribute('data-reserve-id');
    if (!expandedAfterSameMarketId) {
      throw new Error('Cannot read expanded reserve id after same-market filter');
    }
    await expect(page.locator(`tbody tr[data-reserve-id="${expandedAfterSameMarketId}"] + tr`)).toHaveCount(1);

    const fallbackMarkets = [
      'Arbitrum', 'Avalanche', 'Base', 'BSC', 'Celo', 'Gnosis', 'Ink', 'Linea',
      'Mantle', 'MegaETH', 'Optimism', 'Plasma', 'Polygon', 'Scroll', 'Sonic', 'Core', 'Prime',
    ];
    const alternateMarket = (await pickAlternateVisibleMarket(page, selectedMarket))
      ?? fallbackMarkets.find((m) => m !== selectedMarket)
      ?? null;
    if (!alternateMarket) {
      throw new Error('No alternate market candidate found');
    }

    // Switch to a different market chip in the top filter bar.
    const alternateCandidates = page.getByRole('button', { name: new RegExp(escapeRegExp(alternateMarket), 'i') });
    const alternateCandidateCount = await alternateCandidates.count();
    let clickedAlternate = false;
    for (let i = 0; i < alternateCandidateCount; i += 1) {
      const candidate = alternateCandidates.nth(i);
      const label = (await candidate.getAttribute('aria-label')) ?? (await candidate.textContent()) ?? '';
      if (!label.toLowerCase().includes('filter by') && (await candidate.isVisible())) {
        await candidate.click();
        clickedAlternate = true;
        break;
      }
    }
    if (!clickedAlternate) {
      throw new Error(`Cannot find top-bar market chip for ${alternateMarket}`);
    }

    // After cross-market interactions, expanded state must be coherent (no dangling expanded UI).
    const expandedRowsAfterSwitch = page.locator('tbody tr[data-reserve-id].bg-muted\\/30');
    const expandedRowCount = await expandedRowsAfterSwitch.count();
    const expandedSubRowCount = await page.locator('tbody tr[data-reserve-id].bg-muted\\/30 + tr').count();
    expect(expandedRowCount).toBeLessThanOrEqual(1);
    expect(expandedSubRowCount).toBe(expandedRowCount);
    await expect(page.locator('tbody tr[data-reserve-id]').first()).toBeVisible();
  });

  test('search filter cleanup removes stale expanded state', async ({ page }) => {
    await expandFirstRow(page);

    const searchInput = page.getByRole('textbox', { name: 'Search token' });
    await searchInput.fill('__no_match_for_e2e__');

    await expect(page.locator('tbody tr[data-reserve-id].bg-muted\\/30')).toHaveCount(0);
    await expect(page.locator('tbody tr[data-reserve-id] + tr')).toHaveCount(0);
    await expect(page.locator('tbody tr[data-reserve-id]')).toHaveCount(0);
  });

  test('market chip toggle keeps expanded row visible when applying and clearing same filter', async ({ page }) => {
    const reserveId = await expandFirstRow(page);

    const rowMarketButton = page.locator('tbody button[aria-label^="Filter by "]').first();
    await rowMarketButton.click();
    await page.waitForTimeout(450);
    await expectExpandedRowInViewport(page, reserveId);

    // Click the same row chip again to clear that market filter.
    const sameRowMarketButton = page.locator(`tbody tr[data-reserve-id="${reserveId}"] button[aria-label^="Filter by "]`).first();
    await sameRowMarketButton.click();
    await page.waitForTimeout(450);
    await expectExpandedRowInViewport(page, reserveId);
  });

  test('AAV-1107: chain filter → expand → unfilter does not leave scroll spacer', async ({ page }) => {
    // 1. Select a chain filter (e.g., Celo) to reduce to a small set
    const chainChip = page.locator('button:has-text("Celo")').first();
    await chainChip.click();
    await page.waitForTimeout(1000);
    const filteredRows = page.locator('tbody tr[data-reserve-id]');
    await expect(filteredRows.first()).toBeVisible();

    // 2. Expand a reserve in the filtered view
    await expandFirstRow(page);

    // 3. Remove the chain filter (unfilter) → all reserves shown
    await chainChip.click();
    await page.waitForTimeout(1000);

    // 4. Verify no scroll spacer is rendered (the bug was: spacer stayed,
    //    creating ~1400px blank space at the bottom)
    const scrollSpacer = page.locator('[data-testid="reserves-expanded-scroll-spacer"]');
    await expect(scrollSpacer).toHaveCount(0);
  });
});
