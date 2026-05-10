import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guard against regressions in the PortfolioPanel grid layout.
 *
 * Desktop: grid-cols-2 (two columns of token rows, each 50%).
 * Mobile:  grid-cols-1 (single column).
 *
 * Rows now use flex internally (see visual-gap test), so the parent
 * grid gap-x controls spacing BETWEEN rows (not within a row).
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

  it('desktop uses grid-cols-2, mobile uses grid-cols-1', () => {
    expect(src).toMatch(/grid-cols-1/);
    expect(src).toMatch(/grid-cols-2/);
  });
});