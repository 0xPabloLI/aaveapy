import { expect, test, type Locator } from '@playwright/test';

async function waitDesktopTable(page: Parameters<typeof test>[0]['page']) {
  await expect(page.locator('tbody tr[data-reserve-id]').first()).toBeVisible();
}

function simulationScrollPort(mainRow: Locator) {
  return mainRow.locator('xpath=following-sibling::tr[1]').locator('[data-reserves-simulation-scrollport]').first();
}

async function readInnerScrollMetrics(scrollPort: Locator) {
  return scrollPort.evaluate((el) => ({
    scrollTop: el.scrollTop,
    maxScroll: Math.max(0, el.scrollHeight - el.clientHeight),
    overflowY: getComputedStyle(el).overflowY,
  }));
}

async function openExpandedSimulation(page: Parameters<typeof test>[0]['page']) {
  await page.goto('/');
  await waitDesktopTable(page);

  const supplyInput = page.locator(
    '[data-reserves-sticky-scenario] input[aria-label="Supply amount"]',
  );
  await supplyInput.fill('10000000');
  await page.waitForTimeout(1000);

  const mainRow = page.locator('tbody tr[data-reserve-id]').first();
  await mainRow.click();
  await expect(page.getByText('Simulation is for reference only')).toBeVisible({ timeout: 20_000 });

  const scrollPort = simulationScrollPort(mainRow);
  await expect(scrollPort).toBeVisible();
  return { scrollPort, supplyInput };
}

test.describe('Reserves simulation document scroll (desktop)', () => {
  test('wheel over simulation scrolls the document without inner vertical overflow', async ({
    page,
  }) => {
    const { scrollPort } = await openExpandedSimulation(page);
    const before = await readInnerScrollMetrics(scrollPort);

    expect(before.maxScroll, 'simulation must not create an inner vertical scroll range').toBeLessThanOrEqual(2);
    expect(before.overflowY, 'simulation must not use an inner vertical scrollport').not.toMatch(
      /^(auto|scroll)$/,
    );

    await scrollPort.hover();
    const windowBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 700);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), {
        timeout: 4000,
        message: 'wheel over the simulation should move the document',
      })
      .toBeGreaterThan(windowBefore + 24);

    const after = await readInnerScrollMetrics(scrollPort);
    expect(after.scrollTop, 'wheel must not be absorbed by the simulation wrapper').toBeLessThanOrEqual(1);
  });

  test('consecutive wheels keep inner scrollTop at zero while the scenario stays unchanged', async ({
    page,
  }) => {
    const { scrollPort, supplyInput } = await openExpandedSimulation(page);
    const initialScenario = await supplyInput.inputValue();
    const initialWindowY = await page.evaluate(() => window.scrollY);

    for (let gesture = 1; gesture <= 2; gesture += 1) {
      await scrollPort.hover();
      const windowBefore = await page.evaluate(() => window.scrollY);
      await page.mouse.wheel(0, 350);
      await expect
        .poll(() => page.evaluate(() => window.scrollY), {
          timeout: 4000,
          message: `document should advance after wheel gesture ${gesture}`,
        })
        .toBeGreaterThan(windowBefore + 12);

      const metrics = await readInnerScrollMetrics(scrollPort);
      expect(
        metrics.scrollTop,
        `wheel gesture ${gesture} must not advance an inner scroll position`,
      ).toBeLessThanOrEqual(1);
    }

    expect(await supplyInput.inputValue()).toBe(initialScenario);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(initialWindowY + 24);
  });
});
