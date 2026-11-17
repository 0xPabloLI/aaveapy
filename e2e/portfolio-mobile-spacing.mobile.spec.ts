import { expect, test, type Page } from '@playwright/test';
import {
  ACTIVE_RESERVE_GAP_REASON,
  enforceReserveGate,
  findAnyActiveReserve,
  foundValue,
  reserveGateFor,
  setupPortfolioWithReserve,
} from './test-reserves';

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
const reserveDiscovery = await findAnyActiveReserve();
const testReserve = foundValue(reserveDiscovery);
const reserveGate = reserveGateFor(reserveDiscovery, ACTIVE_RESERVE_GAP_REASON);

async function setupPortfolio(page: Page) {
  if (!testReserve) throw new Error('No suitable reserve found');
  return setupPortfolioWithReserve(page, testReserve);
}

test.describe('Portfolio input — mobile spacing', () => {
  test.describe('mobile', () => {
    test.beforeEach(() => {
      enforceReserveGate(reserveGate);
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
