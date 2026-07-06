// @vitest-environment happy-dom
/**
 * Layout alignment regression guard.
 *
 * PortfolioSummaryCard and PortfolioResultsTable must render the SAME colgroup
 * so their columns line up vertically. If someone tweaks widths / padding in
 * one file without the other, or breaks the shared cluster width contract,
 * these tests fail loudly.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  PORTFOLIO_COL_WIDTHS,
  PORTFOLIO_COL_COUNT,
  PortfolioColgroup,
  PF_VALUE_W,
  PF_DELTA_W,
} from './portfolioColumns';

describe('portfolio column geometry (layout alignment guard)', () => {
  it('has exactly 9 columns', () => {
    expect(PORTFOLIO_COL_COUNT).toBe(9);
    expect(PORTFOLIO_COL_WIDTHS).toHaveLength(9);
  });

  it('Native / Incentive / Total value columns share PF_VALUE_W', () => {
    // Columns 2, 4, 6 are the three cluster value columns.
    expect(PORTFOLIO_COL_WIDTHS[2]).toBe(PF_VALUE_W);
    expect(PORTFOLIO_COL_WIDTHS[4]).toBe(PF_VALUE_W);
    expect(PORTFOLIO_COL_WIDTHS[6]).toBe(PF_VALUE_W);
  });

  it('all three Δ columns share PF_DELTA_W', () => {
    // Columns 3, 5, 7 are the three Δ columns.
    expect(PORTFOLIO_COL_WIDTHS[3]).toBe(PF_DELTA_W);
    expect(PORTFOLIO_COL_WIDTHS[5]).toBe(PF_DELTA_W);
    expect(PORTFOLIO_COL_WIDTHS[7]).toBe(PF_DELTA_W);
  });

  it('last column (USD/day) is flex (no fixed width)', () => {
    expect(PORTFOLIO_COL_WIDTHS[8]).toBeUndefined();
  });

  it('PortfolioColgroup renders one <col> per configured width', () => {
    const { container } = render(
      <table>
        <PortfolioColgroup />
      </table>,
    );
    const cols = container.querySelectorAll('colgroup > col');
    expect(cols).toHaveLength(PORTFOLIO_COL_COUNT);

    PORTFOLIO_COL_WIDTHS.forEach((w, i) => {
      const col = cols[i] as HTMLTableColElement;
      if (w) {
        expect(col.style.width).toBe(w);
      } else {
        expect(col.style.width).toBe('');
      }
    });
  });
});
