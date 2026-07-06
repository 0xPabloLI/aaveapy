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

// Shared widths for the three APY clusters (Native / Incentive / Total).
// Each cluster shares one value-column width + one delta-column width,
// so the three groups render as visually identical column pairs.
export const PF_TOKEN_W = undefined;   // Token — flex, absorbs remaining table width
export const PF_AMOUNT_W = '80px';
export const PF_VALUE_W = '82px';   // Native / Incentive / Total value column
export const PF_DELTA_W = '54px';   // Δ column shared across all three clusters
export const PF_USD_DAY_W = '88px'; // USD/day — fixed, right-aligned like Amount

export const PORTFOLIO_COL_WIDTHS = [
  PF_TOKEN_W,    // 0 Token (flex)
  PF_AMOUNT_W,   // 1 Amount
  PF_VALUE_W,    // 2 Native
  PF_DELTA_W,    // 3 Native Δ
  PF_VALUE_W,    // 4 Incentive
  PF_DELTA_W,    // 5 Incentive Δ
  PF_VALUE_W,    // 6 Total
  PF_DELTA_W,    // 7 Total Δ
  PF_USD_DAY_W,  // 8 USD/day
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
