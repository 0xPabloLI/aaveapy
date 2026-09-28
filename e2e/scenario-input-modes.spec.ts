import { expect, test } from '@playwright/test';

import {
  borrowInput,
  illegalNumbers,
  modeRadio,
  openApp,
  setScenario,
  supplyInput,
} from './scenario-input-modes.helpers';

/**
 * AAV-1321 — 场景模拟两种输入模式（USD / Token）的跨平台交互链路。
 *
 * 本文件只放两个 project 都要跑的用例；平台专属用例按 project 分文件：
 * - `scenario-input-modes.desktop.spec.ts`（桌面表格断言）
 * - `scenario-input-modes.mobile.spec.ts`（移动卡片断言）
 * 由 `playwright.config.ts` 的 testIgnore 各归其 project —— 不再用
 * `test.skip(project …)` 把「跑错平台」混进 skip 信号里（AGENTS.md E2E 规则）。
 *
 * 设计约束与探针见 `scenario-input-modes.helpers.ts` 与
 * `docs/specs/aav-1321-scenario-input-modes-e2e.md`。
 */

test.describe('Scenario input modes — 双平台共用', () => {
  test('M1/M2/M3/M4 切换 USD↔Token 改变控件状态与输入语义，并按设计清空输入', async ({ page }) => {
    await openApp(page);

    const usdPlaceholder = await supplyInput(page).getAttribute('placeholder');
    expect(usdPlaceholder, 'USD 模式占位符应为千分位美元形态').toMatch(/,/);

    await setScenario(page, '250000', '120000');
    await expect(supplyInput(page)).toHaveValue('250,000');

    await modeRadio(page, 'Token').click();
    await expect(modeRadio(page, 'Token')).toHaveAttribute('aria-checked', 'true');
    await expect(modeRadio(page, 'USD')).toHaveAttribute('aria-checked', 'false');

    const tokenPlaceholder = await supplyInput(page).getAttribute('placeholder');
    expect(tokenPlaceholder, 'Token 模式占位符应换成代币量级').not.toBe(usdPlaceholder);
    // M3：模式切换按设计清空（ScenarioControls.tsx handleModeChange → handleClear）
    await expect(supplyInput(page)).toHaveValue('');
    await expect(borrowInput(page)).toHaveValue('');

    // M4：切回 USD 后语义恢复
    await modeRadio(page, 'USD').click();
    await expect(supplyInput(page).first()).toHaveAttribute('placeholder', usdPlaceholder ?? '');
    await expect(illegalNumbers(page)).resolves.toBe(0);
  });

  test('M13 输入 0 与清空都保持页面健康，清空后无非法数值', async ({ page }) => {
    await openApp(page);
    await setScenario(page, '0', '0');
    await page.waitForTimeout(1500);
    await expect(illegalNumbers(page)).resolves.toBe(0);

    await setScenario(page, '', '');
    await page.waitForTimeout(1500);
    await expect(illegalNumbers(page)).resolves.toBe(0);
  });
});
