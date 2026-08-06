import { expect, test } from '@playwright/test';

/**
 * Screenshot regression for PortfolioPanel header in both Single and
 * Portfolio modes. Catches subtle spacing/typography drift that
 * bounding-box assertions (portfolio-toggle-alignment.spec.ts) miss.
 *
 * Baselines live under e2e/*-snapshots/. Update with:
 *   npx playwright test e2e/portfolio-panel-header-visual.spec.ts --update-snapshots
 *
 * On first CI run (no -linux baseline), Playwright creates one and the
 * test passes. Use the generate-snapshots CI job to persist baselines.
 */

const BREAKPOINTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const bp of BREAKPOINTS) {
  test(`PortfolioPanel header visual @ ${bp.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/');

    await expect(
      page.getByRole('textbox', { name: 'Borrow amount' }),
    ).toBeVisible();

    // Single mode header (scenario controls cluster with toggle).
    const singleToggle = page.getByTestId('portfolio-mode-toggle');
    await expect(singleToggle).toBeVisible();
    const singleHeader = singleToggle.locator('xpath=ancestor::*[2]');
    await expect(singleHeader).toHaveScreenshot(
      `portfolio-header-single-${bp.name}.png`,
      { maxDiffPixelRatio: 0.01 },
    );

    await singleToggle.click();
    const portfolioToggle = page.getByTestId('portfolio-mode-toggle');
    await expect(portfolioToggle).toBeVisible();
    const portfolioHeader = portfolioToggle.locator('xpath=ancestor::*[3]');
    await expect(portfolioHeader).toHaveScreenshot(
      `portfolio-header-portfolio-${bp.name}.png`,
      { maxDiffPixelRatio: 0.01 },
    );
  });
}
