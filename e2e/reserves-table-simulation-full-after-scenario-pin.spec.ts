import { expect, test, type Locator } from '@playwright/test';

/**
 * `Index` shows full-page `LoadingState` until markets query resolves — that skeleton also has a
 * `<table><tbody><tr>` without `data-reserve-id`, so waiting on rows alone can time out misleadingly.
 * `ReservesTable` always renders `[data-reserves-sticky-scenario]` once we leave that gate.
 */
async function waitDesktopTable(page: Parameters<typeof test>[0]['page']) {
  await expect(page.locator('[data-reserves-sticky-scenario]').first()).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('tbody tr[data-reserve-id]').first()).toBeVisible({ timeout: 90_000 });
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

function simulationScrollPortForMainRow(mainRow: Locator) {
  return mainRow
    .locator('xpath=following-sibling::tr[1]')
    .locator('[data-reserves-simulation-scrollport]')
    .first();
}

/**
 * Product expectation (reported UX): when debounced scenario input changes sort order and the
 * expanded row is re-pinned under the sticky stack, the **entire** simulation block should be
 * visible — no inner `overflow-y` clipping (`scrollHeight` should fit `clientHeight`).
 *
 * Current `DesktopReserveRow` caps the wrapper with `max-height` + `overflow-y-auto`, so this
 * test **fails** until layout is changed to allow full vertical expansion after pin.
 */
test.describe('Simulation fully visible after scenario-driven pin (desktop)', () => {
  test.beforeEach(async ({ page: _page }, testInfo) => {
    test.skip(
      testInfo.project.name.includes('mobile'),
      'Pin scroll + desktop expanded simulation only',
    );
  });

  test('after re-sort and pin, simulation scrollport has no inner vertical overflow', async ({ page }) => {
    const marketsOk = page.waitForResponse(
      (r) => r.url().includes('/markets') && r.status() === 200,
      { timeout: 90_000 },
    );
    await page.goto('/');
    await marketsOk;
    await waitDesktopTable(page);

    const supplyInput = page.locator('[data-reserves-sticky-scenario] input[aria-label="Supply amount"]');
    const borrowInput = page.locator('[data-reserves-sticky-scenario] input[aria-label="Borrow amount"]');

    // Step A — mirror `reserves-table-scenario-pin.spec.ts` (immediate poll after borrow; no extra pre-poll sleep).
    await supplyInput.fill('100');
    await page.waitForTimeout(900);

    const rows = page.locator('tbody tr[data-reserve-id]');
    const rowCount = await rows.count();
    const targetIndex = Math.min(2, Math.max(0, rowCount - 1));
    const targetRow = rows.nth(targetIndex);
    const reserveId = await targetRow.getAttribute('data-reserve-id');
    if (!reserveId) throw new Error(`Missing data-reserve-id at index ${targetIndex}`);

    await targetRow.scrollIntoViewIfNeeded();
    await targetRow.click();
    await expect(targetRow).toHaveClass(/bg-muted\/30/);
    await page.waitForTimeout(500);

    await borrowInput.fill('100');

    const expandedMain = page.locator(`tbody tr[data-reserve-id="${reserveId}"]`).first();
    await expect(expandedMain).toBeVisible({ timeout: 10_000 });

    const assertPinned = async (label: string) => {
      await expect
        .poll(
          async () => {
            const pinnedTopY = await getPinnedTopY(page);
            const b = await expandedMain.boundingBox();
            const y = b ? b.y : Number.POSITIVE_INFINITY;
            return y - pinnedTopY;
          },
          { timeout: 12_000, message: label },
        )
        .toBeLessThanOrEqual(28);
    };

    await assertPinned('expanded row should pin after first scenario-driven re-sort');

    // Step B — large supply so simulation is tall; debounce + possible second reorder + second pin.
    await supplyInput.fill('10000000');
    await page.waitForTimeout(1100);
    await assertPinned('expanded row should stay pinned after second scenario-driven re-sort');

    await page.waitForTimeout(400);

    const scrollPort = simulationScrollPortForMainRow(expandedMain);
    await expect(scrollPort).toBeVisible({ timeout: 5000 });

    const { scrollHeight, clientHeight } = await scrollPort.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    expect(
      scrollHeight,
      'need a tall enough simulation block so “full expand” is a meaningful contract (adjust inputs if this skips reserve)',
    ).toBeGreaterThan(280);

    expect(
      scrollHeight <= clientHeight + 2,
      `Expected entire simulation visible without inner scroll after pin (scrollHeight=${scrollHeight} <= clientHeight=${clientHeight}). ` +
        'Today DesktopReserveRow uses max-height + overflow-y-auto — remove or relax that cap so this passes.',
    ).toBe(true);
  });
});
