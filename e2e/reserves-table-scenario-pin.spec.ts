import { expect, test } from '@playwright/test';

async function waitDesktopTable(page: Parameters<typeof test>[0]['page']) {
  await expect(page.locator('tbody tr[data-reserve-id]').first()).toBeVisible();
}

async function getPinnedTopY(page: Parameters<typeof test>[0]['page']): Promise<number> {
  const scenario = page.locator('[data-reserves-sticky-scenario]').first();
  const thead = page.locator('[data-reserves-sticky-thead]').first();
  let maxBottom = 0;
  if ((await scenario.count()) > 0) {
    const box = await scenario.boundingBox();
    if (box) maxBottom = Math.max(maxBottom, box.y + box.height);
  }
  if ((await thead.count()) > 0) {
    const box = await thead.boundingBox();
    if (box) maxBottom = Math.max(maxBottom, box.y + box.height);
  }
  return maxBottom > 0 ? maxBottom + 8 : 16;
}

test.describe('Scenario input pin scroll (desktop)', () => {
  test.beforeEach(async ({ page: _page }, testInfo) => {
    test.skip(
      testInfo.project.name.includes('mobile'),
      'Pin scroll is desktop-specific',
    );
  });

  test('expanded row stays pinned after second scenario input reorders list', async ({ page }) => {
    await page.goto('/');
    await waitDesktopTable(page);

    // Step 1: Enter supply=100
    const supplyInput = page.locator('[data-reserves-sticky-scenario] input[aria-label="Supply amount"]');
    await supplyInput.fill('100');
    await page.waitForTimeout(900); // debounce

    // Step 2: Expand a row (pick the 3rd visible row so it's likely to move on re-sort)
    const rows = page.locator('tbody tr[data-reserve-id]');
    const rowCount = await rows.count();
    const targetIndex = Math.min(2, rowCount - 1);
    const targetRow = rows.nth(targetIndex);
    const reserveId = await targetRow.getAttribute('data-reserve-id');
    if (!reserveId) throw new Error(`Missing data-reserve-id at index ${targetIndex}`);

    await targetRow.scrollIntoViewIfNeeded();
    await targetRow.click();
    await expect(targetRow).toHaveClass(/bg-muted\/30/);
    await page.waitForTimeout(500);

    // Step 3: Enter borrow=100 — this triggers scenario change and potential re-sort
    const borrowInput = page.locator('[data-reserves-sticky-scenario] input[aria-label="Borrow amount"]');
    await borrowInput.fill('100');

    // Assert: expanded row must stay visible and pin-scroll to the sticky band
    const expandedRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"]`);
    await expect(expandedRow).toBeVisible({ timeout: 5000 });

    const pinnedTopY = await getPinnedTopY(page);

    // Poll until the row settles near the pin band (debounce + scroll animation)
    await expect
      .poll(async () => {
        const b = await expandedRow.boundingBox();
        return b ? b.y : Number.POSITIVE_INFINITY;
      }, { timeout: 6000, message: 'expanded row should pin near sticky band after scenario input' })
      .toBeLessThanOrEqual(pinnedTopY + 24);
  });
});
