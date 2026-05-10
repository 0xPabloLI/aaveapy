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
    // Match the grid className that wraps the rendered PortfolioTokenRow list.
    const m = src.match(/'grid\s+([^']*)'/g) ?? [];
    const hasGapXAndY = m.some(
      (cls) => /gap-x-\d/.test(cls) && /gap-y-\d/.test(cls),
    );
    expect(
      hasGapXAndY,
      'Parent grid wrapping PortfolioTokenRow must include gap-x-* AND gap-y-* so subgrid rows inherit column spacing',
    ).toBe(true);
  });

  it('mobile uses a 2-column grid template (token info auto, input column expands)', () => {
    expect(src).toMatch(
      /\[grid-template-columns:auto_minmax\(\d+(?:\.\d+)?rem,1fr\)\]/,
    );
  });
});

describe('PortfolioTokenRow subgrid integration', () => {
  const src = readFileSync(
    resolve(__dirname, 'PortfolioTokenRow.tsx'),
    'utf8',
  );

  it('mobile row uses grid-cols-subgrid with col-span-2', () => {
    // The mobile branch must opt into subgrid so it inherits the parent
    // grid's gap-x value rather than defining its own column spacing.
    expect(src).toMatch(/grid-cols-subgrid[^"']*col-span-2|col-span-2[^"']*grid-cols-subgrid/);
  });

  it('desktop row uses flex layout (intentionally not subgrid)', () => {
    // Desktop intentionally drops subgrid so per-row spacing is controlled
    // locally (e.g. ml-2.5 + flex-1 between token info and inputs).
    // See PortfolioTokenRow.tsx desktop branch comment.
    expect(src).toMatch(/Desktop\s*[—-]\s*flex layout \(no subgrid\)/);
    // The desktop return must not opt into grid-cols-subgrid / col-span-3.
    const desktopReturn = src.slice(src.indexOf('Desktop'));
    expect(desktopReturn).not.toMatch(/grid-cols-subgrid/);
    expect(desktopReturn).not.toMatch(/col-span-3/);
  });
});
