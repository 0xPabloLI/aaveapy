import { expect, type Page } from '@playwright/test';

/**
 * AAV-1321 场景模拟交互链路的共享定位器与探针。
 *
 * 拆成独立模块是因为平台专属用例已按 project 分文件
 * （`scenario-input-modes.desktop.spec.ts` / `.mobile.spec.ts`，由
 * `playwright.config.ts` 的 testIgnore 各归其 project），三个文件共用同一批
 * 选择器，避免复制粘贴出多份会各自漂移的 selector。
 *
 * 设计约束（见 docs/specs/aav-1321-scenario-input-modes-e2e.md）：
 * - 只断言相对变化，不断言绝对 APY 数值：staging 数据会漂移。
 * - 复选框一律点关联 label（input 视觉隐藏，force 点 input 会静默不生效）。
 * - 桌面展开点纯文本单元格；含 Market 芯片的单元格点击是「筛选」动作，不是展开。
 */

export const supplyInput = (page: Page) => page.getByRole('textbox', { name: 'Supply amount' }).first();
export const borrowInput = (page: Page) => page.getByRole('textbox', { name: 'Borrow amount' }).first();
export const modeRadio = (page: Page, mode: 'USD' | 'Token') =>
  page.getByRole('radio', { name: mode, exact: true }).first();
export const netCheckbox = (page: Page) => page.locator('#scenario-merit-merkl-net-lending-borrowing');
export const netLabel = (page: Page) => page.locator('label[for="scenario-merit-merkl-net-lending-borrowing"]');

export async function openApp(page: Page) {
  await page.goto('/');
  await expect(borrowInput(page)).toBeVisible({ timeout: 30_000 });
  await expect(supplyInput(page)).toBeVisible();
}

export async function setScenario(page: Page, supply: string, borrow: string) {
  await supplyInput(page).fill(supply);
  await supplyInput(page).press('Tab');
  await borrowInput(page).fill(borrow);
  await borrowInput(page).press('Tab');
}

/** 桌面：锚定前 8 个数据行的完整文本，作为「有没有重算」的比较基线。 */
export async function desktopRows(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('table tbody tr')]
      .slice(0, 8)
      .map((tr) => tr.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
  );
}

/** 按「代币 + 市场」为键取行指纹 → Size 单元格文本，避免表格因场景重排后错位比较。 */
export async function sizeCellByRow(page: Page): Promise<Record<string, string>> {
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
export async function subRowText(page: Page): Promise<string> {
  return page.evaluate(() =>
    [...document.querySelectorAll('table tbody tr')]
      .filter((tr) => tr.children.length === 1)
      .map((tr) => tr.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter((t) => /Simulation is for reference only|Spread/i.test(t))
      .join(' | '),
  );
}

export async function illegalNumbers(page: Page) {
  return page.evaluate(() => {
    const t = document.body.innerText;
    return ['NaN', 'undefined', 'Infinity']
      .map((k) => (t.match(new RegExp(k, 'g')) || []).length)
      .reduce((a, b) => a + b, 0);
  });
}
