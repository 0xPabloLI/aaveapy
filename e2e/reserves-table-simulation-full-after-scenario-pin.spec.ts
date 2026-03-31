import { expect, test, type Locator } from '@playwright/test';

/** Desktop table mounted (not mobile cards, not full-page LoadingState skeleton). */
async function waitDesktopReservesReady(page: Parameters<typeof test>[0]['page']) {
  await expect(page.locator('[data-reserves-sticky-thead]')).toBeVisible({ timeout: 120_000 });
  await expect(page.locator('tbody tr[data-reserve-id]').first()).toBeVisible({ timeout: 60_000 });
}

async function getPinnedTopY(page: Parameters<typeof test>[0]['page']): Promise<number> {
  const scenario = page.locator('[data-reserves-sticky-scenario]').first();
  const firstStickyHeader = page.locator('[data-reserves-sticky-thead] th').first();
  await expect(scenario).toBeVisible();
  await expect(firstStickyHeader).toBeVisible();
  let maxBottom = 0;
  const scenarioBox = await scenario.boundingBox();
  if (scenarioBox) maxBottom = Math.max(maxBottom, scenarioBox.y + scenarioBox.height);
  const headerBox = await firstStickyHeader.boundingBox();
  if (headerBox) maxBottom = Math.max(maxBottom, headerBox.y + headerBox.height);
  if (maxBottom <= 0) {
    throw new Error('getPinnedTopY: sticky scenario/header have no bounding box');
  }
  return maxBottom + 8;
}

function simulationScrollPortForMainRow(mainRow: Locator) {
  return mainRow
    .locator('xpath=following-sibling::tr[1]')
    .locator('[data-reserves-simulation-scrollport]')
    .first();
}

/**
 * Regression (desktop): after scenario-driven re-sort + pin, expanded simulation should not be
 * clipped by an inner `overflow-y` scrollport (`scrollHeight` should fit `clientHeight`).
 *
 * Today `DesktopReserveRow` uses `max-height` + `overflow-y-auto`, so the **last** expect fails until
 * layout is fixed.
 *
 * Flow matches `reserves-table-scenario-pin.spec.ts` through the first pin, then we assert on the
 * inner scrollport.
 *
 * **Why a temporary max-height clamp:** before layout settles, `mainRowHeight` can be 0 so React
 * omits `max-height` and `scrollHeight === clientHeight` (no measurable inner overflow). The same
 * E2E clamp pattern as `reserves-table-simulation-nested-scroll.spec.ts` forces a clipped pane so
 * the regression line (`scrollHeight` should fit `clientHeight` when the product shows the full
 * simulation) fails reliably until `DesktopReserveRow` stops capping the wrapper.
 */
test.describe('Simulation fully visible after scenario-driven pin (desktop)', () => {
  test.beforeEach(async ({ page: _page }, testInfo) => {
    test.skip(
      testInfo.project.name.includes('mobile'),
      'Pin scroll + desktop expanded simulation only',
    );
  });

  test('after re-sort and pin, simulation scrollport has no inner vertical overflow', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await page.goto('/');
    await waitDesktopReservesReady(page);

    const supplyInput = page.locator('[data-reserves-sticky-scenario] input[aria-label="Supply amount"]');
    const borrowInput = page.locator('[data-reserves-sticky-scenario] input[aria-label="Borrow amount"]');

    await supplyInput.fill('100');
    await page.waitForTimeout(900);

    const rows = page.locator('tbody tr[data-reserve-id]');
    const rowCount = await rows.count();
    expect(rowCount, 'need visible reserve rows').toBeGreaterThan(0);

    const targetIndex = Math.min(2, rowCount - 1);
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

    /** Match `reserves-table-scenario-pin.spec.ts`: pin band is fixed per assert; poll row `y` only (re-calling sticky boxes inside poll can see transient null → bogus default). */
    const assertPinned = async (label: string) => {
      const pinnedTopY = await getPinnedTopY(page);
      await expect
        .poll(
          async () => {
            const b = await expandedMain.boundingBox();
            return b ? b.y : Number.POSITIVE_INFINITY;
          },
          { timeout: 15_000, message: label },
        )
        .toBeLessThanOrEqual(pinnedTopY + 28);
    };

    await assertPinned('expanded row should pin after first scenario-driven re-sort');

    await supplyInput.fill('10000000');
    await page.waitForTimeout(1100);
    await assertPinned('expanded row should stay pinned after second scenario-driven re-sort');

    await page.waitForTimeout(400);

    await expect(page.getByText('Simulation is for reference only')).toBeVisible({ timeout: 25_000 });

    const scrollPort = simulationScrollPortForMainRow(expandedMain);
    await expect(scrollPort).toBeVisible({ timeout: 10_000 });

    // 1) E2E clamp: prove simulation content IS tall enough to overflow a small pane.
    await scrollPort.evaluate((el) => {
      el.dataset.e2ePrevMaxHeight = el.style.maxHeight;
      el.dataset.e2ePrevOverflow = el.style.overflowY;
      el.style.maxHeight = '180px';
      el.style.overflowY = 'auto';
    });

    await expect
      .poll(
        async () => {
          const { scrollHeight, clientHeight } = await scrollPort.evaluate((e) => ({
            scrollHeight: e.scrollHeight,
            clientHeight: e.clientHeight,
          }));
          return scrollHeight - clientHeight;
        },
        {
          timeout: 15_000,
          message:
            'after E2E clamp: simulation content should exceed inner pane (see nested-scroll spec)',
        },
      )
      .toBeGreaterThan(24);

    // 2) Restore product state (no max-height, no overflow-y) and verify no inner scroll.
    await scrollPort.evaluate((el) => {
      el.style.maxHeight = el.dataset.e2ePrevMaxHeight ?? '';
      el.style.overflowY = el.dataset.e2ePrevOverflow ?? '';
      delete el.dataset.e2ePrevMaxHeight;
      delete el.dataset.e2ePrevOverflow;
    });

    const metrics = await scrollPort.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    expect(
      metrics.scrollHeight,
      'tall simulation body expected after large scenario (raise supply if this fails)',
    ).toBeGreaterThan(320);

    expect(
      metrics.scrollHeight,
      `Expected entire simulation visible without inner scroll after pin (scrollHeight=${metrics.scrollHeight} <= clientHeight=${metrics.clientHeight}). ` +
        'Remove or relax DesktopReserveRow max-height + overflow-y-auto so this passes.',
    ).toBeLessThanOrEqual(metrics.clientHeight + 2);
  });
});
