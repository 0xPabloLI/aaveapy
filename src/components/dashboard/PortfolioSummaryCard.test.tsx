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
});

describe('PortfolioSummaryCard', () => {
  afterEach(() => cleanup());

  it('renders the four metric cells', () => {
    render(<PortfolioSummaryCard summary={makeSummary()} />);
    expect(screen.getByText('Total Supply')).toBeInTheDocument();
    expect(screen.getByText('Total Borrow')).toBeInTheDocument();
    expect(screen.getByText('Net Daily Earn')).toBeInTheDocument();
    expect(screen.getByText('Net Effective APY')).toBeInTheDocument();
  });

  it('renders simulation disclaimer below the metric grid', () => {
    render(<PortfolioSummaryCard summary={makeSummary()} />);
    const disclaimer = screen.getByText(
      /Simulation is for reference only\. Final result depends on on-chain execution\./,
    );
    expect(disclaimer).toBeInTheDocument();
    expect(disclaimer.tagName).toBe('P');
  });

  it('disclaimer has correct styling classes', () => {
    render(<PortfolioSummaryCard summary={makeSummary()} />);
    const disclaimer = screen.getByText(
      /Simulation is for reference only\./,
    );
    expect(disclaimer).toHaveClass('ds-text-10');
    expect(disclaimer).toHaveClass('italic');
    expect(disclaimer.className).toMatch(/text-muted-foreground\/70/);
  });
});
