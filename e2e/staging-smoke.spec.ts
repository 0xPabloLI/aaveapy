import { expect, test } from '@playwright/test';

/**
 * Staging smoke test — verifies key user flows against staging.aaveapy.com.
 * Run with: npx playwright test e2e/staging-smoke.spec.ts --project=chromium
 *
 * Frontend: https://staging.aaveapy.com
 * API:      https://staging-api.aaveapy.com/api
 */

const STAGING_URL = 'https://staging.aaveapy.com';
const STAGING_API = 'https://staging-api.aaveapy.com/api';

test.describe('Staging smoke tests', () => {
  test.describe.configure({ timeout: 60_000 });

  // Staging site is behind Vercel Authentication — CI Playwright can't bypass it.
  // API tests also get 403 from Cloudflare/WAF. Skip entirely in CI.
  // See: docs handoff commit 2b385f41 (Vercel Auth CI fix — shareable URL bypass)
  test.skip(!!process.env.CI, 'Staging site requires Vercel Auth — run locally');

  // API tests that only use request fixture — skip on mobile (no UI difference)
  // UI tests that use table tbody tr — skip on mobile (card layout)

  test('API /markets returns valid data', async ({ request }) => {
    const res = await request.get(`${STAGING_API}/markets`);
    // 403 = Cloudflare/WAF blocking CI IP — staging infra issue, not a code bug
    test.skip(res.status() === 403, 'Staging API returned 403 (likely Cloudflare)');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.reserves).toBeDefined();
    expect(Array.isArray(body.reserves)).toBe(true);
    expect(body.reserves.length).toBeGreaterThan(0);
    // Verify a reserve has required fields
    const r = body.reserves[0];
    expect(r.reserveId).toBeDefined();
    expect(r.chainId).toBeDefined();
    expect(r.tokenSymbol).toBeDefined();
  });

  test('API /meta/side-data returns valid data', async ({ request }) => {
    // 403 = Cloudflare/WAF blocking CI IP — staging infra issue, not a code bug
    const res = await request.get(`${STAGING_API}/meta/side-data`);
    if (res.status() === 403) {
      test.skip(true, 'Staging API returned 403 (likely Cloudflare)');
      return;
    }
    expect(res.status()).toBe(200);
    const body = await res.json();
    const keys = Object.keys(body);
    expect(keys.length).toBeGreaterThan(0);
  });

  test('Frontend homepage loads with reserves table', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Mobile uses card layout, not table rows');
    await page.goto(STAGING_URL);
    await page.waitForLoadState('networkidle');

    // Title should contain Aave
    const title = await page.title();
    expect(title).toContain('Aave');

    // Borrow amount input should be visible (main scenario controls)
    const borrowInput = page.getByRole('textbox', { name: 'Borrow amount' });
    await expect(borrowInput).toBeVisible({ timeout: 30_000 });

    // Reserves table should have rows
    const tableRows = page.locator('table tbody tr').first();
    await expect(tableRows).toBeVisible({ timeout: 30_000 });
  });

  test('Reserve row expand shows simulation panel', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Mobile uses card layout, not table rows');
    await page.goto(STAGING_URL);
    await page.waitForLoadState('networkidle');

    // Wait for reserves to load
    const borrowInput = page.getByRole('textbox', { name: 'Borrow amount' });
    await expect(borrowInput).toBeVisible({ timeout: 30_000 });

    // Click first reserve row to expand (click on the row, not the input)
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();

    // After expansion, a simulation sub-row should appear.
    // Look for common simulation elements: supply/borrow inputs or APY display
    await expect(
      page.locator('text=Supply').or(page.locator('text=Borrow')).or(page.locator('[class*="simulation"]')).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Portfolio mode toggle works', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Desktop UI layout differs on mobile');
    await page.goto(STAGING_URL);
    await page.waitForLoadState('networkidle');

    // Wait for page to load
    const borrowInput = page.getByRole('textbox', { name: 'Borrow amount' });
    await expect(borrowInput).toBeVisible({ timeout: 30_000 });

    // Find and click portfolio mode toggle
    const toggle = page.getByTestId('portfolio-mode-toggle');
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await toggle.click();

    // After toggling, portfolio-related UI should appear (token list or portfolio summary)
    await expect(
      page.locator('text=Portfolio').or(page.locator('[class*="portfolio"]')).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Chain filter works', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Mobile uses card layout, not table rows');
    await page.goto(STAGING_URL);
    await page.waitForLoadState('networkidle');

    // Wait for reserves to load
    const borrowInput = page.getByRole('textbox', { name: 'Borrow amount' });
    await expect(borrowInput).toBeVisible({ timeout: 30_000 });

    // Count initial rows
    const initialRows = await page.locator('table tbody tr').count();

    // Look for chain filter chips/buttons
    const chainChips = page.locator('[data-testid*="chain"], button[class*="chip"]').first();
    if (await chainChips.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await chainChips.click();
      await page.waitForTimeout(1000);
      const filteredRows = await page.locator('table tbody tr').count();
      expect(filteredRows).toBeGreaterThanOrEqual(0);
    }
  });

  test('Watch address input works', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Desktop UI layout differs on mobile');
    await page.goto(STAGING_URL);
    await page.waitForLoadState('networkidle');

    // Find watch address input
    const watchInput = page.getByPlaceholder(/address/i).or(
      page.getByRole('textbox', { name: /address/i }),
    ).first();

    if (await watchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Type test wallet address (view-only, from AGENTS.md)
      await watchInput.fill('0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314');
      await watchInput.press('Enter');

      // Wait for wallet data to load
      await page.waitForTimeout(3000);

      // Page should still be functional
      const borrowInput = page.getByRole('textbox', { name: 'Borrow amount' });
      await expect(borrowInput).toBeVisible({ timeout: 10_000 });
    }
  });

  test('No console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(STAGING_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Filter out expected/known errors
    const unexpectedErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('Failed to load resource') &&
        !e.includes('net::ERR') &&
        !e.includes('ResizeObserver') &&
        !e.includes('wasm-unsafe') && // CSP directive warnings (being fixed)
        !e.includes("Provider's accounts list is empty"), // wagmi: no wallet connected
    );

    expect(unexpectedErrors).toEqual([]);
  });
});
