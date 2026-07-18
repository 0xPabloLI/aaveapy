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

  const toggle = page.locator('[data-testid="portfolio-mode-toggle"]').first();
  if (await toggle.isVisible().catch(() => false)) {
    const checked = await toggle.locator('button[role="switch"]').getAttribute('aria-checked').catch(() => null);
    if (checked !== 'true') { await toggle.click(); await page.waitForTimeout(5000); }
  }

  // Get ALL buttons + labels in the panel, list their positions
  const info = await page.evaluate(() => {
    const toggle = document.querySelector('[data-testid="portfolio-mode-toggle"]');
    if (!toggle) return ['Toggle not found'];
    // Walk up to find the panel container (has rounded + border)
    let panel: Element | null = toggle;
    for (let i = 0; i < 20 && panel; i++) {
      const parent = panel.parentElement;
      if (!parent) break;
      const cls = typeof parent.className === 'string' ? parent.className : '';
      if (cls.includes('rounded') && cls.includes('border')) { panel = parent; break; }
      panel = parent;
    }
    if (!panel) return ['Panel not found'];
    const pr = panel.getBoundingClientRect();
    const results: string[] = [`Panel: x=${pr.x.toFixed(1)} w=${pr.width.toFixed(1)} right=${pr.right.toFixed(1)} class=${(panel.className || '').slice(0, 100)}`];

    // Find ALL interactive elements (buttons, labels with role) in the panel's direct header area
    const allInteractive = panel.querySelectorAll('button, label[data-testid], [role="switch"], [role="radio"]');
    results.push(`Total interactive elements in panel: ${allInteractive.length}`);
    for (const el of allInteractive) {
      const r = el.getBoundingClientRect();
      if (r.height === 0) continue;
      const overflowsPanel = r.right > pr.right + 1 || r.bottom > pr.bottom + 1;
      const tag = el.tagName + (el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.textContent?.slice(0, 20) || '');
      results.push(`  ${tag}: x=${r.x.toFixed(1)} w=${r.width.toFixed(1)} right=${r.right.toFixed(1)} h=${r.height.toFixed(1)} overflows=${overflowsPanel}`);
    }
    return results;
  });
  info.forEach((r) => console.log(r));

  // Screenshot the header area specifically
  await page.screenshot({ path: '/tmp/portfolio-wallet-header.png', clip: { x: 0, y: 380, width: 390, height: 150 } });
  console.log('Screenshot saved');
  await browser.close();
}
main().catch(console.error);
