// One-off Playwright script to manually verify AssetActionMenu popover
// positioning in a real browser. Opens the local dev server, clicks a menu
// trigger both with room below and with the trigger forced to the bottom of
// the viewport (forcing the "above" flip), and checks that the popover sits
// adjacent to the trigger without the old ~50px gap.
//
// Usage: node scripts/verify-asset-action-menu-position.mjs
// Requires:  npm run dev (running on http://localhost:8080)

import { chromium } from 'playwright';

const BASE_URL = process.env.AAVEAPY_DEV_URL ?? 'http://localhost:8080';

async function findAssetActionTrigger(page) {
  // Wait for at least one dashboard row to render then find the first action
  // menu button on the page.
  await page.waitForSelector('button[aria-label^="Asset actions for"]', { timeout: 45_000 });
  return page.locator('button[aria-label^="Asset actions for"]').first();
}

async function measurePopover(page) {
  // The popover uses a CSS zoom-in-95/fade-in-0 animation via tailwind
  // `animate-in`. Rather than reading the live, mid-animation
  // getBoundingClientRect (which is scaled), read the `style.top/left` we set
  // and the popover's fixed width so measurements are deterministic.
  return await page.evaluate(() => {
    const menu = document.querySelector('div[role="menu"][aria-label^="Asset actions for"]');
    if (!menu) return null;
    // getBoundingClientRect is scaled by the animate-in `zoom-in-95` transform
    // while the enter animation runs. offsetTop/Height/Left/Width are NOT
    // affected by CSS transforms, so use them for a deterministic measurement.
    const styleTop = parseFloat((menu.style.top || '').replace('px', ''));
    const styleLeft = parseFloat((menu.style.left || '').replace('px', ''));
    const styleWidth = parseFloat((menu.style.width || '').replace('px', ''));
    const height = menu.offsetHeight;
    return {
      top: styleTop,
      left: styleLeft,
      right: styleLeft + styleWidth,
      bottom: styleTop + height,
      width: styleWidth,
      height,
    };
  });
}

async function measureTrigger(trigger) {
  return await trigger.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  });
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const trigger = await findAssetActionTrigger(page);
    await trigger.scrollIntoViewIfNeeded();

    // Case A: trigger has plenty of room below.
    await trigger.click();
    await page.waitForSelector('div[role="menu"][aria-label^="Asset actions for"]', { timeout: 5_000 });
    const triggerA = await measureTrigger(trigger);
    const popoverA = await measurePopover(page);
    console.log('[Case A: below]');
    console.log('  trigger:', triggerA);
    console.log('  popover:', popoverA);
    const gapBelowA = popoverA.top - triggerA.bottom;
    const horizMismatchA = Math.abs(
      (triggerA.left + triggerA.width / 2) - (popoverA.left + popoverA.width / 2),
    );
    console.log(`  vertical gap (expect ~6): ${gapBelowA}px`);
    console.log(`  horizontal center mismatch (expect <=1): ${horizMismatchA}px`);

    // Close menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Case B: force the popover to flip above by shrinking the viewport so
    // the trigger sits near the bottom with no room for the popover below.
    // We size the viewport just tall enough to keep the trigger visible but
    // not the popover.
    const triggerY = triggerA.top;
    const newHeight = Math.max(260, Math.floor(triggerY + triggerA.height + 40));
    await context.pages()[0].setViewportSize({ width: 1440, height: newHeight });
    await page.waitForTimeout(200);

    await trigger.click();
    await page.waitForSelector('div[role="menu"][aria-label^="Asset actions for"]', { timeout: 5_000 });
    // Wait for 2nd-pass re-measurement to settle.
    await page.waitForTimeout(50);

    const triggerB = await measureTrigger(trigger);
    const popoverB = await measurePopover(page);
    console.log('\n[Case B: flipped above]');
    console.log('  trigger:', triggerB);
    console.log('  popover:', popoverB);
    const gapAboveB = triggerB.top - popoverB.bottom;
    const horizMismatchB = Math.abs(
      (triggerB.left + triggerB.width / 2) - (popoverB.left + popoverB.width / 2),
    );
    console.log(`  vertical gap (expect ~6): ${gapAboveB}px`);
    console.log(`  horizontal center mismatch (expect <=1 unless clamped): ${horizMismatchB}px`);

    await page.screenshot({ path: '/tmp/aaveapy-asset-action-menu-above.png', fullPage: false });
    console.log('\nScreenshot written to /tmp/aaveapy-asset-action-menu-above.png');

    // Hard assertions for CI-style output. Allow small slack to account for
    // sub-pixel rounding.
    const errors = [];
    if (Math.abs(gapBelowA - 6) > 1.5) errors.push(`Case A: unexpected gap ${gapBelowA}px (expected ~6).`);
    if (horizMismatchA > 1.5 && popoverA.left !== 8) errors.push(`Case A: horizontal mismatch ${horizMismatchA}px.`);
    if (Math.abs(gapAboveB - 6) > 1.5) errors.push(`Case B: gap above = ${gapAboveB}px (expected ~6). Old code showed ~50px.`);

    if (errors.length) {
      console.error('\nFAIL:');
      for (const e of errors) console.error('  -', e);
      process.exit(1);
    }
    console.log('\nOK: popover sits adjacent to the trigger in both cases.');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
