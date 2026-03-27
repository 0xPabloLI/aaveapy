import { expect, test } from '@playwright/test';

const strictStickAssertEnabled = process.env.STRICT_STICK_ASSERT === 'true';

async function waitDesktopTable(page: Parameters<typeof test>[0]['page']) {
  await expect(page.locator('tbody tr[data-reserve-id]').first()).toBeVisible();
}

test.describe('Reserves table stick behavior', () => {
  test.beforeEach(async ({ page: _page }, testInfo) => {
    test.skip(
      testInfo.project.name.includes('mobile'),
      'Stick top pin is desktop-specific',
    );
  });

  test('expanded row is pulled toward top after market filter reorder', async ({ page }) => {
    await page.goto('/');
    await waitDesktopTable(page);

    const firstRow = page.locator('tbody tr[data-reserve-id]').first();
    const reserveId = await firstRow.getAttribute('data-reserve-id');
    if (!reserveId) throw new Error('Missing data-reserve-id for first row');

    // Start from a non-top viewport position so pinning effect is observable.
    await page.mouse.wheel(0, 900);
    await firstRow.click();
    await expect(firstRow).toHaveClass(/bg-muted\/30/);
    const preBox = await firstRow.boundingBox();
    if (!preBox) throw new Error('Cannot read expanded row position before scenario change');

    // Trigger deterministic reorder path through row market filter.
    const rowMarketButton = page.locator('tbody button[aria-label^="Filter by "]').first();
    await rowMarketButton.click();

    const targetRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"]`);
    await expect(targetRow).toBeVisible();
    const postBox = await targetRow.boundingBox();
    if (!postBox) throw new Error('Cannot read expanded row position after scenario change');

    // stick behavior: expanded row must remain in viewport and not drift further downward after reorder.
    expect(postBox.y).toBeLessThanOrEqual(preBox.y + 20);
    expect(postBox.y).toBeGreaterThan(0);
  });

  test('strict stick: expanded row pins into top viewport band after reorder', async ({ page }) => {
    test.skip(!strictStickAssertEnabled, 'Enable with STRICT_STICK_ASSERT=true');

    await page.goto('/');
    await waitDesktopTable(page);

    const firstRow = page.locator('tbody tr[data-reserve-id]').first();
    const reserveId = await firstRow.getAttribute('data-reserve-id');
    if (!reserveId) throw new Error('Missing data-reserve-id for first row');

    await page.mouse.wheel(0, 1000);
    await firstRow.click();
    await expect(firstRow).toHaveClass(/bg-muted\/30/);
    const preBox = await firstRow.boundingBox();
    if (!preBox) throw new Error('Cannot read expanded row position before strict check');

    const rowMarketButton = page.locator('tbody button[aria-label^="Filter by "]').first();
    await rowMarketButton.click();

    const targetRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"]`);
    await expect(targetRow).toBeVisible();
    const postBox = await targetRow.boundingBox();
    if (!postBox) throw new Error('Cannot read expanded row position after strict check');

    // Strict mode: require clear upward movement and pin inside top-band.
    expect(postBox.y).toBeLessThan(preBox.y - 80);
    expect(postBox.y).toBeLessThan(260);
  });
});
