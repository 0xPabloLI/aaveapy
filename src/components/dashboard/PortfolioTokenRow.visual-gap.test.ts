import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Visual gap regression guard for PortfolioTokenRow.
 *
 * The batch panel's token rows must NOT produce a "visual gap hole"
 * between token info (minus + icon + symbol + chain) and the supply/borrow
 * input area.
 *
 * Desktop: rows live in half-grids with `auto minmax(_,1fr)` parent columns.
 *          The `auto` column naturally matches the widest token in that half,
 *          so all rows have their inputs aligned. Rows use subgrid to inherit
 *          the parent `auto` column width.
 * Mobile:  rows use flex with shrink-0 token info + flex-1 inputs for
 *          maximum compactness on narrow screens.
 *
 * Structural invariants:
 * 1. Desktop row uses `grid-cols-subgrid` (inherits parent auto column width).
 * 2. Mobile row uses `flex` (not subgrid).
 * 3. Mobile token info has `shrink-0` — natural width.
 * 4. Mobile inputs have `flex-1` — absorbs remaining space.
 * 5. Gap between token info and inputs is ≤ 4px (gap-x-1) for both.
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

  it('desktop row uses grid-cols-subgrid (inherits parent auto column width)', () => {
    expect(
      desktopSrc,
      'Desktop row must use subgrid to inherit parent auto column for column-level alignment',
    ).toMatch(/grid-cols-subgrid/);
  });

  it('mobile row uses flex (NOT grid-cols-subgrid)', () => {
    expect(
      mobileSrc,
      'Mobile row must use flex for compact layout on narrow screens',
    ).not.toMatch(/grid-cols-subgrid/);
    expect(mobileSrc).toMatch(/flex\s/);
  });

  it('mobile token info container has shrink-0', () => {
    const flexChildren = mobileSrc.match(/shrink-0/g) ?? [];
    expect(
      flexChildren.length,
      'Mobile row must have shrink-0 on token info container for natural width',
    ).toBeGreaterThanOrEqual(1);
  });

  it('mobile inputs container has flex-1 (absorbs remaining space)', () => {
    expect(
      mobileSrc,
      'Mobile inputs must have flex-1 to fill remaining width',
    ).toMatch(/flex-1/);
  });

  it('desktop gap between token info and inputs ≤ 4px', () => {
    const match = desktopSrc.match(/gap-x-(\d+(?:\.\d+)?)/);
    expect(match, 'Desktop row must declare a gap-x class').not.toBeNull();
    const gap = parseFloat(match![1]);
    expect(
      gap,
      `Desktop row gap-x-${gap} exceeds maximum of 4px (use gap-x-1)`,
    ).toBeLessThanOrEqual(1);
  });

  it('mobile gap between token info and inputs ≤ 4px', () => {
    const match = mobileSrc.match(/gap-x-(\d+(?:\.\d+)?)/);
    expect(match, 'Mobile row must declare a gap-x class').not.toBeNull();
    const gap = parseFloat(match![1]);
    expect(
      gap,
      `Mobile row gap-x-${gap} exceeds maximum of 4px (use gap-x-1)`,
    ).toBeLessThanOrEqual(1);
  });
});