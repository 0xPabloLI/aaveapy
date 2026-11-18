import { expect, test } from '@playwright/test';
import { illegalNumbers } from './scenario-input-modes.helpers';
import {
  aprRadio,
  apyRadio,
  chainRadio,
  expectSurfaceChange,
  hubRadio,
  marketsRowText,
  mobileRateSurface,
  openApp,
} from './control-propagation.helpers';

/**
 * 全局控件传播契约（移动）。
 *
 * 与桌面同一语义，但展示面是卡片而非表格行；Chain/Hub 仍读同一颗
 * `[data-testid="markets-row"]`。
 */
test.describe('Control propagation — 移动', () => {
  test('CP3 切换 APR/APY，卡片利率展示面立即变化且可精确恢复', async ({ page }) => {
    await openApp(page);
    const before = await mobileRateSurface(page);
    expect(before.length, '需要至少一张卡片才能比较利率展示面').toBeGreaterThan(0);

    const apySelected = (await apyRadio(page).getAttribute('aria-checked')) === 'true';
    const target = apySelected ? aprRadio(page) : apyRadio(page);
    const restore = apySelected ? apyRadio(page) : aprRadio(page);

    await target.click();
    await expectSurfaceChange(() => mobileRateSurface(page), before, '移动端切换 APR/APY 后卡片利率数值应立即变化');

    await restore.click();
    await expect
      .poll(async () => JSON.stringify(await mobileRateSurface(page)), {
        timeout: 10_000,
        message: '移动端切回原模式后卡片应逐字节恢复',
      })
      .toBe(JSON.stringify(before));
    await expect(illegalNumbers(page)).resolves.toBe(0);
  });

  test('CP4 切换 Chain/Hub，Markets 芯片行立即变化且可精确恢复', async ({ page }, testInfo) => {
    await openApp(page);
    if ((await hubRadio(page).count()) === 0) {
      testInfo.annotations.push({ type: 'note', description: '当前数据没有 hub 条目，跳过 Chain/Hub 传播断言' });
      test.skip(true, '当前数据没有 hub 条目');
    }

    const before = await marketsRowText(page);
    const chainSelected = (await chainRadio(page).getAttribute('aria-checked')) === 'true';
    const target = chainSelected ? hubRadio(page) : chainRadio(page);
    const restore = chainSelected ? chainRadio(page) : hubRadio(page);

    await target.click();
    await expect
      .poll(async () => (await marketsRowText(page)) !== before, {
        timeout: 10_000,
        message: '移动端切换 Chain/Hub 后 Markets 芯片行应立即换成另一组',
      })
      .toBe(true);

    await restore.click();
    await expect
      .poll(async () => marketsRowText(page), {
        timeout: 10_000,
        message: '移动端切回后 Markets 芯片行应精确恢复',
      })
      .toBe(before);
    await expect(illegalNumbers(page)).resolves.toBe(0);
  });
});
