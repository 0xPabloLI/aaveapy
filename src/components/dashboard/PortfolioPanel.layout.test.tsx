import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guard against regressions in the PortfolioPanel grid layout.
 *
 * Desktop: two side-by-side half-grids, each with auto + minmax columns.
 *          Token info column uses `auto` so it matches the widest token
 *          in that half-grid (natural column-level alignment).
 * Mobile:  single grid with auto + minmax columns.
 */

describe('PortfolioPanel batch grid layout', () => {
  const src = readFileSync(
    resolve(__dirname, 'PortfolioPanel.tsx'),
    'utf8',
  );

  it('parent grid for token rows declares both gap-x and gap-y', () => {
    const doubleQuoted = src.match(/"grid\s+([^"]*)"/g) ?? [];
    const singleQuoted = src.match(/'grid\s+([^']*)'/g) ?? [];
    const allMatches = [...doubleQuoted, ...singleQuoted];
    const hasGapXAndY = allMatches.some(
      (cls) => /gap-x-\d/.test(cls) && /gap-y-\d/.test(cls),
    );
    expect(
      hasGapXAndY,
      'Parent grid must include gap-x-* AND gap-y-* for spacing between rows',
    ).toBe(true);
  });

  it('half-grids use auto + minmax columns for natural token info alignment', () => {
    const matches = src.match(/\[grid-template-columns:auto_minmax\(\d+(?:\.\d+)?rem,1fr\)\]/g) ?? [];
    expect(
      matches.length,
      'Desktop half-grids must use auto minmax(_,1fr) so token info column auto-sizes to widest token',
    ).toBeGreaterThanOrEqual(1);
  });
});