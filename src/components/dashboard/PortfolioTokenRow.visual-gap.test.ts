import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Visual gap regression guard for PortfolioTokenRow.
 *
 * The batch panel's token rows must NOT produce a "visual gap hole"
 * between token info (minus + icon + symbol + chain) and the supply/borrow
 * input area. Additionally, in desktop mode, token info has a fixed width
 * so supply/borrow inputs are vertically aligned across rows within the same
 * grid-cols-2 column.
 *
 * Structural invariants:
 * 1. Row is `flex` (NOT `grid-cols-subgrid`).
 * 2. Desktop: token info has fixed width `w-[160px]` — same width across
 *    all rows so inputs start at the same position.
 * 3. Mobile: token info has `shrink-0` — natural width, tight screen.
 * 4. Inputs container has `flex-1` — absorbs remaining space.
 * 5. Gap between token info and inputs is ≤ 6px (gap-x-1 / gap-x-1.5).
 */

describe('PortfolioTokenRow visual gap hole prevention', () => {
  const src = readFileSync(
    resolve(__dirname, 'PortfolioTokenRow.tsx'),
    'utf8',
  );

  // Helper: extract the desktop return JSX (after the "// Desktop" comment).
  const desktopStart = src.lastIndexOf('Desktop');
  const desktopSrc = desktopStart > 0 ? src.slice(desktopStart) : '';

  // Helper: extract the mobile return JSX (inside `if (isMobile)` block).
  const mobileStart = src.indexOf('if (isMobile)');
  const mobileEnd = src.indexOf('// Desktop');
  const mobileSrc =
    mobileStart > 0 && mobileEnd > mobileStart
      ? src.slice(mobileStart, mobileEnd)
      : '';

  it('desktop row uses flex (not grid-cols-subgrid)', () => {
    expect(
      desktopSrc,
      'Desktop row must use flex, not subgrid, to avoid inheriting parent fr column widths',
    ).not.toMatch(/grid-cols-subgrid/);
    expect(desktopSrc).toMatch(/flex\s/);
  });

  it('mobile row uses flex (not grid-cols-subgrid)', () => {
    expect(
      mobileSrc,
      'Mobile row must use flex, not subgrid, to avoid inheriting parent fr column widths',
    ).not.toMatch(/grid-cols-subgrid/);
    expect(mobileSrc).toMatch(/flex\s/);
  });

  it('desktop token info container has fixed width w-[160px] (inputs aligned across rows)', () => {
    expect(
      desktopSrc,
      'Desktop token info must have w-[160px] so all rows have the same left column width',
    ).toMatch(/w-\[160px\]/);
  });

  it('mobile token info container has shrink-0', () => {
    const flexChildren = mobileSrc.match(/shrink-0/g) ?? [];
    expect(
      flexChildren.length,
      'Mobile row must have shrink-0 on token info container',
    ).toBeGreaterThanOrEqual(1);
  });

  it('desktop inputs container has flex-1 (absorbs remaining space)', () => {
    expect(
      desktopSrc,
      'Desktop inputs column must have flex-1 to fill remaining width',
    ).toMatch(/flex-1/);
  });

  it('mobile inputs container has flex-1 (absorbs remaining space)', () => {
    expect(
      mobileSrc,
      'Mobile inputs column must have flex-1 to fill remaining width',
    ).toMatch(/flex-1/);
  });

  it('desktop gap between token info and inputs ≤ 6px', () => {
    // The gap-x class on the row must be gap-x-1 or gap-x-1.5 (≤ 6px).
    // Larger gaps (gap-x-2 = 8px, gap-x-2.5 = 10px) leave too much space.
    const match = desktopSrc.match(/gap-x-(\d+(?:\.\d+)?)/);
    expect(match, 'Desktop row must declare a gap-x class').not.toBeNull();
    const gap = parseFloat(match![1]);
    expect(
      gap,
      `Desktop row gap-x-${gap} exceeds maximum of 6px (use gap-x-1 or gap-x-1.5)`,
    ).toBeLessThanOrEqual(1.5);
  });

  it('mobile gap between token info and inputs ≤ 6px', () => {
    const match = mobileSrc.match(/gap-x-(\d+(?:\.\d+)?)/);
    expect(match, 'Mobile row must declare a gap-x class').not.toBeNull();
    const gap = parseFloat(match![1]);
    expect(
      gap,
      `Mobile row gap-x-${gap} exceeds maximum of 6px (use gap-x-1 or gap-x-1.5)`,
    ).toBeLessThanOrEqual(1.5);
  });
});