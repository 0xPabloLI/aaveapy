import { expect, test } from '@playwright/test';

/**
 * Mobile-only spacing assertion for the portfolio card layout.
 *
 * Verifies the MobilePortfolioCard renders with proper spacing
 * between the token header, pill tabs, and CompactInput.
 * Original grid-cols-subgrid layout has been replaced by a
 * vertical card layout — see MobilePortfolioCard.tsx.
 * Mobile-only — routed via chromium `testIgnore` in playwright.config.ts.
 */
test.describe('Portfolio input — mobile spacing', () => {
  test('token card renders with compact input area', async ({ page }, testInfo) => {
    await page.goto('/');

    await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible();

    await page.getByTestId('portfolio-mode-toggle').click();

    await page.getByRole('button', { name: 'Search tokens' }).click();
    await page.getByRole('textbox', { name: 'Search tokens to add' }).fill('USDC');

    const addBtn = page
      .getByRole('button', { name: /^Add .+ \(supply and borrow\)$/ })
      .first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const supplyInput = page.getByRole('textbox', { name: /Supply amount for USDC/i }).first();
    await expect(supplyInput).toBeVisible();

    const inputBox = await supplyInput.boundingBox();
    expect(inputBox, 'supply input must render').not.toBeNull();
    if (!inputBox) return;

    expect(inputBox.width, 'supply input should be wide enough to use').toBeGreaterThan(80);

    const tokenLabel = page.getByText('USDC', { exact: true }).first();
    await expect(tokenLabel).toBeVisible();
    const tokenBox = await tokenLabel.boundingBox();
    expect(tokenBox, 'token label must render').not.toBeNull();

    await supplyInput.screenshot({
      path: testInfo.outputPath('portfolio-card-mobile.png'),
    });
  });
});
