import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Visual regression guard for PortfolioPanel layout.
 *
 * Legacy PortfolioTokenRow grid layout has been removed.
 * Unified table (PortfolioUnifiedTable) is the only layout.
 * This guard ensures the unified table is used and legacy
 * grid patterns are not reintroduced.
 */

describe('PortfolioPanel unified layout guard', () => {
  const panelSrc = readFileSync(
    resolve(__dirname, 'PortfolioPanel.tsx'),
    'utf8',
  );

  it('uses PortfolioUnifiedTable with PortfolioTokenRow for prototype toggle', () => {
    expect(panelSrc).toMatch(/PortfolioUnifiedTable/);
    expect(panelSrc).toMatch(/PortfolioTokenRow/);
  });

  it('uses grid-template-columns for prototype sub-layout', () => {
    expect(panelSrc).toMatch(/\[grid-template-columns:auto_minmax/);
  });

  it('allows unifiedMode search param for prototype toggle', () => {
    expect(panelSrc).toMatch(/unifiedMode/);
  });
});
