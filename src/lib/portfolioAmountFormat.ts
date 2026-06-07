/**
 * Canonical amount formatter for portfolio positions.
 *
 * Every entry point that produces a `PortfolioPosition.amount` string MUST
 * funnel through `formatPortfolioAmount` so the displayed precision is
 * uniform (≤ 8 significant digits, trailing zeros stripped). Bypassing this
 * helper — e.g. `String(walletPosition.amountUsd)` — leaks raw float noise
 * like `1737.4839284729384` into the UI.
 *
 * Callers (keep in sync — see `portfolioAmountFormat.test.ts`):
 *  - Wallet import:        src/lib/walletPositionToPortfolio.ts
 *  - Merger / re-sync:     src/lib/portfolioMerger.ts
 *  - Reset / restore:      src/hooks/usePortfolioSimulation.ts
 *  - USD/Token toggle:     src/hooks/usePortfolioSimulation.ts
 */

export const MAX_PORTFOLIO_AMOUNT_SIG_DIGITS = 8;

export function formatPortfolioAmount(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  const digits = Math.max(
    0,
    MAX_PORTFOLIO_AMOUNT_SIG_DIGITS - Math.ceil(Math.log10(abs + 1)),
  );
  const fixed = value.toFixed(digits);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

/**
 * Count significant digits in a number-shaped string. Used by regression
 * tests; exported so callers can assert their own outputs.
 */
export function countSignificantDigits(raw: string): number {
  const cleaned = raw.replace(/,/g, '').replace(/^[-+]/, '');
  if (!/^\d*(\.\d*)?$/.test(cleaned) || cleaned === '' || cleaned === '.') return 0;
  const [intPart = '', fracPart = ''] = cleaned.split('.');
  const digits = (intPart + fracPart).replace(/^0+/, '');
  const trimmed = fracPart ? digits.replace(/0+$/, '') : digits;
  return trimmed.length;
}
