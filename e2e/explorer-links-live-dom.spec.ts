import { test, expect } from '@playwright/test';
import { mkdir } from 'fs/promises';
import path from 'path';
import { buildPoolExplorerUrl } from '../src/lib/poolExplorerLinks';

const OUTPUT_DIR = path.join(process.cwd(), 'playwright-report', 'explorer-links-live');

const CASES = [
  {
    market: 'AaveV3Avalanche',
    kind: 'etherscan' as const,
    expectedUrlPart: 'snowscan.xyz/address/',
  },
  {
    market: 'AaveV3Soneium',
    kind: 'blockscout' as const,
    expectedUrlPart: 'soneium.blockscout.com/address/',
  },
  {
    market: 'AaveV3Ink',
    kind: 'blockscout' as const,
    expectedUrlPart: 'explorer.inkonchain.com/address/',
  },
  {
    market: 'AaveV3XLayer',
    kind: 'oklink' as const,
    expectedUrlPart: 'www.oklink.com/x-layer/address/',
  },
  {
    market: 'AaveV3Metis',
    kind: 'routescan' as const,
    expectedUrlPart: 'metisscan.info/address/',
  },
];

function cloudflareDetected(text: string): boolean {
  return /just a moment|security verification|verify you are not a bot|cloudflare/i.test(text);
}

test.describe('Explorer links live DOM verification', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await mkdir(OUTPUT_DIR, { recursive: true });
  });

  for (const testCase of CASES) {
    test(`${testCase.market} opens real explorer page and verifies target state`, async ({ page }) => {
      const url = buildPoolExplorerUrl(testCase.market);
      expect(url).toBeTruthy();
      expect(url!).toContain(testCase.expectedUrlPart);

      await page.goto(url!, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(4_000);

      const title = await page.title();
      const bodyText = (await page.locator('body').textContent().catch(() => '')) || '';
      const combined = `${title}\n${bodyText}`;

      await page.screenshot({
        path: path.join(OUTPUT_DIR, `${testCase.market}.png`),
        fullPage: true,
      });

      if (testCase.kind === 'etherscan') {
        // Etherscan-family explorers often trigger Cloudflare. If that happens,
        // we still assert we reached the intended explorer and capture evidence.
        if (cloudflareDetected(combined)) {
          expect(page.url()).toContain('snowscan.xyz');
          test.info().annotations.push({
            type: 'cloudflare',
            description: 'Explorer page was blocked by Cloudflare challenge; screenshot captured.',
          });
          return;
        }

        await expect(page.locator('#ContentPlaceHolder1_li_readProxyContract')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('#readProxyContract')).toBeAttached({ timeout: 15_000 });
        await expect(page.locator('body')).toContainText('Read as Proxy');
        await expect(page).toHaveURL(/#readProxyContract#F23/);
        return;
      }

      if (testCase.kind === 'blockscout') {
        await expect(page).toHaveURL(/tab=read_proxy/);
        await expect(page.locator('body')).toContainText(/Read\/Write proxy|Read\/Write contract|read_proxy/i);
        await expect(page.locator('body')).toContainText(/getReserveData|getReserveDeficit/i);
        return;
      }

      if (testCase.kind === 'oklink') {
        await expect(page).toHaveURL(/category=proxy-read/);
        await expect(page.locator('body')).toContainText(/Contract|Read Contract|proxy-read/i);
        return;
      }

      if (testCase.kind === 'routescan') {
        // Metis currently returns 403 from our automation environment.
        // Keep this as a live signal instead of pretending it works.
        expect(title + bodyText).toMatch(/403|Access Denied|Routescan/i);
      }
    });
  }
});
