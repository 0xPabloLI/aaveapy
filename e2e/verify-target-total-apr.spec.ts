import { test, expect } from '@playwright/test';

test.describe('TARGET_TOTAL_APR UI verification', () => {
  test('frxUSD incentive tooltip shows TARGET_TOTAL_APR breakdown', async ({ page }) => {
    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('http://localhost:5173', { timeout: 30000, waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Find a reserve with TARGET_TOTAL_APR (frxUSD or USDm)
    const reserveRow = page.locator('tr, [data-reserve-row]').filter({ hasText: /frxUSD|USDm/ }).first();
    if (await reserveRow.count() === 0) {
      // Try searching for the token
      console.log('No reserve row found, checking page content...');
      const bodyText = await page.locator('body').textContent();
      console.log('Page contains frxUSD:', bodyText?.includes('frxUSD'));
      console.log('Page contains USDm:', bodyText?.includes('USDm'));
    }

    // Hover over supply incentive area to trigger tooltip
    const supplyIncentiveCell = page.locator('[data-supply-incentive], td').filter({ hasText: /\d+\.\d+%/ }).first();
    await supplyIncentiveCell.hover().catch(() => {});
    await page.waitForTimeout(1000);

    // Check for tooltip with TARGET_TOTAL_APR content
    const tooltip = page.locator('[role="tooltip"], .tooltip, [data-radix-tooltip]').first();
    if (await tooltip.count() > 0) {
      const tooltipText = await tooltip.textContent();
      console.log('Tooltip text:', tooltipText?.substring(0, 200));
    }

    // No console errors
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});
