import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guard against regressions in the PortfolioPanel grid layout.
 *
 * Single-column unified grid for both desktop and mobile.
 * Uses `auto minmax(11rem,1fr)` — the auto column matches the
 * widest token in the list, so all inputs are aligned.
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
    expect(hasGapXAndY).toBe(true);
  });

  it('unified grid uses auto + minmax columns', () => {
    expect(src).toMatch(/\[grid-template-columns:auto_minmax\(\d+(?:\.\d+)?rem,1fr\)\]/);
  });
});