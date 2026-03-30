import { expect, test, type Locator } from '@playwright/test';

async function waitDesktopTable(page: Parameters<typeof test>[0]['page']) {
  await expect(page.locator('tbody tr[data-reserve-id]').first()).toBeVisible();
}

/** Inner scrollport wrapping `SimulationSubRow` (desktop expanded row). */
function simulationScrollPort(mainRow: Locator) {
  return mainRow.locator('xpath=following-sibling::tr[1]').locator('[data-reserves-simulation-scrollport]').first();
}

async function readInnerScrollMetrics(scrollPort: Locator) {
  return scrollPort.evaluate((el) => ({
    scrollTop: el.scrollTop,
    maxScroll: Math.max(0, el.scrollHeight - el.clientHeight),
  }));
}

test.describe('Reserves simulation nested scroll (desktop)', () => {
  test.beforeEach(async ({ page: _page }, testInfo) => {
    test.skip(
      testInfo.project.name.includes('mobile'),
      'Desktop expanded row uses inner max-height scrollport',
    );
  });

  /**
   * Documents guardrails behavior: the expanded simulation sits in `overflow-y-auto` with
   * `max-height` (`DesktopReserveRow`). Wheel over that pane prefers inner `scrollTop`; wheel
   * over the sticky scenario strip moves `window` — same debounced scenario, different targets.
   */
  test('wheel over simulation inner pane scrolls inner scrollTop; wheel over scenario strip scrolls window', async ({
    page,
  }) => {
    await page.goto('/');
    await waitDesktopTable(page);

    const supplyInput = page.locator('[data-reserves-sticky-scenario] input[aria-label="Supply amount"]');
    await supplyInput.fill('10000000');
    await page.waitForTimeout(1000);

    const mainRow = page.locator('tbody tr[data-reserve-id]').first();
    await mainRow.click();
    await expect(page.getByText('Simulation is for reference only')).toBeVisible({ timeout: 20_000 });

    const scrollPort = simulationScrollPort(mainRow);
    await expect(scrollPort).toBeVisible();

    // Tighten max-height so overflow is deterministic across reserves/API payloads (assertion is wheel routing, not exact layout px).
    await scrollPort.evaluate((el) => {
      el.dataset.e2ePrevMaxHeight = el.style.maxHeight;
      el.dataset.e2ePrevOverflow = el.style.overflowY;
      el.style.maxHeight = '140px';
      el.style.overflowY = 'auto';
    });
    const hasOverflow = await scrollPort.evaluate((el) => el.scrollHeight > el.clientHeight + 24);
    expect(hasOverflow, 'simulation scrollport should overflow after E2E max-height clamp').toBe(true);

    try {
      const strip = page.locator('[data-reserves-sticky-scenario]').first();
      await strip.hover();
      const wBeforeStrip = await page.evaluate(() => window.scrollY);
      await page.mouse.wheel(0, 700);
      await expect
        .poll(() => page.evaluate(() => window.scrollY), {
          timeout: 4000,
          message: 'window scrollY should change after wheel on scenario strip',
        })
        .not.toBe(wBeforeStrip);
      const wAfterStrip = await page.evaluate(() => window.scrollY);
      const deltaStrip = Math.abs(wAfterStrip - wBeforeStrip);
      expect(deltaStrip, 'scenario strip wheel should move the document').toBeGreaterThan(24);

      await scrollPort.evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.evaluate((y) => window.scrollTo(0, y), wBeforeStrip);
      await page.waitForTimeout(200);

      await scrollPort.hover();
      const wBeforeInner = await page.evaluate(() => window.scrollY);
      const innerBefore = await scrollPort.evaluate((el) => el.scrollTop);
      await page.mouse.wheel(0, 700);
      await expect
        .poll(() => scrollPort.evaluate((el) => el.scrollTop), {
          timeout: 4000,
          message: 'inner scrollTop should increase after wheel on simulation pane',
        })
        .toBeGreaterThan(innerBefore + 20);

      const wAfterInner = await page.evaluate(() => window.scrollY);
      const innerAfter = await scrollPort.evaluate((el) => el.scrollTop);
      const deltaWindowInner = Math.abs(wAfterInner - wBeforeInner);
      const deltaInner = innerAfter - innerBefore;

      expect(deltaInner, 'simulation pane should absorb downward wheel into scrollTop').toBeGreaterThan(40);
      expect(
        deltaWindowInner,
        'window should move less when wheeling over inner simulation than strip wheel delta (nested scrollport)',
      ).toBeLessThan(deltaStrip * 0.85);
    } finally {
      await scrollPort.evaluate((el) => {
        el.style.maxHeight = el.dataset.e2ePrevMaxHeight ?? '';
        el.style.overflowY = el.dataset.e2ePrevOverflow ?? '';
        delete el.dataset.e2ePrevMaxHeight;
        delete el.dataset.e2ePrevOverflow;
      });
    }
  });
});

