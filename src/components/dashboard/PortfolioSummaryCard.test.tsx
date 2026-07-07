// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import PortfolioSummaryCard from './PortfolioSummaryCard';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

const makeSummary = () => ({
  totalSupplyUsd: 10000,
  totalBorrowUsd: 5000,
  netUsdPerDay: 1.5,
  netEffectiveApy: 3.2,
  supplyWeightedApy: 4.5,
  borrowWeightedApy: 6.1,
});

describe('PortfolioSummaryCard', () => {
  afterEach(() => cleanup());

  it('renders the four metric cells', () => {
    render(<PortfolioSummaryCard summary={makeSummary()} />);
    expect(screen.getByText('Total Supply / Borrow')).toBeInTheDocument();
    expect(screen.getByText('Net Daily Earn')).toBeInTheDocument();
    expect(screen.getByText('Weighted APY')).toBeInTheDocument();
  });

  it('no longer renders simulation disclaimer (moved to PortfolioPanel header)', () => {
    render(<PortfolioSummaryCard summary={makeSummary()} />);
    expect(screen.queryByText(
      /Simulation is for reference only\. Final result depends on on-chain execution\./,
    )).not.toBeInTheDocument();
  });
});
