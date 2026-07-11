import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guard against regressions in the PortfolioPanel layout.
 *
 * Legacy grid layout (PortfolioTokenRow) has been removed.
 * Unified table (PortfolioUnifiedTable) is the only layout.
 */

describe('PortfolioPanel portfolio layout', () => {
  const src = readFileSync(
    resolve(__dirname, 'PortfolioPanel.tsx'),
    'utf8',
  );

  it('renders PortfolioUnifiedTable (not legacy PortfolioTokenRow)', () => {
    expect(src).toMatch(/PortfolioUnifiedTable/);
    expect(src).not.toMatch(/import PortfolioTokenRow/);
  });

  it('does not reference unifiedMode flag', () => {
    expect(src).not.toMatch(/unifiedMode/);
  });
});
