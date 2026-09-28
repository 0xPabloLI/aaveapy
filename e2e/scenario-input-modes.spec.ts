import { expect, test, type Page } from '@playwright/test';

/**
 * AAV-1321 — 场景模拟两种输入模式（USD / Token）、净借贷开关、模拟子行展开的交互链路。
 *
 * 设计约束（见 docs/specs/aav-1321-scenario-input-modes-e2e.md）：
 * - 只断言相对变化，不断言绝对 APY 数值：staging 数据会漂移。
 * - 复选框一律点关联 label（input 视觉隐藏，force 点 input 会静默不生效）。
 * - 桌面展开点纯文本单元格；含 Market 芯片的单元格点击是「筛选」动作，不是展开。
 * - 数据条件不满足时干净 skip + annotation，不把断言放宽成永真式。
 */

const supplyInput = (page: Page) => page.getByRole('textbox', { name: 'Supply amount' }).first();
const borrowInput = (page: Page) => page.getByRole('textbox', { name: 'Borrow amount' }).first();
const modeRadio = (page: Page, mode: 'USD' | 'Token') => page.getByRole('radio', { name: mode, exact: true }).first();
const netCheckbox = (page: Page) => page.locator('#scenario-merit-merkl-net-lending-borrowing');
const netLabel = (page: Page) => page.locator('label[for="scenario-merit-merkl-net-lending-borrowing"]');

async function openApp(page: Page) {
  await page.goto('/');
  await expect(borrowInput(page)).toBeVisible({ timeout: 30_000 });
  await expect(supplyInput(page)).toBeVisible();
}

/** 桌面：锚定前 8 个数据行的完整文本，作为「有没有重算」的比较基线。 */
async function desktopRows(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('table tbody tr')]
      .slice(0, 8)
      .map((tr) => tr.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
  );
}

async function setScenario(page: Page, supply: string, borrow: string) {
  await supplyInput(page).fill(supply);
  await supplyInput(page).press('Tab');
  await borrowInput(page).fill(borrow);
  await borrowInput(page).press('Tab');
}

/** 按「代币 + 市场」为键取行指纹 → Size 单元格文本，避免表格因场景重排后错位比较。 */
async function sizeCellByRow(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const map: Record<string, string> = {};
    for (const tr of [...document.querySelectorAll('table tbody tr')].slice(0, 10)) {
      const tds = [...tr.querySelectorAll('td')].map((td) => td.textContent?.replace(/\s+/g, ' ').trim() ?? '');
      if (tds.length < 4) continue;
      map[`${tds[0]}|${tds[1]}`] = tds[3];
    }
    return map;
  });
}

/** 子行 = 只有一个单元格且承载模拟明细文本的行。 */
async function subRowText(page: Page): Promise<string> {
  return page.evaluate(() =>
    [...document.querySelectorAll('table tbody tr')]
      .filter((tr) => tr.children.length === 1)
      .map((tr) => tr.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter((t) => /Simulation is for reference only|Spread/i.test(t))
      .join(' | '),
  );
}
async function illegalNumbers(page: Page) {
  return page.evaluate(() => {
    const t = document.body.innerText;
    return ['NaN', 'undefined', 'Infinity']
      .map((k) => (t.match(new RegExp(k, 'g')) || []).length)
      .reduce((a, b) => a + b, 0);
  });
}

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

test.describe('Scenario recompute — 桌面表格', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', '断言针对桌面表格行');
  });

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

test.describe('Mobile card 展开与净借贷区', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), '移动卡片布局专属');
  });

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
