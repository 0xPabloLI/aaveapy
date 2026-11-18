import { expect, test } from '@playwright/test';
import { illegalNumbers } from './scenario-input-modes.helpers';
import {
  aprRadio,
  apyRadio,
  chainRadio,
  desktopRateSurface,
  expectSurfaceChange,
  hubRadio,
  marketsRowText,
  openApp,
} from './control-propagation.helpers';

/**
 * 全局控件传播契约（桌面）。
 *
 * 每个用例都走最短用户路径：只点切换、不输入任何金额，断言展示面立刻变化；
 * 再点回来，断言逐字节恢复。数值来自 staging，因此只比较相对变化。
 */
test.describe('Control propagation — 桌面', () => {
  test('CP1 切换 APR/APY，利率展示面立即变化且可精确恢复', async ({ page }) => {
    await openApp(page);
    const before = await desktopRateSurface(page);
    expect(before.length, '需要至少一行数据才能比较利率展示面').toBeGreaterThan(0);

    const apySelected = (await apyRadio(page).getAttribute('aria-checked')) === 'true';
    const target = apySelected ? aprRadio(page) : apyRadio(page);
    const restore = apySelected ? apyRadio(page) : aprRadio(page);

    await target.click();
    await expectSurfaceChange(() => desktopRateSurface(page), before, '切换 APR/APY 后表格利率数值应立即变化');

    await restore.click();
    await expect
      .poll(async () => JSON.stringify(await desktopRateSurface(page)), {
        timeout: 10_000,
        message: '切回原模式后表格应逐字节恢复',
      })
      .toBe(JSON.stringify(before));
    await expect(illegalNumbers(page)).resolves.toBe(0);
  });

  test('CP2 切换 Chain/Hub，Markets 芯片行立即变化且可精确恢复', async ({ page }, testInfo) => {
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
        message: '切换 Chain/Hub 后 Markets 芯片行应立即换成另一组',
      })
      .toBe(true);

    await restore.click();
    await expect
      .poll(async () => marketsRowText(page), {
        timeout: 10_000,
        message: '切回后 Markets 芯片行应精确恢复',
      })
      .toBe(before);
    await expect(illegalNumbers(page)).resolves.toBe(0);
  });
});
