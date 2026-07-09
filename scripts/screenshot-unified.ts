import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Remove Vite error overlay if present
  page.on('domcontentloaded', async () => {
    await page.evaluate(() => {
      document.querySelectorAll('vite-error-overlay').forEach(el => el.remove());
    });
  });

  // Navigate to the app with unified mode
  await page.goto('http://localhost:8082/?unified=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Remove any error overlays
  await page.evaluate(() => {
    document.querySelectorAll('vite-error-overlay').forEach(el => el.remove());
  });
  await page.keyboard.press('Escape');

  // Click the Portfolio toggle to enable portfolio mode
  // Look for the switch/toggle that says "Portfolio"
  const portfolioToggle = page.locator('label:has-text("Portfolio") button[role="switch"], [data-testid="portfolio-toggle"], button:has-text("Portfolio")').first();
  if (await portfolioToggle.isVisible().catch(() => false)) {
    // Check if it's already checked
    const isChecked = await portfolioToggle.getAttribute('aria-checked');
    if (isChecked !== 'true') {
      await portfolioToggle.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  } else {
    // Try clicking on the label itself
    const label = page.locator('text=Portfolio').first();
    if (await label.isVisible().catch(() => false)) {
      await label.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  }

  // Try to add tokens via popular token chips
  const chips = page.locator('button:has-text("USDC"), button:has-text("WETH"), button:has-text("DAI"), button:has-text("WBTC")');
  const chipCount = await chips.count().catch(() => 0);
  if (chipCount > 0) {
    for (let i = 0; i < Math.min(4, chipCount); i++) {
      await chips.nth(i).click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  // If no chips, try searching
  if (chipCount === 0) {
    const searchBtn = page.locator('button[aria-label*="earch"], button[aria-label*="Add"]').first();
    if (await searchBtn.isVisible().catch(() => false)) {
      await searchBtn.click();
      await page.waitForTimeout(800);
      const searchInput = page.locator('input[placeholder*="earch"], input[placeholder*="token"]').first();
      if (await searchInput.isVisible().catch(() => false)) {
        for (const sym of ['USDC', 'WETH', 'DAI']) {
          await searchInput.fill(sym);
          await page.waitForTimeout(1000);
          const result = page.locator(`[data-reserve-key], button:has-text("${sym}")`).first();
          if (await result.isVisible().catch(() => false)) {
            await result.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(500);
          }
        }
      }
    }
  }

  await page.waitForTimeout(2000);

  // Try to fill in some supply input values to show the results
  // Look for inputs in the unified table
  const supplyInputs = page.locator('input[aria-label*="supply"]');
  const supplyCount = await supplyInputs.count().catch(() => 0);
  if (supplyCount > 0) {
    await supplyInputs.first().fill('10000');
    await page.waitForTimeout(1000);
    if (supplyCount > 1) {
      await supplyInputs.nth(1).fill('5000');
      await page.waitForTimeout(1000);
    }
  }

  // Try to fill in a borrow input
  const borrowInputs = page.locator('input[aria-label*="borrow"]');
  const borrowCount = await borrowInputs.count().catch(() => 0);
  if (borrowCount > 0) {
    await borrowInputs.first().fill('2000');
    await page.waitForTimeout(1000);
  }

  await page.waitForTimeout(2000);

  // Take screenshot
  await page.screenshot({ path: 'output/playwright/unified-v2.png', fullPage: false });
  await page.screenshot({ path: 'output/playwright/unified-v2-full.png', fullPage: true });

  console.log('Screenshots saved to output/playwright/unified-v2.png');
  console.log('Full page: output/playwright/unified-v2-full.png');

  await browser.close();
}

main().catch(console.error);
