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

  it('uses PortfolioUnifiedTable (not legacy PortfolioTokenRow)', () => {
    expect(panelSrc).toMatch(/PortfolioUnifiedTable/);
    expect(panelSrc).not.toMatch(/import PortfolioTokenRow/);
  });

  it('does not use legacy grid-template-columns pattern', () => {
    expect(panelSrc).not.toMatch(/\[grid-template-columns:auto_minmax/);
    expect(panelSrc).not.toMatch(/grid-cols-2/);
  });

  it('does not reference unifiedMode or ?unified=0', () => {
    expect(panelSrc).not.toMatch(/unifiedMode/);
    expect(panelSrc).not.toMatch(/unified.*0/);
  });
});
