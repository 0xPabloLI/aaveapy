import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  page.on('domcontentloaded', async () => {
    await page.evaluate(() => {
      document.querySelectorAll('vite-error-overlay').forEach(el => el.remove());
    });
  });

  await page.goto('http://localhost:8082/?unified=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  await page.evaluate(() => {
    document.querySelectorAll('vite-error-overlay').forEach(el => el.remove());
  });
  await page.keyboard.press('Escape');

  // Click Portfolio toggle
  const portfolioToggle = page.locator('label:has-text("Portfolio") button[role="switch"], [data-testid="portfolio-toggle"], button:has-text("Portfolio")').first();
  if (await portfolioToggle.isVisible().catch(() => false)) {
    const isChecked = await portfolioToggle.getAttribute('aria-checked');
    if (isChecked !== 'true') {
      await portfolioToggle.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  }

  // Add tokens via chips
  const chips = page.locator('button:has-text("USDC"), button:has-text("WETH"), button:has-text("DAI"), button:has-text("WBTC")');
  const chipCount = await chips.count().catch(() => 0);
  console.log(`Found ${chipCount} chips`);
  if (chipCount > 0) {
    for (let i = 0; i < Math.min(4, chipCount); i++) {
      await chips.nth(i).click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  // If no chips, try search
  if (chipCount === 0) {
    console.log('No chips found, trying search...');
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

  // Fill in some inputs
  const supplyInputs = page.locator('input[aria-label*="supply"]');
  const supplyCount = await supplyInputs.count().catch(() => 0);
  console.log(`Found ${supplyCount} supply inputs`);
  if (supplyCount > 0) {
    await supplyInputs.first().fill('10000');
    await page.waitForTimeout(1000);
    if (supplyCount > 1) {
      await supplyInputs.nth(1).fill('5000');
      await page.waitForTimeout(1000);
    }
  }

  const borrowInputs = page.locator('input[aria-label*="borrow"]');
  const borrowCount = await borrowInputs.count().catch(() => 0);
  console.log(`Found ${borrowCount} borrow inputs`);
  if (borrowCount > 0) {
    await borrowInputs.first().fill('2000');
    await page.waitForTimeout(1000);
  }

  await page.waitForTimeout(2000);

  // Extract table info
  const tableInfo = await page.evaluate(() => {
    const table = document.querySelector('table');
    if (!table) return { error: 'No table found' };

    const rect = table.getBoundingClientRect();
    const cols = table.querySelectorAll('colgroup col');
    const colWidths = Array.from(cols).map(c => (c as HTMLElement).getAttribute('style') || '');

    const headerCells = table.querySelectorAll('thead th');
    const headerTexts = Array.from(headerCells).map(th => ({
      text: th.textContent?.trim() || '',
      width: th.getBoundingClientRect().width,
      colspan: th.getAttribute('colspan'),
      rowspan: th.getAttribute('rowspan'),
    }));

    const bodyRows = table.querySelectorAll('tbody tr');
    const rowCount = bodyRows.length;

    // Get first data row cell widths
    const firstRow = bodyRows[0]?.querySelectorAll('td');
    const cellWidths = firstRow ? Array.from(firstRow).map(td => ({
      text: td.textContent?.trim().substring(0, 30) || '',
      width: Math.round(td.getBoundingClientRect().width),
    })) : [];

    // Check for overflow
    const container = table.closest('div');
    const containerRect = container?.getBoundingClientRect();
    const hasOverflow = container ? container.scrollWidth > container.clientWidth : false;

    return {
      tableWidth: Math.round(rect.width),
      tableHeight: Math.round(rect.height),
      colWidths,
      headerTexts,
      rowCount,
      cellWidths,
      hasOverflow,
      containerWidth: containerRect ? Math.round(containerRect.width) : null,
      containerScrollWidth: container ? container.scrollWidth : null,
    };
  });

  console.log('\n=== Table Info ===');
  console.log(JSON.stringify(tableInfo, null, 2));

  // Take screenshot
  await page.screenshot({ path: 'output/playwright/unified-v2.png', fullPage: false });
  await page.screenshot({ path: 'output/playwright/unified-v2-full.png', fullPage: true });

  console.log('\nScreenshots saved to output/playwright/unified-v2.png');

  await browser.close();
}

main().catch(console.error);
