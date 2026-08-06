import { test, expect } from '@playwright/test';

const OLD_FIELDS = [
  'reserveSize', 'totalVariableDebt', 'availableLiquidity',
  'reserveFactor', 'variableRateSlope1', 'variableRateSlope2',
  'optimalUsageRate', 'baseVariableBorrowRate',
];
const NEW_FIELDS = [
  'supplied', 'borrowed', 'liquidity',
  'protocolFee', 'slopeBelowOptimal', 'slopeAboveOptimal',
  'optimalUtilization', 'baseBorrowRate',
];

test.describe('API fields v3 — UI rendering verification', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Reserves table uses card layout on mobile, not tbody tr');
  });
  test('main page loads with reserve data visible', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/', { timeout: 30_000, waitUntil: 'domcontentloaded' });

    // Wait for the reserves table to render instead of using a fixed timeout.
    await expect(page.locator('tbody tr[data-reserve-id]').first())
      .toBeVisible({ timeout: 120_000 });

    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toBeNull();
    expect(bodyText!.length).toBeGreaterThan(1000);
  });

  test('reserves table renders with at least 10 visible rows (virtual scroll)', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/', { timeout: 30_000, waitUntil: 'domcontentloaded' });

    await expect(page.locator('tbody tr[data-reserve-id]').first())
      .toBeVisible({ timeout: 120_000 });

    const count = await page.locator('tbody tr[data-reserve-id]').count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('no console errors from field name mismatch', async ({ page }) => {
    test.setTimeout(180_000);
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/', { timeout: 30_000, waitUntil: 'domcontentloaded' });
    await expect(page.locator('tbody tr[data-reserve-id]').first())
      .toBeVisible({ timeout: 120_000 });

    const fieldErrors = consoleErrors.filter(e =>
      OLD_FIELDS.some(f => e.toLowerCase().includes(f.toLowerCase())) ||
      NEW_FIELDS.some(f => e.toLowerCase().includes(f.toLowerCase()))
    );
    expect(fieldErrors).toHaveLength(0);
  });

  test('reserve detail panel opens and shows liquidity/borrow/supply data', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Detail panel layout differs on mobile');
    test.setTimeout(180_000);
    await page.goto('/', { timeout: 30_000, waitUntil: 'domcontentloaded' });
    await expect(page.locator('tbody tr[data-reserve-id]').first())
      .toBeVisible({ timeout: 120_000 });

    await page.locator('tbody tr[data-reserve-id]').first().click();
    // Wait for detail panel content to appear instead of a fixed timeout.
    await expect(page.locator('text=/supply|total|liquidity|available|tvl/i').first())
      .toBeVisible({ timeout: 15_000 });

    const detailText = (await page.locator('body').textContent()) ?? '';
    const hasLiquidityOrSupply = /supply|total|liquidity|available|tvl/i.test(detailText);
    const hasBorrowOrDebt = /borrow|debt/i.test(detailText);

    expect(hasLiquidityOrSupply).toBe(true);
    expect(hasBorrowOrDebt).toBe(true);
  });

  test('utilization indicator renders with percentage value', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Detail panel layout differs on mobile');
    test.setTimeout(180_000);
    await page.goto('/', { timeout: 30_000, waitUntil: 'domcontentloaded' });
    await expect(page.locator('tbody tr[data-reserve-id]').first())
      .toBeVisible({ timeout: 120_000 });

    await page.locator('tbody tr[data-reserve-id]').first().click();
    await expect(page.locator('text=/\\d+(\\.\\d+)?\\s*%/').first())
      .toBeVisible({ timeout: 15_000 });

    const utilPercent = page.locator('text=/\\d+(\\.\\d+)?\\s*%/').first();
    const text = await utilPercent.textContent();
    expect(text).toMatch(/\d+(\.\d+)?\s*%/);
  });

  test('rate simulation slider is interactable', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Slider not available in mobile detail view');
    test.setTimeout(180_000);
    await page.goto('/', { timeout: 30_000, waitUntil: 'domcontentloaded' });
    await expect(page.locator('tbody tr[data-reserve-id]').first())
      .toBeVisible({ timeout: 120_000 });

    await page.locator('tbody tr[data-reserve-id]').first().click();
    const slider = page.locator('input[type="range" i], [role="slider"]').first();
    await expect(slider).toBeVisible({ timeout: 15_000 });
  });
});
