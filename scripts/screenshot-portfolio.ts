import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  page.on('domcontentloaded', async () => {
    await page.evaluate(() => {
      document.querySelectorAll('vite-error-overlay').forEach(el => el.remove());
    });
  });

  await page.goto('http://localhost:8081/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  await page.evaluate(() => {
    document.querySelectorAll('vite-error-overlay').forEach(el => el.remove());
  });
  await page.keyboard.press('Escape');

  // Click Portfolio toggle
  const portfolioToggle = page.locator('[data-testid="portfolio-mode-toggle"]').first();
  if (await portfolioToggle.isVisible().catch(() => false)) {
    const isChecked = await portfolioToggle.locator('button[role="switch"]').getAttribute('aria-checked');
    if (isChecked !== 'true') {
      await portfolioToggle.click();
      await page.waitForTimeout(3000);
    }
  }

  // Find the PortfolioPanel header area
  const portfolioPanel = page.locator('[data-testid="portfolio-mode-toggle"]').first();
  const parentHeader = portfolioPanel.locator('xpath=ancestor::div[contains(@class,"flex")][1]');

  // Take screenshot of the full mobile view
  await page.screenshot({ path: '/tmp/mobile-portfolio-full.png', fullPage: false });

  // Take screenshot of just the PortfolioPanel header area
  const headerBox = await portfolioPanel.boundingBox();
  if (headerBox) {
    // Get the parent header's bounding box
    const parentBox = await parentHeader.boundingBox();
    if (parentBox) {
      console.log('Portfolio toggle label box:', JSON.stringify(headerBox));
      console.log('Parent header box:', JSON.stringify(parentBox));
      console.log('Overflow check - label bottom:', headerBox.y + headerBox.height, 'parent bottom:', parentBox.y + parentBox.height);
      console.log('Overflow:', headerBox.y + headerBox.height > parentBox.y + parentBox.height ? 'YES' : 'NO');
    }
  }

  // Also check all header icon buttons for overflow
  const headerButtons = page.locator('[data-testid="portfolio-mode-toggle"] ~ button, [data-testid="portfolio-mode-toggle"] ~ * button');
  const count = await headerButtons.count();
  console.log(`Found ${count} sibling buttons in header area`);

  await page.screenshot({ path: '/tmp/mobile-portfolio-header.png', clip: { x: 0, y: 0, width: 390, height: 200 } });

  await browser.close();
  console.log('Screenshots saved to /tmp/mobile-portfolio-full.png and /tmp/mobile-portfolio-header.png');
}

main().catch(console.error);
