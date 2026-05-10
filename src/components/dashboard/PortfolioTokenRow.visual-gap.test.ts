import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Visual gap regression guard for PortfolioTokenRow.
 *
 * The batch panel uses a unified single-column grid with
 * `auto minmax(_,1fr)` parent columns. The `auto` column
 * naturally matches the widest token in the list, so all
 * inputs are aligned across rows.
 *
 * Desktop and mobile share the same subgrid structure, differing
 * only in icon/font/padding sizes.
 *
 * Structural invariants:
 * 1. Both desktop and mobile rows use `grid-cols-subgrid`.
 * 2. Gap between token info and inputs is ≤ 4px (gap-x-1).
 */

describe('PortfolioTokenRow visual gap hole prevention', () => {
  const src = readFileSync(
    resolve(__dirname, 'PortfolioTokenRow.tsx'),
    'utf8',
  );

  const desktopStart = src.lastIndexOf('Desktop');
  const desktopSrc = desktopStart > 0 ? src.slice(desktopStart) : '';

  const mobileStart = src.indexOf('if (isMobile)');
  const mobileEnd = src.indexOf('// Desktop');
  const mobileSrc =
    mobileStart > 0 && mobileEnd > mobileStart
      ? src.slice(mobileStart, mobileEnd)
      : '';

  it('desktop row uses grid-cols-subgrid', () => {
    expect(desktopSrc, 'Desktop row must use subgrid').toMatch(/grid-cols-subgrid/);
  });

  it('mobile row uses grid-cols-subgrid (unified with desktop)', () => {
    expect(mobileSrc, 'Mobile row must use subgrid').toMatch(/grid-cols-subgrid/);
  });

  it('desktop gap between token info and inputs ≤ 4px', () => {
    const match = desktopSrc.match(/gap-x-(\d+(?:\.\d+)?)/);
    expect(match, 'Desktop row must declare a gap-x class').not.toBeNull();
    const gap = parseFloat(match![1]);
    expect(gap, `Desktop gap-x-${gap} > 4px`).toBeLessThanOrEqual(1);
  });

  it('mobile gap between token info and inputs ≤ 4px', () => {
    const match = mobileSrc.match(/gap-x-(\d+(?:\.\d+)?)/);
    expect(match, 'Mobile row must declare a gap-x class').not.toBeNull();
    const gap = parseFloat(match![1]);
    expect(gap, `Mobile gap-x-${gap} > 4px`).toBeLessThanOrEqual(1);
  });
});