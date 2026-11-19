import { expect, type Page } from '@playwright/test';
import { openApp } from './scenario-input-modes.helpers';

/**
 * 全局「控件 → 展示面」传播契约的共享探针。
 *
 * 设计目标：只验「点控件后展示面立刻变、点回来精确恢复」，不写死任何
 * staging 数值。USD/Token 的最短路径已由 `scenario-input-modes` 的 M6b/M11c
 * 拥有；这里覆盖另外两组全局 SegmentedToggle：APR/APY 与 Chain/Hub。
 */

export const aprRadio = (page: Page) => page.getByRole('radio', { name: 'APR', exact: true }).first();
export const apyRadio = (page: Page) => page.getByRole('radio', { name: 'APY', exact: true }).first();
export const chainRadio = (page: Page) => page.getByRole('radio', { name: 'Chain', exact: true }).first();
export const hubRadio = (page: Page) => page.getByRole('radio', { name: 'Hub', exact: true }).first();

export const marketsRow = (page: Page) => page.locator('[data-testid="markets-row"]');

/** 桌面：前 8 个数据行的完整文本，作为「利率/数值有没有变」的比较基线。 */
export async function desktopRateSurface(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('table tbody tr')]
      .slice(0, 8)
      .map((tr) => tr.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
  );
}

/** 移动：前 4 张卡片（含 Supply/Borrow/Liquidity 数值）的完整文本。 */
export async function mobileRateSurface(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-reserve-id]')]
      .slice(0, 4)
      .map((el) => el.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
  );
}

export async function marketsRowText(page: Page): Promise<string> {
  return (await marketsRow(page).innerText()).replace(/\s+/g, ' ').trim();
}

/**
 * 等展示面相对基线发生变化；用于「切换必须立刻有可见效果」的断言。
 */
export async function expectSurfaceChange(
  read: () => Promise<string[] | string>,
  baseline: string[] | string,
  message: string,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const current = await read();
        return Array.isArray(current) ? JSON.stringify(current) !== JSON.stringify(baseline) : current !== baseline;
      },
      { timeout: 10_000, message },
    )
    .toBe(true);
}

export { openApp };
