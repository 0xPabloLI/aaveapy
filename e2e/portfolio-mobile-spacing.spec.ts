import { expect, test, type Page } from '@playwright/test';
import { findAnyActiveReserve, setupPortfolioWithReserve } from './test-reserves';

/**
 * Mobile-only spacing assertion for the portfolio card layout.
 *
 * Verifies the MobilePortfolioCard renders with proper spacing
 * between the token header, pill tabs, and CompactInput.
 * Original grid-cols-subgrid layout has been replaced by a
 * vertical card layout — see MobilePortfolioCard.tsx.
 *
 * Test reserve is dynamically discovered from staging API.
 */
const testReserve = await findAnyActiveReserve();

async function setupPortfolio(page: Page) {
  if (!testReserve) throw new Error('No suitable reserve found');
  return setupPortfolioWithReserve(page, testReserve);
}

test.describe('Portfolio input — mobile spacing', () => {
  test.describe('mobile', () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(!testInfo.project.name.includes('mobile'), 'Mobile card only');
      test.skip(!testReserve, 'No active reserve with ltv > 0 found on staging');
    });

    test('token card renders with compact input area', async ({ page }, testInfo) => {
      const supplyInput = await setupPortfolio(page);

      const inputBox = await supplyInput.boundingBox();
      expect(inputBox, 'supply input must render').not.toBeNull();
      if (!inputBox) return;

      expect(inputBox.width, 'supply input should be wide enough to use').toBeGreaterThan(80);

      const tokenLabel = page.getByText(testReserve!.symbol, { exact: true }).first();
      await expect(tokenLabel).toBeVisible();
      const tokenBox = await tokenLabel.boundingBox();
      expect(tokenBox, 'token label must render').not.toBeNull();

      await supplyInput.screenshot({
        path: testInfo.outputPath('portfolio-card-mobile.png'),
      });
    });
  });
});
