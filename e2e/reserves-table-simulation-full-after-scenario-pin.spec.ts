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

async function getVisibleReserveOrder(
  page: Parameters<typeof test>[0]['page'],
): Promise<string[]> {
  return page.locator('tbody tr[data-reserve-id]').evaluateAll((rows) =>
    rows
      .map((row) => row.getAttribute('data-reserve-id') ?? '')
      .filter((id) => id.length > 0),
  );
}

function didReorder(beforeOrder: string[], afterOrder: string[]): boolean {
  return (
    beforeOrder.length !== afterOrder.length ||
    beforeOrder.some((id, index) => id !== afterOrder[index])
  );
}

async function setScenarioInputs(
  page: Parameters<typeof test>[0]['page'],
  values: { supply: string; borrow: string },
) {
  await page.locator(
    '[data-reserves-sticky-scenario] input[aria-label="Supply amount"]',
  ).fill(values.supply);
  await page.locator(
    '[data-reserves-sticky-scenario] input[aria-label="Borrow amount"]',
  ).fill(values.borrow);
}

async function installScrollByProbe(page: Parameters<typeof test>[0]['page']) {
  await page.evaluate(() => {
    type ProbedWindow = Window & {
      __e2eScrollByCalls?: number;
      __e2eOriginalScrollBy?: typeof window.scrollBy;
    };
    const win = window as ProbedWindow;
    if (!win.__e2eOriginalScrollBy) {
      win.__e2eOriginalScrollBy = window.scrollBy.bind(window);
      window.scrollBy = ((...args: Parameters<typeof window.scrollBy>) => {
        win.__e2eScrollByCalls = (win.__e2eScrollByCalls ?? 0) + 1;
        win.__e2eOriginalScrollBy?.(...args);
      }) as typeof window.scrollBy;
    }
    win.__e2eScrollByCalls = 0;
  });
}

async function resetScrollByProbe(page: Parameters<typeof test>[0]['page']) {
  await page.evaluate(() => {
    type ProbedWindow = Window & { __e2eScrollByCalls?: number };
    (window as ProbedWindow).__e2eScrollByCalls = 0;
  });
}

async function getScrollByProbeCount(
  page: Parameters<typeof test>[0]['page'],
): Promise<number> {
  return page.evaluate(() => {
    type ProbedWindow = Window & { __e2eScrollByCalls?: number };
    return (window as ProbedWindow).__e2eScrollByCalls ?? 0;
  });
}

async function moveRowAwayFromPinBand(
  page: Parameters<typeof test>[0]['page'],
  reserveId: string,
) {
  const mainRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"]`).first();
  const pinnedTopY = await getPinnedTopY(page);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const box = await mainRow.boundingBox();
    if (box && box.y - pinnedTopY >= 180) return;
    const delta = box ? box.y - (pinnedTopY + 260) : -260;
    await page.evaluate((top) => window.scrollBy({ top, behavior: 'auto' }), delta);
    await page.waitForTimeout(120);
  }
  const box = await mainRow.boundingBox();
  expect(
    box ? box.y - pinnedTopY : 0,
    'expanded row should be moved away from the pin band before the scenario change',
  ).toBeGreaterThanOrEqual(180);
}

function simulationScrollPortForMainRow(mainRow: Locator) {
  return mainRow
    .locator('xpath=following-sibling::tr[1]')
    .locator('[data-reserves-simulation-scrollport]')
    .first();
}

test.describe('Simulation fully visible after scenario-driven pin (desktop)', () => {
  test.skip(!!process.env.CI, 'Complex multi-step scenario pin timing — run locally');

  test('after a scenario-driven pin, simulation has no inner vertical overflow', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await page.goto('/');
    await waitDesktopReservesReady(page);
    await installScrollByProbe(page);
    await setScenarioInputs(page, { supply: '100', borrow: '0' });
    await page.waitForTimeout(900);

    const rows = page.locator('tbody tr[data-reserve-id]');
    const rowCount = await rows.count();
    expect(rowCount, 'need visible reserve rows').toBeGreaterThan(0);

    const targetIndex = Math.min(8, rowCount - 1);
    const targetRow = rows.nth(targetIndex);
    const reserveId = await targetRow.getAttribute('data-reserve-id');
    if (!reserveId) throw new Error(`Missing data-reserve-id at index ${targetIndex}`);

    await targetRow.scrollIntoViewIfNeeded();
    await targetRow.click();
    await expect(targetRow).toHaveClass(/bg-muted\/30/);
    await page.waitForTimeout(500);

    const expandedMain = page.locator(`tbody tr[data-reserve-id="${reserveId}"]`).first();
    await expect(expandedMain).toBeVisible({ timeout: 10_000 });
    const scenarioSteps = [
      { supply: '250', borrow: '0' },
      { supply: '0', borrow: '250' },
      { supply: '1000', borrow: '150' },
      { supply: '80', borrow: '1200' },
      { supply: '30000', borrow: '50' },
      { supply: '40', borrow: '45000' },
      { supply: '700', borrow: '700' },
      { supply: '150000', borrow: '900' },
    ];

    let observedPin = false;
    for (const step of scenarioSteps) {
      const beforeOrder = await getVisibleReserveOrder(page);
      await moveRowAwayFromPinBand(page, reserveId);
      await resetScrollByProbe(page);
      await setScenarioInputs(page, step);
      await page.waitForTimeout(1200);
      const afterOrder = await getVisibleReserveOrder(page);
      if (!didReorder(beforeOrder, afterOrder)) continue;

      await expect
        .poll(() => getScrollByProbeCount(page), {
          timeout: 15_000,
          message: 'a scenario-driven reorder should trigger pin scrolling',
        })
        .toBeGreaterThan(0);

      const pinnedTopY = await getPinnedTopY(page);
      await expect
        .poll(
          async () => {
            const box = await expandedMain.boundingBox();
            return box ? box.y : Number.POSITIVE_INFINITY;
          },
          {
            timeout: 15_000,
            message: 'expanded row should pin after an observed scenario-driven reorder',
          },
        )
        .toBeLessThanOrEqual(pinnedTopY + 28);
      observedPin = true;
      break;
    }

    expect(observedPin, 'a scenario step must reorder and pin the expanded reserve').toBe(true);
    await expect(page.getByText('Simulation is for reference only')).toBeVisible({ timeout: 25_000 });

    const scrollPort = simulationScrollPortForMainRow(expandedMain);
    await expect(scrollPort).toBeVisible({ timeout: 10_000 });

    const metrics = await scrollPort.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));

    expect(
      metrics.scrollHeight - metrics.clientHeight,
      `simulation should remain on document scroll after pin (overflow-y=${metrics.overflowY})`,
    ).toBeLessThanOrEqual(2);
  });
});
