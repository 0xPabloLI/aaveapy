import { expect, test } from '@playwright/test';

import { illegalNumbers, modeRadio, openApp, setScenario, supplyInput } from './scenario-input-modes.helpers';

/**
 * AAV-1321 — 移动卡片专属断言（M11/M11b）。
 *
 * 只在 `mobile-chromium` project 下收集：`playwright.config.ts` 的 `chromium`
 * testIgnore 排除了本文件。其它两个文件：
 * - `scenario-input-modes.spec.ts`（双平台共用）
 * - `scenario-input-modes.desktop.spec.ts`（桌面表格专属）
 */

test.describe('Mobile card 展开与净借贷区', () => {
  test('M11 展开卡片详情面板，并在输入场景后保持展开态', async ({ page }) => {
    await openApp(page);
    const expand = page.getByRole('button', { name: /Expand details panel/i }).first();
    await expect(expand).toBeVisible({ timeout: 30_000 });
    await expand.click();

    const collapse = page.getByRole('button', { name: /Collapse details panel/i }).first();
    await expect(collapse).toBeVisible();

    await setScenario(page, '250000', '120000');
    await expect(collapse).toBeVisible({ timeout: 20_000 });
    await expect(illegalNumbers(page)).resolves.toBe(0);
  });

  test('M11b 移动端模式切换同样清空输入', async ({ page }) => {
    await openApp(page);
    await setScenario(page, '100000', '50000');
    await modeRadio(page, 'Token').click();
    await expect(supplyInput(page)).toHaveValue('');
    await expect(modeRadio(page, 'Token')).toHaveAttribute('aria-checked', 'true');
  });
});
