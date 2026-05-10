import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guard against regressions where the parent grid that wraps
 * PortfolioTokenRow loses its horizontal gap. Subgrid rows inherit
 * column gaps from the ancestor grid, so dropping `gap-x-*` collapses
 * the spacing between token info and the supply input on mobile.
 *
 * See: PortfolioPanel.tsx — the grid that maps groupedByReserve.
 */
describe('PortfolioPanel batch grid layout', () => {
  const src = readFileSync(
    resolve(__dirname, 'PortfolioPanel.tsx'),
    'utf8',
  );

  it('parent grid for token rows declares both gap-x and gap-y', () => {
    const m = src.match(/"grid\s+([^"]*)"/g) ?? [];
    const hasGapXAndY = m.some(
      (cls) => /gap-x-\d/.test(cls) && /gap-y-\d/.test(cls),
    );
    expect(
      hasGapXAndY,
      'Parent grid wrapping PortfolioTokenRow must include gap-x-* AND gap-y-* so subgrid rows inherit column spacing',
    ).toBe(true);
  });

  it('batch grid uses 2-column 50/50 template (unified desktop + mobile)', () => {
    expect(src).toMatch(
      /\[grid-template-columns:1fr_1fr\]/,
    );
  });
});

describe('PortfolioTokenRow subgrid integration', () => {
  const src = readFileSync(
    resolve(__dirname, 'PortfolioTokenRow.tsx'),
    'utf8',
  );

  it('mobile row uses grid-cols-subgrid with col-span-2', () => {
    expect(src).toMatch(/grid-cols-subgrid[^"']*col-span-2|col-span-2[^"']*grid-cols-subgrid/);
  });

  it('desktop row also uses grid-cols-subgrid with col-span-2 (unified with mobile)', () => {
    const desktopReturn = src.slice(src.indexOf('Desktop'));
    expect(desktopReturn).toMatch(/grid-cols-subgrid/);
    expect(desktopReturn).toMatch(/col-span-2/);
  });
});
