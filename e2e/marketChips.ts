import type { Locator, Page } from '@playwright/test';

/**
 * Pick a chain chip from the rendered markets row.
 *
 * Chain names come from backend data and drift (Arbitrum and Celo both left
 * /markets by 2026-09-30), so specs must not name one: take whatever the app
 * actually rendered. Throws when nothing selectable exists — an empty table
 * must fail loudly rather than skip its way to a green run.
 */
export async function pickChainChip(page: Page): Promise<Locator> {
  const candidates = page.locator('[data-testid="markets-row"] button');
  const count = await candidates.count();

  for (let i = 0; i < count; i += 1) {
    const chip = candidates.nth(i);
    const label = ((await chip.textContent()) ?? '').trim();
    if (!label || label === 'All') continue;
    if (!(await chip.isVisible())) continue;
    return chip;
  }

  throw new Error(`No selectable chain chip among ${count} markets-row buttons`);
}
