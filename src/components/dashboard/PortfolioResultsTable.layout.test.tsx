// @vitest-environment happy-dom
/**
 * Layout uniformity regression guard for PortfolioResultsTable.
 *
 * Catches future spacing / border / padding drift that breaks row and
 * column visual alignment. If someone changes py-*, px-*, or border
 * classes on one cell but forgets the others, these assertions fail.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import PortfolioResultsTable from './PortfolioResultsTable';
import type { PortfolioReserveEntry, PortfolioPositionResult } from '@/types/portfolio';
import { PORTFOLIO_COL_COUNT } from './portfolioColumns';

vi.mock('@/components/primitives/TokenIcon', () => ({
  TokenIcon: ({ symbol, size }: { symbol: string; size?: number }) => (
    <span data-testid="token-icon" data-symbol={symbol} data-size={size} />
  ),
}));

vi.mock('@/lib/chainIcons', () => ({
  getChainIconSrc: () => null,
}));

const mockEntry: PortfolioReserveEntry = {
  reserveId: 'usdc-ethereum-aave-v3',
  marketName: 'AAVE V3',
  chainName: 'Ethereum',
  chainId: 1,
  tokenSymbol: 'USDC',
  supply: { amount: '10000', inputMode: 'usd', walletValue: null, source: 'manual' },
  borrow: { amount: '5000', inputMode: 'usd', walletValue: null, source: 'manual' },
  hidden: false,
  isOrphan: false,
  restrictedStatus: null,
};

const mockResults: PortfolioPositionResult[] = [
  {
    reserveId: 'usdc-ethereum-aave-v3',
    side: 'supply',
    amountUsd: 10_000,
    walletUsd: null,
    nativePercent: 0.03,
    incentivePercent: 0.02,
    totalPercent: 0.05,
    usdPerDay: 1.37,
    nativeMetric: { current: 0.03, after: 0.0315, delta: 0.0015 },
    incentiveMetric: { current: 0.02, after: 0.02, delta: 0 },
    totalMetric: { current: 0.05, after: 0.0515, delta: 0.0015 },
    usdPerDayMetric: { current: 1.37, after: 1.41, delta: 0.04 },
  },
  {
    reserveId: 'usdc-ethereum-aave-v3',
    side: 'borrow',
    amountUsd: 5_000,
    walletUsd: null,
    nativePercent: 0.04,
    incentivePercent: 0.01,
    totalPercent: 0.05,
    usdPerDay: -0.68,
    nativeMetric: { current: 0.04, after: 0.042, delta: 0.002 },
    incentiveMetric: { current: 0.01, after: 0.01, delta: 0 },
    totalMetric: { current: 0.05, after: 0.052, delta: 0.002 },
    usdPerDayMetric: { current: -0.68, after: -0.71, delta: -0.03 },
  },
];

function getRows(container: HTMLElement) {
  return Array.from(container.querySelectorAll('tbody tr'));
}

function getCells(row: Element) {
  return Array.from(row.querySelectorAll('td'));
}

/** Section-header rows (e.g. "Supply", "Borrow") have a single colspan td. */
function isDataRow(row: Element): boolean {
  return getCells(row).length === PORTFOLIO_COL_COUNT;
}

describe('PortfolioResultsTable layout uniformity', () => {
  it('every data cell uses the same vertical padding (py-1)', () => {
    const { container } = render(
      <PortfolioResultsTable entries={[mockEntry]} results={mockResults} />,
    );

    const rows = getRows(container);
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      if (!isDataRow(row)) continue;
      for (const cell of getCells(row)) {
        expect(Array.from(cell.classList)).toContain('py-1');
      }
    }
  });

  it('every data row has the same top border class', () => {
    const { container } = render(
      <PortfolioResultsTable entries={[mockEntry]} results={mockResults} />,
    );

    const rows = getRows(container);
    for (const row of rows) {
      if (!isDataRow(row)) continue;
      expect(row.classList.contains('border-t')).toBe(true);
    }
  });

  it('APY cluster cells (cols 2-7) share a uniform band tint; white-zone cells (0, 1, 8) do not', () => {
    const { container } = render(
      <PortfolioResultsTable entries={[mockEntry]} results={mockResults} />,
    );

    const rows = getRows(container);
    for (const row of rows) {
      if (!isDataRow(row)) continue;

      const cells = getCells(row);
      const bandClass = Array.from(cells[2].classList).find((c) =>
        c.startsWith('bg-emerald-') || c.startsWith('bg-cyan-'),
      );
      expect(bandClass).toBeTruthy();

      // APY cluster (Native, Native Δ, Incentive, Incentive Δ, Total, Total Δ)
      [2, 3, 4, 5, 6, 7].forEach((idx) => {
        expect(cells[idx].classList.contains(bandClass!)).toBe(true);
      });

      // White-zone columns (Token, Amount, USD/day) must NOT carry the band tint
      [0, 1, 8].forEach((idx) => {
        expect(cells[idx].classList.contains(bandClass!)).toBe(false);
      });
    }
  });

  it('value columns (Native, Incentive, Total) share px-2 horizontal padding', () => {
    const { container } = render(
      <PortfolioResultsTable entries={[mockEntry]} results={mockResults} />,
    );

    const rows = getRows(container);
    for (const row of rows) {
      if (!isDataRow(row)) continue;
      const cells = getCells(row);
      // Columns 2, 4, 6 are value columns.
      [2, 4, 6].forEach((idx) => {
        expect(Array.from(cells[idx].classList)).toContain('px-2');
      });
    }
  });

  it('delta columns (Native Δ, Incentive Δ, Total Δ) share px-1.5 horizontal padding', () => {
    const { container } = render(
      <PortfolioResultsTable entries={[mockEntry]} results={mockResults} />,
    );

    const rows = getRows(container);
    for (const row of rows) {
      if (!isDataRow(row)) continue;
      const cells = getCells(row);
      // Columns 3, 5, 7 are delta columns.
      [3, 5, 7].forEach((idx) => {
        expect(Array.from(cells[idx].classList)).toContain('px-1.5');
      });
    }
  });
});
