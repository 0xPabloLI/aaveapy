import { test, expect } from '@playwright/test';
import { buildPoolExplorerUrl } from '../src/lib/poolExplorerLinks';

// Markets to smoke test (the 7 mentioned in the task)
const EXPLORER_SMOKE_TESTS = [
  { market: 'AaveV3Ethereum', name: 'Etherscan', expectedTitle: /Etherscan/i },
  { market: 'AaveV3Arbitrum', name: 'Arbiscan', expectedTitle: /Arbiscan/i },
  { market: 'AaveV3Base', name: 'Basescan', expectedTitle: /Basescan|Base/i },
  { market: 'AaveV3Metis', name: 'Metisscan', expectedTitle: /Metis/i },
  { market: 'AaveV3Soneium', name: 'Blockscout Soneium', expectedTitle: /Blockscout|Soneium/i },
  { market: 'AaveV3Ink', name: 'Blockscout Ink', expectedTitle: /Blockscout|Ink/i },
  { market: 'AaveV3XLayer', name: 'OKLink XLayer', expectedTitle: /OKLink|X Layer/i },
];

test.describe('Explorer deep-link smoke tests', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const { market, name, expectedTitle } of EXPLORER_SMOKE_TESTS) {
    test(`[${name}] ${market} URL loads and shows contract`, async ({ page }) => {
      const url = buildPoolExplorerUrl(market);
      test.skip(!url, `No explorer URL configured for ${market}`);

      // Navigate to the explorer URL directly
      await page.goto(url!, { timeout: 30000 });

      // Verify page loaded (check title or specific element)
      await expect(page).toHaveTitle(expectedTitle, { timeout: 15000 });

      // Basic sanity check: address should appear somewhere on page
      const poolAddressMatch = buildPoolExplorerUrl(market)?.match(/0x[a-fA-F0-9]{40}/);
      if (poolAddressMatch) {
        const poolAddress = poolAddressMatch[0];
        // Look for the address (may be truncated in UI, so check partial)
        const bodyText = await page.locator('body').textContent();
        expect(bodyText).toMatch(new RegExp(poolAddress.slice(0, 8), 'i'));
      }
    });
  }
});
