import { expect, test } from '@playwright/test';

/**
 * Screenshot regression for PortfolioPanel header in both Single and
 * Portfolio modes. Catches subtle spacing/typography drift that
 * bounding-box assertions (portfolio-toggle-alignment.spec.ts) miss.
 *
 * Baselines live under e2e/*-snapshots/. Update with:
 *   npx playwright test e2e/portfolio-panel-header-visual.spec.ts --update-snapshots
 *
 * Skipped in CI: baselines are platform-specific (darwin). CI runs on
 * Linux where font rendering differs, causing false positives.
 */

const BREAKPOINTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const bp of BREAKPOINTS) {
  test(`PortfolioPanel header visual @ ${bp.name}`, async ({ page }) => {
    test.skip(!!process.env.CI, 'Screenshot baselines are macOS-specific — run locally');
    test.setTimeout(120_000);
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/');

    await expect(
      page.getByRole('textbox', { name: 'Borrow amount' }),
    ).toBeVisible({ timeout: 30_000 });

    // Single mode header (scenario controls cluster with toggle).
    // Use parent navigation instead of fragile xpath=ancestor::*[N] which
    // breaks when the DOM nesting depth changes.
    const singleToggle = page.getByTestId('portfolio-mode-toggle');
    await expect(singleToggle).toBeVisible({ timeout: 10_000 });
    const singleHeader = singleToggle.locator('xpath=../..');
    await expect(singleHeader).toHaveScreenshot(
      `portfolio-header-single-${bp.name}.png`,
      { maxDiffPixelRatio: 0.01, timeout: 30_000, animations: 'disabled' },
    );

    await singleToggle.click();
    const portfolioToggle = page.getByTestId('portfolio-mode-toggle');
    await expect(portfolioToggle).toBeVisible({ timeout: 10_000 });
    const portfolioHeader = portfolioToggle.locator('xpath=../..');
    await expect(portfolioHeader).toHaveScreenshot(
      `portfolio-header-portfolio-${bp.name}.png`,
      { maxDiffPixelRatio: 0.01, timeout: 30_000, animations: 'disabled' },
    );
  });
}
