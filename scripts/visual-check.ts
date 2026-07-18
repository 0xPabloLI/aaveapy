import { chromium } from 'playwright';
async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('domcontentloaded', async () => {
    await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()); });
  });
  // Navigate with watch address to trigger portfolio panel
  await page.goto('http://localhost:8081/?watch=0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()); });
  await page.keyboard.press('Escape');

  // Take full page screenshot
  await page.screenshot({ path: '/tmp/mobile-full.png', fullPage: false });
  console.log('Full screenshot saved');

  // Find portfolio toggle
  const toggle = page.locator('[data-testid="portfolio-mode-toggle"]').first();
  const toggleVisible = await toggle.isVisible().catch(() => false);
  console.log('Portfolio toggle visible:', toggleVisible);

  if (toggleVisible) {
    const checked = await toggle.locator('button[role="switch"]').getAttribute('aria-checked').catch(() => null);
    console.log('Toggle checked:', checked);
    if (checked !== 'true') {
      await toggle.click();
      await page.waitForTimeout(5000);
    }

    // Check overflow on the panel containing the toggle
    const overflowInfo = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="portfolio-mode-toggle"]');
      if (!t) return ['Toggle not found in DOM'];
      let panel: Element | null = t;
      for (let i = 0; i < 15 && panel; i++) {
        const parent = panel.parentElement;
        if (!parent) break;
        const rect = parent.getBoundingClientRect();
        if (rect.height > 0 && (parent.className.includes('rounded') || parent.className.includes('border'))) { panel = parent; break; }
        panel = parent;
      }
      if (!panel) return ['Panel not found'];
      const pr = panel.getBoundingClientRect();
      const results: string[] = [`Panel: y=${pr.y.toFixed(0)} h=${pr.height.toFixed(0)} right=${pr.right.toFixed(0)} bottom=${pr.bottom.toFixed(0)} class=${(panel.className || '').slice(0, 80)}`];
      const children = panel.querySelectorAll('*');
      for (const el of children) {
        const r = el.getBoundingClientRect();
        if (r.height === 0) continue;
        const oR = r.right > pr.right + 2;
        const oB = r.bottom > pr.bottom + 2;
        const oL = r.left < pr.left - 2;
        if (oR || oB || oL) {
          const cls = typeof el.className === 'string' ? el.className.split(' ').slice(0, 4).join('.') : '';
          results.push(`OVERFLOW ${el.tagName} .${cls} y=${r.y.toFixed(0)} h=${r.height.toFixed(0)} right=${r.right.toFixed(0)} bottom=${r.bottom.toFixed(0)} oR=${oR} oB=${oB} oL=${oL}`);
        }
      }
      return results;
    });
    overflowInfo.forEach((r) => console.log(r));
    await page.screenshot({ path: '/tmp/portfolio-overflow.png', fullPage: false });
  } else {
    console.log('Toggle not visible - taking screenshot of current state');
    await page.screenshot({ path: '/tmp/mobile-no-toggle.png', fullPage: false });
  }
  await browser.close();
}
main().catch(console.error);
