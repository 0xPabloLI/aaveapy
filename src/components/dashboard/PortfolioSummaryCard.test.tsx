import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import PortfolioSummaryCard, { type PortfolioSummary } from './PortfolioSummaryCard';

const summary: PortfolioSummary = {
  totalSupplyUsd: 50_000,
  totalBorrowUsd: 20_000,
  netApy: 3.45,
  dailyEarningsUsd: 4.72,
};

describe('PortfolioSummaryCard', () => {
  it('renders the simulation disclaimer when summary is present', () => {
    const html = renderToString(<PortfolioSummaryCard summary={summary} />);
    // Desktop copy is the default for SSR (useIsMobile returns false)
    expect(html).toContain(
      'Simulation is for reference only. Final result depends on on-chain execution.',
    );
  });

  it('renders all four metric cells', () => {
    const html = renderToString(<PortfolioSummaryCard summary={summary} />);
    expect(html).toContain('Total Supply');
    expect(html).toContain('Total Borrow');
    expect(html).toContain('Net APY');
    expect(html).toContain('Daily Earnings');
  });

  it('returns null when summary is null', () => {
    const html = renderToString(<PortfolioSummaryCard summary={null} />);
    expect(html).toBe('');
  });
});
