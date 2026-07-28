import { expect, test } from '@playwright/test';

async function waitDesktopTable(page: Parameters<typeof test>[0]['page']) {
  await expect(page.locator('tbody tr[data-reserve-id]').first()).toBeVisible();
}

async function getPinnedTopY(page: Parameters<typeof test>[0]['page']): Promise<number> {
  const scenario = page.locator('[data-reserves-sticky-scenario]').first();
  const firstStickyHeader = page.locator('[data-reserves-sticky-thead] th').first();
  const scenarioCount = await scenario.count();
  const headerCount = await firstStickyHeader.count();
  let maxBottom = 0;
  if (scenarioCount > 0) {
    const box = await scenario.boundingBox();
    if (box) maxBottom = Math.max(maxBottom, box.y + box.height);
  }
  if (headerCount > 0) {
    const box = await firstStickyHeader.boundingBox();
    if (box) maxBottom = Math.max(maxBottom, box.y + box.height);
  }
  return maxBottom > 0 ? maxBottom + 8 : 16;
}

function marketChipForReserve(page: Parameters<typeof test>[0]['page'], reserveId: string) {
  return page.locator(`tbody tr[data-reserve-id="${reserveId}"] button[aria-label^="Filter by "]`);
}

async function getRowTopY(
  page: Parameters<typeof test>[0]['page'],
  reserveId: string,
): Promise<number> {
  const row = page.locator(`tbody tr[data-reserve-id="${reserveId}"]`);
  const box = await row.boundingBox();
  return box?.y ?? -1;
}

async function scrollExpandedRowOffPinAnchor(
  page: Parameters<typeof test>[0]['page'],
  reserveId: string,
  minAbsDeltaPx = 7,
): Promise<void> {
  const simulationRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"] + tr`);
  await expect(simulationRow).toBeVisible();
  // Let smooth pin scroll from expand finish before we move off the pin band.
  await page.waitForTimeout(2200);
  await simulationRow.evaluate((el) => {
    el.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'instant' });
  });
  await page.waitForTimeout(120);
  for (let i = 0; i < 22; i++) {
    const pinned = await getPinnedTopY(page);
    const y = await getRowTopY(page, reserveId);
    if (Math.abs(y - pinned) > minAbsDeltaPx) return;
    await page.evaluate(() => window.scrollBy(0, -220));
    await page.waitForTimeout(40);
  }
  const pinned = await getPinnedTopY(page);
  const y = await getRowTopY(page, reserveId);
  if (Math.abs(y - pinned) <= minAbsDeltaPx) {
    throw new Error(
      `Could not scroll expanded row off pin anchor (y=${y}, pinned=${pinned})`,
    );
  }
}

async function scrollExpandedRowIntoAnchorBand(
  page: Parameters<typeof test>[0]['page'],
  reserveId: string,
  pinnedTopY: number,
  tolerancePx = 12,
): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(80);
  for (let i = 0; i < 40; i++) {
    const y = await getRowTopY(page, reserveId);
    if (y >= 0 && y <= pinnedTopY + tolerancePx) return;
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(30);
  }
  const finalY = await getRowTopY(page, reserveId);
  if (finalY !== -1 && finalY <= pinnedTopY + 24) return;
  throw new Error('Could not scroll expanded row into anchor band');
}

async function assertExpandedRowPinnedToAnchor(
  page: Parameters<typeof test>[0]['page'],
  reserveId: string,
): Promise<void> {
  const targetRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"]`);
  await expect(targetRow).toBeVisible();
  const pinnedTopY = await getPinnedTopY(page);
  await expect
    .poll(async () => {
      const box = await targetRow.boundingBox();
      return box ? box.y : Number.POSITIVE_INFINITY;
    }, { timeout: 4500 })
    .toBeLessThanOrEqual(pinnedTopY + 12);
  const finalBox = await targetRow.boundingBox();
  if (!finalBox) throw new Error('Cannot read expanded row position after pin assert');
  expect(finalBox.y).toBeLessThanOrEqual(pinnedTopY + 12);
}

