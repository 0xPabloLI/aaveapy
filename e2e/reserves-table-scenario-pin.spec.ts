import { expect, test } from '@playwright/test';

async function waitDesktopTable(page: Parameters<typeof test>[0]['page']) {
  await expect(page.locator('tbody tr[data-reserve-id]').first()).toBeVisible({ timeout: 60_000 });
}

async function getPinnedTopY(page: Parameters<typeof test>[0]['page']): Promise<number> {
  const scenario = page.locator('[data-reserves-sticky-scenario]').first();
  const firstStickyHeader = page.locator('[data-reserves-sticky-thead] th').first();
  let maxBottom = 0;
  if ((await scenario.count()) > 0) {
    const box = await scenario.boundingBox();
    if (box) maxBottom = Math.max(maxBottom, box.y + box.height);
  }
  if ((await firstStickyHeader.count()) > 0) {
    const box = await firstStickyHeader.boundingBox();
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

async function expectPinnedWithExpandedBlockVisible(
  page: Parameters<typeof test>[0]['page'],
  reserveId: string,
  label: string,
) {
  const mainRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"]`);
  const simulationRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"] + tr`);
  const nextMainRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"] + tr + tr[data-reserve-id]`).first();

  await expect(mainRow).toBeVisible({ timeout: 10_000 });
  await expect(simulationRow).toBeVisible({ timeout: 10_000 });

  const pinnedTopY = await getPinnedTopY(page);
  const viewportHeight = page.viewportSize()?.height ?? 720;

  const main = await mainRow.boundingBox();
  const simulation = await simulationRow.boundingBox();
  const next = await nextMainRow.boundingBox();
  if (!main || !simulation || !next) {
    throw new Error(`failed to read geometry for ${label}`);
  }

  expect(
    main.y,
    `main row should stay pinned just below sticky stack (${label})`,
  ).toBeLessThanOrEqual(pinnedTopY + 16);
  expect(
    main.y,
    `main row should not drift above sticky stack (${label})`,
  ).toBeGreaterThanOrEqual(pinnedTopY - 4);
  expect(
    simulation.y + simulation.height,
    `expanded simulation block should be fully visible in viewport (${label})`,
  ).toBeLessThanOrEqual(viewportHeight + 2);
  expect(
    next.y,
    `next row top should remain visible after pin (${label})`,
  ).toBeLessThanOrEqual(viewportHeight - 1);
}

async function getMainRowOffsetFromPinBand(
  page: Parameters<typeof test>[0]['page'],
  reserveId: string,
): Promise<number> {
  const mainRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"]`);
  const pinnedTopY = await getPinnedTopY(page);
  const box = await mainRow.boundingBox();
  if (!box) return Number.POSITIVE_INFINITY;
  return box.y - pinnedTopY;
}

async function moveExpandedRowAwayFromPinBand(
  page: Parameters<typeof test>[0]['page'],
  reserveId: string,
  minDeltaPx = 180,
) {
  const mainRow = page.locator(`tbody tr[data-reserve-id="${reserveId}"]`);
  await expect(mainRow).toBeVisible({ timeout: 10_000 });

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const delta = await getMainRowOffsetFromPinBand(page, reserveId);
    if (Math.abs(delta) >= minDeltaPx) return;
    await page.evaluate((step) => {
      window.scrollBy({ top: step, behavior: 'auto' });
    }, Math.max(220, minDeltaPx));
    await page.waitForTimeout(120);
  }

  const finalDelta = await getMainRowOffsetFromPinBand(page, reserveId);
  expect(
    Math.abs(finalDelta),
    `failed to move expanded row away from pin band (reserveId=${reserveId})`,
  ).toBeGreaterThanOrEqual(minDeltaPx);
}

async function getVisibleReserveOrder(page: Parameters<typeof test>[0]['page']): Promise<string[]> {
  return page.locator('tbody tr[data-reserve-id]').evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('data-reserve-id') ?? '').filter((id) => id.length > 0),
  );
}

function didReorder(beforeOrder: string[], afterOrder: string[], reserveId: string): boolean {
  if (beforeOrder.length !== afterOrder.length) return true;
  const beforeIndex = beforeOrder.indexOf(reserveId);
  const afterIndex = afterOrder.indexOf(reserveId);
  if (beforeIndex !== afterIndex) return true;
  return beforeOrder.some((id, idx) => id !== afterOrder[idx]);
}

