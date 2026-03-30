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

async function expectRowPinnedNearStickyBand(
  page: Parameters<typeof test>[0]['page'],
  reserveId: string,
  label: string,
) {
  const expandedRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"]`);
  await expect(expandedRow).toBeVisible({ timeout: 10_000 });

  const pinnedTopY = await getPinnedTopY(page);
  await expect
    .poll(
      async () => {
        const b = await expandedRow.boundingBox();
        return b ? b.y : Number.POSITIVE_INFINITY;
      },
      { timeout: 9_000, message: label },
    )
    .toBeLessThanOrEqual(pinnedTopY + 24);
}

async function getVisibleReserveOrder(page: Parameters<typeof test>[0]['page']): Promise<string[]> {
  return page.locator('tbody tr[data-reserve-id]').evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-reserve-id') ?? '').filter((id) => id.length > 0),
  );
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
    await expectRowPinnedNearStickyBand(
      page,
      reserveId,
      'expanded row should pin near sticky band after scenario input',
    );
  });

  test('expanded row remains pinned after repeated alternating scenario edits', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('/');
    await waitDesktopTable(page);

    const supplyInput = page.locator('[data-reserves-sticky-scenario] input[aria-label="Supply amount"]');
    const borrowInput = page.locator('[data-reserves-sticky-scenario] input[aria-label="Borrow amount"]');

    await supplyInput.fill('100');
    await page.waitForTimeout(900); // debounce

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

    const steps = [
      { supply: '250', borrow: '0' },
      { supply: '0', borrow: '250' },
      { supply: '1000', borrow: '150' },
      { supply: '80', borrow: '1200' },
      { supply: '30000', borrow: '50' },
      { supply: '40', borrow: '45000' },
      { supply: '700', borrow: '700' },
      { supply: '150000', borrow: '900' },
    ];

    let orderChangedAssertCount = 0;
    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i];
      const beforeOrder = await getVisibleReserveOrder(page);
      await supplyInput.fill(step.supply);
      await borrowInput.fill(step.borrow);
      // Match production debounce (plus render/pin scheduling buffer).
      await page.waitForTimeout(1100);
      const afterOrder = await getVisibleReserveOrder(page);
      const orderChanged =
        beforeOrder
          .slice(0, Math.min(beforeOrder.length, afterOrder.length))
          .some((id, idx) => id !== afterOrder[idx]);
      if (orderChanged) {
        orderChangedAssertCount += 1;
        await expectRowPinnedNearStickyBand(
          page,
          reserveId,
          `expanded row should stay pinned after repeated scenario edit #${i + 1}`,
        );
      }
      // Allow smooth scroll to settle before next update.
      await page.waitForTimeout(260);
    }

    expect(orderChangedAssertCount, 'expected at least two scenario edits to reorder visible reserves').toBeGreaterThanOrEqual(2);
  });
});
