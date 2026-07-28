import { expect, test } from '@playwright/test';

const strictStickAssertEnabled = process.env.STRICT_STICK_ASSERT === 'true';

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

interface ExpandedReserveStickSnapshot {
  reserveId: string;
  mainRowY: number;
  mainRowHeight: number;
  mainRowBottom: number;
  pinnedTopY: number;
  viewportHeight: number;
}

async function readExpandedReserveStickSnapshot(
  page: Parameters<typeof test>[0]['page'],
  reserveId: string,
): Promise<ExpandedReserveStickSnapshot> {
  const mainRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"]`);
  await expect(mainRow, `main row ${reserveId} must exist`).toBeVisible();
  const box = await mainRow.boundingBox();
  if (!box) {
    throw new Error(`No bounding box for tr[data-reserve-id="${reserveId}"]`);
  }
  const pinnedTopY = await getPinnedTopY(page);
  const viewportHeight = page.viewportSize()?.height ?? 720;
  return {
    reserveId,
    mainRowY: box.y,
    mainRowHeight: box.height,
    mainRowBottom: box.y + box.height,
    pinnedTopY,
    viewportHeight,
  };
}

/** Same expanded reserve: main row stays in viewport and aligns to the sticky pin band (desktop). */
async function assertStrictStickAfterReorder(
  page: Parameters<typeof test>[0]['page'],
  reserveId: string,
  before: ExpandedReserveStickSnapshot,
): Promise<ExpandedReserveStickSnapshot> {
  const mainRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"]`);
  const simulationRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"] + tr`);

  await expect(mainRow, `after reorder: main row ${reserveId} must stay visible`).toBeVisible();
  await expect(simulationRow, `after reorder: simulation row for ${reserveId} must stay visible`).toBeVisible();

  const pinBandPx = 12;
  const viewportSlackPx = 4;

  await expect
    .poll(
      async () => {
        const snap = await readExpandedReserveStickSnapshot(page, reserveId);
        return snap.mainRowY - snap.pinnedTopY;
      },
      {
        timeout: 4500,
        message: `strict stick: poll main row into pin band (reserveId=${reserveId}, before=${JSON.stringify(before)})`,
      },
    )
    .toBeLessThanOrEqual(pinBandPx);

  const after = await readExpandedReserveStickSnapshot(page, reserveId);

  expect(
    after.mainRowY,
    `near top: main row top should sit at or below pin line (reserveId=${reserveId}, before.y=${before.mainRowY}, pinned=${after.pinnedTopY})`,
  ).toBeLessThanOrEqual(after.pinnedTopY + pinBandPx);

  expect(
    after.mainRowY,
    `visible: main row must not sit above viewport (reserveId=${reserveId})`,
  ).toBeGreaterThanOrEqual(-2);

  expect(
    after.mainRowBottom,
    `visible: main row must not fall below viewport (reserveId=${reserveId}, vp=${after.viewportHeight})`,
  ).toBeLessThanOrEqual(after.viewportHeight + viewportSlackPx);

  expect(after.reserveId, 'reserveId must not change across reorder').toBe(before.reserveId);

  return after;
}

test.describe('Reserves table stick behavior', () => {
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
    await expect(page.locator(`tbody tr[data-reserve-id="${reserveId}"] + tr`)).toBeVisible();

    const before = await readExpandedReserveStickSnapshot(page, reserveId);

    await marketChipForReserve(page, reserveId).click();

    await assertStrictStickAfterReorder(page, reserveId, before);
  });
});