test.describe('Market filter pin scroll (desktop)', () => {
  test('(1) not at anchor → apply market filter → pins to top anchor', async ({ page }) => {
    await page.goto('/');
    await waitDesktopTable(page);

    const firstRow = page.locator('tbody tr[data-reserve-id]').first();
    const reserveId = await firstRow.getAttribute('data-reserve-id');
    if (!reserveId) throw new Error('Missing data-reserve-id for first row');

    await firstRow.click();
    await expect(firstRow).toHaveClass(/bg-muted\/30/);

    await scrollExpandedRowOffPinAnchor(page, reserveId);

    await marketChipForReserve(page, reserveId).click();

    await assertExpandedRowPinnedToAnchor(page, reserveId);
  });

  test('(2) not at anchor → cancel market filter → pins to top anchor', async ({ page }) => {
    await page.goto('/');
    await waitDesktopTable(page);

    const firstRow = page.locator('tbody tr[data-reserve-id]').first();
    const reserveId = await firstRow.getAttribute('data-reserve-id');
    if (!reserveId) throw new Error('Missing data-reserve-id for first row');

    await firstRow.click();
    await expect(firstRow).toHaveClass(/bg-muted\/30/);

    await marketChipForReserve(page, reserveId).click();

    await scrollExpandedRowOffPinAnchor(page, reserveId);

    await marketChipForReserve(page, reserveId).click();

    await assertExpandedRowPinnedToAnchor(page, reserveId);
  });

  test('(3) at anchor → apply market filter → pins to top anchor', async ({ page }) => {
    await page.goto('/');
    await waitDesktopTable(page);

    const firstRow = page.locator('tbody tr[data-reserve-id]').first();
    const reserveId = await firstRow.getAttribute('data-reserve-id');
    if (!reserveId) throw new Error('Missing data-reserve-id for first row');

    await firstRow.click();
    await expect(firstRow).toHaveClass(/bg-muted\/30/);

    const pinnedTopY = await getPinnedTopY(page);
    await scrollExpandedRowIntoAnchorBand(page, reserveId, pinnedTopY);

    await marketChipForReserve(page, reserveId).click();

    await assertExpandedRowPinnedToAnchor(page, reserveId);
  });

  test('(4) at anchor → cancel market filter → pins to top anchor', async ({ page }) => {
    await page.goto('/');
    await waitDesktopTable(page);

    const firstRow = page.locator('tbody tr[data-reserve-id]').first();
    const reserveId = await firstRow.getAttribute('data-reserve-id');
    if (!reserveId) throw new Error('Missing data-reserve-id for first row');

    await firstRow.click();
    await expect(firstRow).toHaveClass(/bg-muted\/30/);

    await marketChipForReserve(page, reserveId).click();

    const pinnedTopYWithFilter = await getPinnedTopY(page);
    await scrollExpandedRowIntoAnchorBand(page, reserveId, pinnedTopYWithFilter);

    await marketChipForReserve(page, reserveId).click();

    await assertExpandedRowPinnedToAnchor(page, reserveId);
  });

  test('(5) non-first row → apply market filter → pins to top anchor', async ({ page }) => {
    await page.goto('/');
    await waitDesktopTable(page);

    // Pick a row deeper in the list (3rd visible row) so the row index
    // changes after filter — guards against "first row only" assumptions.
    const rows = page.locator('tbody tr[data-reserve-id]');
    const rowCount = await rows.count();
    const targetIndex = Math.min(2, rowCount - 1);
    const targetRow = rows.nth(targetIndex);
    const reserveId = await targetRow.getAttribute('data-reserve-id');
    if (!reserveId) throw new Error(`Missing data-reserve-id for row at index ${targetIndex}`);

    // Scroll down so the row is reachable, then expand it.
    await targetRow.scrollIntoViewIfNeeded();
    await targetRow.click();
    await expect(targetRow).toHaveClass(/bg-muted\/30/);

    await scrollExpandedRowOffPinAnchor(page, reserveId);

    await marketChipForReserve(page, reserveId).click();

    await assertExpandedRowPinnedToAnchor(page, reserveId);
  });
});
