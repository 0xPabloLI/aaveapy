/**
 * Shared column geometry for Portfolio summary + results tables.
 *
 * Both PortfolioSummaryCard and PortfolioResultsTable render as `<table>` with
 * `table-layout: fixed` and this identical colgroup, so every cell in one
 * lines up vertically with the corresponding column in the other.
 *
 * Columns (9 total):
 *   0 Token        104px
 *   1 Amount        84px
 *   2 Native        82px
 *   3 Native Δ      54px
 *   4 Incentive     82px
 *   5 Incentive Δ   54px
 *   6 Total         82px
 *   7 Total Δ       54px
 *   8 USD/day       (flex — fills remainder)
 */

export const PORTFOLIO_COL_WIDTHS = [
  '88px',   // Token
  '80px',   // Amount
  '82px',
  '54px',
  '82px',
  '54px',
  '82px',
  '54px',
  undefined, // flex
] as const;

export const PORTFOLIO_COL_COUNT = PORTFOLIO_COL_WIDTHS.length;

export function PortfolioColgroup() {
  return (
    <colgroup>
      {PORTFOLIO_COL_WIDTHS.map((w, i) => (
        <col key={i} style={w ? { width: w } : undefined} />
      ))}
    </colgroup>
  );
}

// Shared padding tokens — used by both summary and results table so
// cell edges align pixel-for-pixel across the two tables.
export const PF_VALUE_CELL = 'px-2 py-1.5 text-right tabular-nums whitespace-nowrap';
export const PF_DELTA_CELL = 'px-1.5 py-1.5 text-right tabular-nums ds-text-10 whitespace-nowrap';
