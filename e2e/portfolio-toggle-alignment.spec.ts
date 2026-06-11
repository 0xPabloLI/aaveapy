import { expect, test } from '@playwright/test';

/**
 * Regression guard for PortfolioPanel header spacing.
 *
 * The Portfolio-mode toggle (inside PortfolioPanel) must stay in the same
 * X position as the Single-mode toggle (inside ReservesTable's
 * scenarioControls). Both rely on --ds-space-3 (12px) right padding;
 * see docs/design/portfolio-panel-spacing.md.
 */

const BREAKPOINTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const bp of BREAKPOINTS) {
  test(`PortfolioModeToggle right-edge alignment @ ${bp.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/');

    // Wait for the reserves grid to render.
    await expect(
      page.getByRole('textbox', { name: 'Borrow amount' }),
    ).toBeVisible();

    // Single-mode toggle: located by its visible "Portfolio" label.
    const singleToggle = page.getByText('Portfolio', { exact: true }).first();
    await expect(singleToggle).toBeVisible();
    const singleBox = await singleToggle.boundingBox();
    expect(singleBox, 'single-mode toggle must render').not.toBeNull();
    if (!singleBox) return;
    const singleRight = singleBox.x + singleBox.width;

    // Switch to Portfolio mode.
    await singleToggle.click();

    // Portfolio-mode toggle lives in PortfolioPanel header.
    const portfolioToggle = page
      .getByText('Portfolio', { exact: true })
      .first();
    await expect(portfolioToggle).toBeVisible();
    const portfolioBox = await portfolioToggle.boundingBox();
    expect(portfolioBox, 'portfolio-mode toggle must render').not.toBeNull();
    if (!portfolioBox) return;
    const portfolioRight = portfolioBox.x + portfolioBox.width;

    // Allow 1px tolerance for subpixel rounding.
    expect(
      Math.abs(singleRight - portfolioRight),
      `toggle right-edge drift at ${bp.name}: single=${singleRight}px portfolio=${portfolioRight}px`,
    ).toBeLessThanOrEqual(1);
  });
}
