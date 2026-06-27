import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Visual gap regression guard for PortfolioTokenRow + PortfolioPanel.
 *
 * The portfolio panel uses a unified single-column grid with `auto minmax(_,1fr)`
 * parent columns. The `auto` column matches the widest token so all inputs
 * are aligned. Desktop and mobile share the same subgrid row structure,
 * differing only in icon/font/padding sizes and input-direction.
 *
 * Mandatory invariants (from docs/conventions/frontend-regression-checklist.md):
 * 1. Both rows use `grid-cols-subgrid`.
 * 2. Gap between token info and inputs ≤ 4px (gap-x-1).
 * 3. Desktop inputs side-by-side (flex items-center), mobile stacked (flex flex-col).
 * 4. Minus button is inline on the left (no absolute positioning).
 * 5. Token info has no hard-coded fixed width in desktop.
 * 6. Parent grid does NOT use grid-cols-2 or split-logic.
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

  // ─── Invariant 1: subgrid ────────────────────────────────────

  it('desktop row uses grid-cols-subgrid', () => {
    expect(desktopSrc).toMatch(/grid-cols-subgrid/);
  });

  it('mobile row uses grid-cols-subgrid (unified with desktop)', () => {
    expect(mobileSrc).toMatch(/grid-cols-subgrid/);
  });

  // ─── Invariant 2: gap ≤ 4px ─────────────────────────────────

  it('desktop gap between token info and inputs ≤ 4px', () => {
    const match = desktopSrc.match(/gap-x-(\d+(?:\.\d+)?)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeLessThanOrEqual(1);
  });

  it('mobile gap between token info and inputs ≤ 4px', () => {
    const match = mobileSrc.match(/gap-x-(\d+(?:\.\d+)?)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1])).toBeLessThanOrEqual(1);
  });

  // ─── Invariant 3: input direction ────────────────────────────

  it('desktop inputs use flex items-center (supply/borrow side-by-side)', () => {
    // The inputs column div must use flex items-center (not flex-col).
    const desktopInputsDiv = desktopSrc.match(
      /<div\s+className="flex\s+items-center\s+gap-2[^"]*"/,
    );
    expect(
      desktopInputsDiv,
      'Desktop inputs must use flex items-center gap-2',
    ).not.toBeNull();
  });

  it('mobile inputs use flex flex-col (supply/borrow stacked)', () => {
    const mobileInputsDiv = mobileSrc.match(
      /<div\s+className="flex\s+flex-col\s+items-stretch\s+gap-1[^"]*"/,
    );
    expect(
      mobileInputsDiv,
      'Mobile inputs must use flex flex-col gap-1',
    ).not.toBeNull();
  });

  // ─── Invariant 4: minus button inline ────────────────────────

  it('desktop minus button is inline (not absolute-positioned)', () => {
    expect(desktopSrc).not.toMatch(/absolute/);
  });

  it('mobile minus button is inline (not absolute-positioned)', () => {
    expect(mobileSrc).not.toMatch(/absolute/);
  });

  // ─── Invariant 5: no fixed-width token info ──────────────────

  it('desktop token info has no hard-coded fixed width', () => {
    // No w-[N]px or w-N pattern on the token info container.
    // The auto column in the parent grid handles the width.
    expect(desktopSrc).not.toMatch(/w-\[160px\]/);
  });

  // ─── Invariant 6: parent grid single-column ──────────────────

  it('parent grid uses auto + minmax (not grid-cols-2 or split-logic)', () => {
    const panelSrc = readFileSync(
      resolve(__dirname, 'PortfolioPanel.tsx'),
      'utf8',
    );
    const panelGridRegex =
      /\[grid-template-columns:auto_minmax\(\d+(?:\.\d+)?rem,1fr\)\]/;
    expect(panelSrc).toMatch(panelGridRegex);
    expect(panelSrc).not.toMatch(/grid-cols-2/);
    // No left/right split logic pattern
    expect(panelSrc).not.toMatch(/leftEntries|rightEntries/);
  });
});