import { expect, test } from '@playwright/test';

import {
  desktopRows,
  illegalNumbers,
  modeRadio,
  netCheckbox,
  netLabel,
  openApp,
  setScenario,
  sizeCellByRow,
  subRowText,
} from './scenario-input-modes.helpers';

/**
 * AAV-1321 — 桌面表格专属断言（M5–M10）。
 *
 * 只在 `chromium` project 下收集：`playwright.config.ts` 的 `mobile-chromium`
 * testIgnore 排除了本文件。其它两个文件：
 * - `scenario-input-modes.spec.ts`（双平台共用）
 * - `scenario-input-modes.mobile.spec.ts`（移动卡片专属）
 *
 * 这样 skip 只剩「数据条件不满足」一种含义，不再夹带「跑错平台」。
 */

test.describe('Scenario recompute — 桌面表格', () => {
  test('M5 USD 场景驱动表格重算', async ({ page }, testInfo) => {
    await openApp(page);
    const baseline = await desktopRows(page);
    expect(baseline.length, '表格未渲染数据行').toBeGreaterThan(0);

    await setScenario(page, '250000', '120000');
    await expect
      .poll(async () => (await desktopRows(page)).filter((r, i) => r !== baseline[i]).length, {
        timeout: 20_000,
        message: '输入场景后应有行被重算',
      })
      .toBeGreaterThan(0);
    await expect(illegalNumbers(page)).resolves.toBe(0);
    testInfo.annotations.push({ type: 'note', description: '相对断言：不校验绝对 APY，抗 staging 数据漂移' });
  });

  test('M6 Token 模式场景重算并把 Size 列换成代币单位', async ({ page }) => {
    await openApp(page);
    const usdSizes = await sizeCellByRow(page);
    await modeRadio(page, 'Token').click();
    const before = await desktopRows(page);

    await setScenario(page, '3', '1');
    await expect
      .poll(async () => (await desktopRows(page)).filter((r, i) => r !== before[i]).length, {
        timeout: 20_000,
        message: 'Token 场景应驱动重算',
      })
      .toBeGreaterThan(0);

    const tokenSizes = await sizeCellByRow(page);
    const common = Object.keys(tokenSizes).filter((k) => k in usdSizes);
    expect(common.length, '两次快照无可比行（表格重排超出锚定范围）').toBeGreaterThan(0);
    expect(
      common.some((k) => usdSizes[k].includes('$')),
      'USD 模式 Size 应带 $ 前缀',
    ).toBe(true);
    expect(
      common.some((k) => tokenSizes[k].includes('$')),
      '代币模式 Size 不应带 $ 前缀',
    ).toBe(false);
    await expect(illegalNumbers(page)).resolves.toBe(0);
  });

  test('M7/M8 净借贷开关：走 label 生效且可逆', async ({ page }, testInfo) => {
    await openApp(page);
    await setScenario(page, '250000', '120000');
    await expect.poll(async () => (await desktopRows(page)).filter((r, i) => r !== '').length).toBeGreaterThan(0);

    expect(await netCheckbox(page).isChecked(), '净借贷默认应为开启').toBe(true);
    const withNet = await desktopRows(page);

    await netLabel(page).click();
    await expect(netCheckbox(page)).not.toBeChecked();
    const withoutNet = await desktopRows(page);
    const affected = withoutNet.filter((r, i) => r !== withNet[i]).length;
    if (affected === 0) {
      // 数据条件不满足（当前 staging 无 netting 可观察的行）：干净 skip，不放宽断言
      testInfo.annotations.push({
        type: 'note',
        description: '当前 staging 数据下无受 netting 影响的行，效果断言不适用',
      });
      test.skip(true, 'no netting-affected row in current staging data');
    }

    await netLabel(page).click();
    await expect(netCheckbox(page)).toBeChecked();
    // M8：切回后逐字节恢复
    await expect.poll(async () => (await desktopRows(page)).join('\n')).toBe(withNet.join('\n'));
  });

  test('M9 点整行（非芯片单元格）展开模拟子行', async ({ page }, testInfo) => {
    await openApp(page);
    await setScenario(page, '250000', '120000');
    expect(await subRowText(page), '未点击前不应有展开的子行').toBe('');

    await page.locator('table tbody tr').first().locator('td').nth(2).click();
    await expect.poll(() => subRowText(page), { timeout: 10_000 }).toMatch(/Simulation is for reference only|Spread/);
    await expect(illegalNumbers(page)).resolves.toBe(0);
    // 已知缺陷（AAV-1322）：桌面行展开后再点同一行不会收起——5 个单元格 × dev/生产
    // 双环境实测一致，而 handleToggleExpand 的代码语义是 toggle。收起路径未固定，
    // 故本用例不断言 collapse，避免把缺陷写成预期行为。
    testInfo.annotations.push({
      type: 'known-issue',
      description: 'AAV-1322：展开后再次点击行不收起；collapse 断言待缺陷修复后补',
    });
  });

  test('M10 点 Market 芯片是筛选动作，不展开模拟子行', async ({ page }) => {
    await openApp(page);
    const firstRow = page.locator('table tbody tr').first();
    const chip = firstRow.locator('td').nth(1).locator('button').first();
    expect(await chip.count(), 'Market 单元格内应有筛选按钮').toBeGreaterThan(0);
    await chip.click();
    await page.waitForTimeout(2000);
    expect(await subRowText(page), 'Market 芯片点击不应展开子行').toBe('');
  });
});
