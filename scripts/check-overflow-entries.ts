import { chromium } from 'playwright';
async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('domcontentloaded', async () => {
    await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()); });
  });
  await page.goto('http://localhost:8081/?watch=0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
  await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()); });
  await page.keyboard.press('Escape');

  // Enable Portfolio mode
  const toggle = page.locator('[data-testid="portfolio-mode-toggle"]').first();
  if (await toggle.isVisible().catch(() => false)) {
    const checked = await toggle.locator('button[role="switch"]').getAttribute('aria-checked').catch(() => null);
    if (checked !== 'true') { await toggle.click(); await page.waitForTimeout(3000); }
  }

  // Add tokens via popular token chips
  const chips = page.locator('button:has-text("USDC"), button:has-text("WETH"), button:has-text("DAI"), button:has-text("WBTC")');
  const chipCount = await chips.count();
  console.log(`Found ${chipCount} popular token chips`);
  for (let i = 0; i < Math.min(3, chipCount); i++) {
    try { await chips.nth(i).click({ timeout: 2000 }); await page.waitForTimeout(1000); console.log(`Clicked chip ${i}`); } catch(e) { console.log(`Chip ${i} click failed`); }
  }
  await page.waitForTimeout(2000);

  // Check the panel with entries
  const info = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="portfolio-mode-toggle"]');
    if (!t) return ['Toggle not found'];
    let panel: Element | null = t;
    for (let i = 0; i < 20 && panel; i++) {
      const parent = panel.parentElement;
      if (!parent) break;
      const cls = typeof parent.className === 'string' ? parent.className : '';
      if (cls.includes('rounded') && cls.includes('border')) { panel = parent; break; }
      panel = parent;
    }
    if (!panel) return ['Panel not found'];
    const pr = panel.getBoundingClientRect();
    const results: string[] = [`Panel: x=${pr.x.toFixed(1)} w=${pr.width.toFixed(1)} right=${pr.right.toFixed(1)}`];
    const allButtons = panel.querySelectorAll('button, label[data-testid]');
    results.push(`Total interactive: ${allButtons.length}`);
    for (const el of allButtons) {
      const r = el.getBoundingClientRect();
      if (r.height === 0) continue;
      const overflows = r.right > pr.right + 1;
      const tag = el.tagName + '.' + (el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.textContent?.slice(0, 15) || '');
      results.push(`  ${tag}: x=${r.x.toFixed(1)} w=${r.width.toFixed(1)} right=${r.right.toFixed(1)} h=${r.height.toFixed(1)} OVERFLOW=${overflows}`);
    }
    return results;
  });
  info.forEach((r) => console.log(r));

  await page.screenshot({ path: '/tmp/portfolio-with-entries.png', clip: { x: 0, y: 380, width: 390, height: 150 } });
  console.log('Screenshot saved');
  await browser.close();
}
main().catch(console.error);