/**
 * Locks the **mechanism** behind the reported issue: shared scenario inputs do **not** change,
 * yet consecutive wheels over the gray simulation pane keep advancing **`scrollTop` on the inner
 * scrollport** — bottom content (`data-reserves-simulation-bottom-sentinel`) stays below the fold
 * until the user scrolls **inside** that pane. This is why a second gesture can feel “obscured”
 * even when debounced scenario is unchanged.
 */
test.describe('Repro: same-scenario double wheel on simulation (inner scroll advances)', () => {
  test.beforeEach(async ({ page: _page }, testInfo) => {
    test.skip(
      testInfo.project.name.includes('mobile'),
      'Desktop expanded row inner scrollport only',
    );
  });

  test('two wheels on simulation without changing scenario — inner scrollTop increases twice and bottom stays below fold', async ({
    page,
  }) => {
    await page.goto('/');
    await waitDesktopTable(page);

    const supplyInput = page.locator('[data-reserves-sticky-scenario] input[aria-label="Supply amount"]');
    await supplyInput.fill('10000000');
    await page.waitForTimeout(1000);

    const mainRow = page.locator('tbody tr[data-reserve-id]').first();
    await mainRow.click();
    await expect(page.getByText('Simulation is for reference only')).toBeVisible({ timeout: 20_000 });

    const scrollPort = simulationScrollPort(mainRow);
    await expect(scrollPort).toBeVisible();

    await scrollPort.evaluate((el) => {
      el.dataset.e2ePrevMaxHeight = el.style.maxHeight;
      el.dataset.e2ePrevOverflow = el.style.overflowY;
      el.style.maxHeight = '160px';
      el.style.overflowY = 'auto';
    });

    try {
      await scrollPort.evaluate((el) => {
        el.scrollTop = 0;
      });

      const m0 = await readInnerScrollMetrics(scrollPort);
      expect(m0.maxScroll, 'inner pane must overflow').toBeGreaterThan(40);

      await scrollPort.hover();
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(200);
      const m1 = await readInnerScrollMetrics(scrollPort);
      expect(m1.scrollTop, 'first wheel on simulation should advance inner scrollTop').toBeGreaterThan(m0.scrollTop);

      const wBeforeSecond = await page.evaluate(() => window.scrollY);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(250);
      const m2 = await readInnerScrollMetrics(scrollPort);
      const wAfterSecond = await page.evaluate(() => window.scrollY);

      const innerStillAdvances = m2.scrollTop > m1.scrollTop + 0.5;
      const innerMaxed =
        m1.maxScroll > 0 && m1.scrollTop >= m1.maxScroll - 2 && m2.scrollTop >= m1.scrollTop - 2;
      const secondWheelSpillsToWindow =
        innerMaxed && Math.abs(wAfterSecond - wBeforeSecond) > 12;

      expect(
        innerStillAdvances || secondWheelSpillsToWindow,
        'second wheel: either inner scrollTop increases again, or inner is maxed and window scrollY moves (nested-scroll handoff)',
      ).toBe(true);

      expect(m2.scrollTop - m0.scrollTop, 'accumulated inner scroll without scenario change').toBeGreaterThan(40);

      // From top: a modest first wheel must not max inner; bottom sentinel still lies below the inner fold (same scenario).
      await scrollPort.evaluate((el) => {
        el.scrollTop = 0;
      });
      await scrollPort.hover();
      await page.mouse.wheel(0, 160);
      await page.waitForTimeout(200);
      const mPartial = await readInnerScrollMetrics(scrollPort);
      expect(mPartial.scrollTop, 'partial wheel should move inner').toBeGreaterThan(8);
      expect(mPartial.scrollTop, 'leave headroom so sentinel can stay below fold').toBeLessThan(mPartial.maxScroll - 8);

      const sentinelPastFoldAfterPartial = await scrollPort.evaluate((port) => {
        const sent = port.querySelector('[data-reserves-simulation-bottom-sentinel]');
        if (!(sent instanceof HTMLElement)) return false;
        const pr = port.getBoundingClientRect();
        const sr = sent.getBoundingClientRect();
        return sr.bottom > pr.bottom + 0.5;
      });
      expect(
        sentinelPastFoldAfterPartial,
        'after partial wheel: bottom sentinel still below inner client bottom',
      ).toBe(true);
    } finally {
      await scrollPort.evaluate((el) => {
        el.style.maxHeight = el.dataset.e2ePrevMaxHeight ?? '';
        el.style.overflowY = el.dataset.e2ePrevOverflow ?? '';
        delete el.dataset.e2ePrevMaxHeight;
        delete el.dataset.e2ePrevOverflow;
      });
    }
  });
});