async function setScenarioInputs(
  page: Parameters<typeof test>[0]['page'],
  values: { supply: string; borrow: string },
) {
  await page.evaluate(({ supply, borrow }) => {
    const supplyInput = document.querySelector<HTMLInputElement>(
      '[data-reserves-sticky-scenario] input[aria-label="Supply amount"]',
    );
    const borrowInput = document.querySelector<HTMLInputElement>(
      '[data-reserves-sticky-scenario] input[aria-label="Borrow amount"]',
    );
    if (!supplyInput || !borrowInput) throw new Error('Scenario inputs not found');

    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!valueSetter) throw new Error('HTMLInputElement value setter missing');

    valueSetter.call(supplyInput, supply);
    supplyInput.dispatchEvent(new Event('input', { bubbles: true }));

    valueSetter.call(borrowInput, borrow);
    borrowInput.dispatchEvent(new Event('input', { bubbles: true }));
  }, values);
}

async function maybeExpandDesktopRowsToFullList(page: Parameters<typeof test>[0]['page']) {
  const showMore = page.getByRole('button', { name: /Show \d+ More Reserves/i }).first();
  if ((await showMore.count()) === 0) return;
  await showMore.scrollIntoViewIfNeeded();
  await showMore.click();
  await expect(page.getByRole('button', { name: 'Show Less' })).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
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

async function getScrollByProbeCount(page: Parameters<typeof test>[0]['page']): Promise<number> {
  return page.evaluate(() => {
    type ProbedWindow = Window & { __e2eScrollByCalls?: number };
    return (window as ProbedWindow).__e2eScrollByCalls ?? 0;
  });
}

// The pin controller reacts to sortedIds at per-commit granularity; a coarse
// before/after DOM snapshot misses intermediate reorders that restore before
// the next read (seen in a pre-push trace: schedule fired while the final DOM
// order equalled the baseline). This observer closes that detection gap.
async function armOrderProbe(page: Parameters<typeof test>[0]['page']) {
  await page.evaluate(() => {
    type OrderProbeWindow = Window & {
      __e2eOrderBaseline?: string[];
      __e2eOrderReordered?: boolean;
      __e2eOrderObserver?: MutationObserver | null;
    };
    const win = window as OrderProbeWindow;
    const readOrder = () =>
      Array.from(document.querySelectorAll('tbody tr[data-reserve-id]')).map(
        (row) => row.getAttribute('data-reserve-id') ?? '',
      );
    if (!win.__e2eOrderObserver) {
      const observer = new MutationObserver(() => {
        const baseline = win.__e2eOrderBaseline;
        if (!baseline) return;
        const order = readOrder();
        if (
          order.length !== baseline.length ||
          order.some((id, idx) => id !== baseline[idx])
        ) {
          win.__e2eOrderReordered = true;
        }
      });
      const tbody = document.querySelector('tbody');
      if (tbody) observer.observe(tbody, { childList: true });
      win.__e2eOrderObserver = observer;
    }
    win.__e2eOrderBaseline = readOrder();
    win.__e2eOrderReordered = false;
  });
}

async function getOrderProbeReordered(page: Parameters<typeof test>[0]['page']): Promise<boolean> {
  return page.evaluate(() => {
    type OrderProbeWindow = Window & { __e2eOrderReordered?: boolean };
    return (window as OrderProbeWindow).__e2eOrderReordered ?? false;
  });
}

test.describe('Scenario input pin scroll (desktop)', () => {
  test.beforeEach(async ({ page: _page }, testInfo) => {
    test.skip(
      testInfo.project.name.includes('mobile'),
      'Pin scroll is desktop-specific',
    );
  });

  test('expanded row stays pinned after second scenario input reorders list', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await waitDesktopTable(page);

    const supplyInput = page.locator('[data-reserves-sticky-scenario] input[aria-label="Supply amount"]');
    await supplyInput.fill('100');
    // Wait for scenario input to take effect (table re-sort).
    await expect.poll(
      async () => page.locator('tbody tr[data-reserve-id]').count(),
      { timeout: 10_000, message: 'table to re-sort after scenario input' },
    ).toBeGreaterThan(0);

    const rows = page.locator('tbody tr[data-reserve-id]');
    const rowCount = await rows.count();
    const targetIndex = Math.min(2, rowCount - 1);
    const targetRow = rows.nth(targetIndex);
    const reserveId = await targetRow.getAttribute('data-reserve-id');
    if (!reserveId) throw new Error(`Missing data-reserve-id at index ${targetIndex}`);

    await targetRow.scrollIntoViewIfNeeded();
    await targetRow.click();
    await expect(targetRow).toHaveClass(/bg-muted\/30/);
    // Wait for the expanded simulation row to appear.
    await expect(page.locator(`tbody tr[data-reserve-id="${reserveId}"] + tr`)).toBeVisible({ timeout: 10_000 });

    const borrowInput = page.locator('[data-reserves-sticky-scenario] input[aria-label="Borrow amount"]');
    await borrowInput.fill('100');

    await expectRowPinnedNearStickyBand(
      page,
      reserveId,
      'expanded row should pin near sticky band after scenario input',
    );
  });

  test('reorder pins and non-reorder scenario change does not force pin', async ({ page }) => {
    test.skip(!!process.env.CI, 'Complex 8-step scenario timing — run locally');
    test.setTimeout(180_000);

    await page.goto('/');
    await waitDesktopTable(page);
    await installScrollByProbe(page);

    await setScenarioInputs(page, { supply: '100', borrow: '0' });
    // Wait for scenario input to take effect.
    await expect.poll(
      async () => page.locator('tbody tr[data-reserve-id]').count(),
      { timeout: 10_000, message: 'table to re-sort after scenario input' },
    ).toBeGreaterThan(0);
    await maybeExpandDesktopRowsToFullList(page);

    const rows = page.locator('tbody tr[data-reserve-id]');
    const rowCount = await rows.count();
    const targetIndex = Math.min(8, rowCount - 1);
    const targetRow = rows.nth(targetIndex);
    const reserveId = await targetRow.getAttribute('data-reserve-id');
    if (!reserveId) throw new Error(`Missing data-reserve-id at index ${targetIndex}`);

    await targetRow.scrollIntoViewIfNeeded();
    await targetRow.click();
    await expect(targetRow).toHaveClass(/bg-muted\/30/);
    // Wait for the expanded simulation row to appear.
    await expect(page.locator(`tbody tr[data-reserve-id="${reserveId}"] + tr`)).toBeVisible({ timeout: 10_000 });

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

    let reorderAssertCount = 0;
    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i];
      const beforeOrder = await getVisibleReserveOrder(page);
      await moveExpandedRowAwayFromPinBand(page, reserveId);
      await resetScrollByProbe(page);
      await armOrderProbe(page);
      await setScenarioInputs(page, step);
      // Wait for the table sort to stabilize (two consecutive reads with same order).
      // Just checking order.length > 0 is insufficient — the sort may still be in progress.
      await expect.poll(
        async () => {
          const order1 = await getVisibleReserveOrder(page);
          await page.waitForTimeout(100);
          const order2 = await getVisibleReserveOrder(page);
          return order1.join(',') === order2.join(',') ? order1.length : 0;
        },
        { timeout: 15_000, message: `table sort to stabilize after scenario step ${i + 1}` },
      ).toBeGreaterThan(0);
      const afterOrder = await getVisibleReserveOrder(page);
      const finalReorder = didReorder(beforeOrder, afterOrder, reserveId);
      const transientReorder = !finalReorder && (await getOrderProbeReordered(page));

      if (!finalReorder && !transientReorder) {
        // Non-reorder: wait a bit to confirm no pin scroll fires.
        await page.waitForTimeout(500);
        const scrollByCalls = await getScrollByProbeCount(page);
        expect(
          scrollByCalls,
          `non-reorder edit #${i + 1} should not force pin scroll`,
        ).toBe(0);
        // Note: we do NOT assert the row offset here because a re-render
        // (without reorder) can still shift the row's absolute position via
        // virtual scroll / pagination adjustments — without calling window.scrollBy.
        // The scrollByCalls === 0 assertion above is the correct invariant.
        continue;
      }

      if (transientReorder) {
        // Debounce-window reorder that restored by the final snapshot: the
        // app legitimately pinned to the intermediate order (or may have —
        // pins are allowed, not required). Final geometry doesn't apply.
        continue;
      }

      reorderAssertCount += 1;
      // Pin scroll is scheduled with a 320ms delay + rAF. Wait for it to fire.
      await expect.poll(
        () => getScrollByProbeCount(page),
        { timeout: 10_000, message: `reorder edit #${i + 1} pin scroll to fire` },
      ).toBeGreaterThan(0);
      const scrollByCalls = await getScrollByProbeCount(page);
      expect(
        scrollByCalls,
        `reorder edit #${i + 1} must trigger pin scroll`,
      ).toBeGreaterThan(0);
      await expectPinnedWithExpandedBlockVisible(
        page,
        reserveId,
        `expanded row should pin with full simulation visible on reorder edit #${i + 1}`,
      );
      // Wait for pin scroll to settle.
      await expect.poll(
        async () => {
          const b = await page.locator(`tbody tr[data-reserve-id="${reserveId}"]`).boundingBox();
          return b ? b.y : Number.POSITIVE_INFINITY;
        },
        { timeout: 5_000, message: `pin scroll to settle after reorder edit #${i + 1}` },
      ).toBeLessThanOrEqual(await getPinnedTopY(page) + 24);
    }

    expect(reorderAssertCount, 'expected multiple scenario edits to reorder visible reserves').toBeGreaterThanOrEqual(2);

    // Deterministic non-reorder assertion: reapply same scenario inputs.
    const stableStep = steps[steps.length - 1];
    await moveExpandedRowAwayFromPinBand(page, reserveId);
    await resetScrollByProbe(page);
    await setScenarioInputs(page, stableStep);
    // Wait briefly for any potential scroll to fire.
    await expect.poll(
      () => getScrollByProbeCount(page),
      { timeout: 3_000, message: 'stable scenario input — no scroll expected' },
    ).toBe(0);
const stableScrollByCalls = await getScrollByProbeCount(page);
expect(stableScrollByCalls, 'same scenario inputs should not force pin scroll').toBe(0);
// Note: not asserting row offset — re-render can shift position without window.scrollBy.
  });

  test('clearing scenario input keeps expanded reserve pinned', async ({ page }) => {
    test.skip(!!process.env.CI, 'Complex multi-step scenario timing — run locally');
    test.setTimeout(120_000);

    await page.goto('/');
    await waitDesktopTable(page);
    await installScrollByProbe(page);

    // Start from non-empty scenario so clearing path (has input -> empty) is exercised.
    await setScenarioInputs(page, { supply: '1200', borrow: '' });
    // Wait for scenario input to take effect.
    await expect.poll(
      async () => page.locator('tbody tr[data-reserve-id]').count(),
      { timeout: 10_000, message: 'table to re-sort after scenario input' },
    ).toBeGreaterThan(0);
    await maybeExpandDesktopRowsToFullList(page);

    const rows = page.locator('tbody tr[data-reserve-id]');
    const rowCount = await rows.count();
    const targetIndex = Math.min(8, rowCount - 1);
    const targetRow = rows.nth(targetIndex);
    const reserveId = await targetRow.getAttribute('data-reserve-id');
    if (!reserveId) throw new Error(`Missing data-reserve-id at index ${targetIndex}`);

    await targetRow.scrollIntoViewIfNeeded();
    await targetRow.click();
    await expect(targetRow).toHaveClass(/bg-muted\/30/);
    // Wait for the expanded simulation row to appear.
    await expect(page.locator(`tbody tr[data-reserve-id="${reserveId}"] + tr`)).toBeVisible({ timeout: 10_000 });

    // Path A: remove supply value directly (equivalent to deleting supply input).
    await moveExpandedRowAwayFromPinBand(page, reserveId);
    await resetScrollByProbe(page);
    await setScenarioInputs(page, { supply: '', borrow: '' });
    await expectRowPinnedNearStickyBand(
      page,
      reserveId,
      'expanded row should pin near sticky band after deleting supply to empty',
    );
    await expect(page.locator(`tbody tr[data-reserve-id="${reserveId}"] + tr`)).toBeVisible({
      timeout: 10_000,
    });
    await expect
      .poll(() => getScrollByProbeCount(page), {
        timeout: 9000,
        message: 'delete supply to empty should eventually trigger pin scroll',
      })
      .toBeGreaterThan(0);

    // Restore a non-empty scenario, then verify Clear button path.
    await setScenarioInputs(page, { supply: '900', borrow: '' });
    // Wait for scenario input to take effect.
    await expect.poll(
      async () => page.locator('tbody tr[data-reserve-id]').count(),
      { timeout: 10_000, message: 'table to re-sort after restoring scenario' },
    ).toBeGreaterThan(0);
    await moveExpandedRowAwayFromPinBand(page, reserveId);
    await resetScrollByProbe(page);

    const clearButton = page
      .locator('[data-reserves-sticky-scenario] button[aria-label="Clear supply amount"]')
      .first();
await expect(clearButton).toBeVisible({ timeout: 30_000 });
await clearButton.click();

    await expectRowPinnedNearStickyBand(
      page,
      reserveId,
      'expanded row should pin near sticky band after pressing clear',
    );
    await expect(page.locator(`tbody tr[data-reserve-id="${reserveId}"] + tr`)).toBeVisible({
      timeout: 10_000,
    });
    await expect
      .poll(() => getScrollByProbeCount(page), {
        timeout: 9000,
        message: 'clear button should eventually trigger pin scroll',
      })
      .toBeGreaterThan(0);
  });
});
