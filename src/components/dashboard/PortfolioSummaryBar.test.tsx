// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PortfolioSummaryBar } from './PortfolioSummaryBar';
import type { PortfolioSummary, PortfolioHealthFactor } from '@/types/portfolio';

/**
 * AAV-1304 — Lowest HF badge empty state + Advanced section typography normalization.
 *
 * External behavior only: data-testid / data-hf-state / visible copy / class tokens.
 */

const summary: PortfolioSummary = {
  totalSupplyUsd: 10_000,
  totalBorrowUsd: 0,
  supplyUsdPerDay: 1.2,
  borrowUsdPerDay: 0,
  netUsdPerDay: 1.2,
  netEffectiveApy: 0.0438,
  supplyWeightedApy: 0.0438,
  borrowWeightedApy: 0,
};

function makeHf(over: Partial<PortfolioHealthFactor> = {}): PortfolioHealthFactor {
  return {
    poolKey: '1:AaveV3Ethereum',
    healthFactor: null,
    currentHealthFactor: null,
    deltaHealthFactor: null,
    totalCollateralUsd: 7_800,
    totalDebtUsd: 0,
    totalBorrowCapacityUsd: 0,
    ...over,
  };
}

afterEach(cleanup);

describe('PortfolioSummaryBar — Lowest HF badge empty state (AAV-1304)', () => {
  it('supply-only portfolio: renders "—" with a "no debt" hint (E1)', () => {
    const { container } = render(<PortfolioSummaryBar summary={summary} healthFactors={[makeHf()]} />);
    const badge = container.querySelector('[data-testid="portfolio-min-hf"]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('data-hf-state')).toBe('no-debt');
    expect(badge?.textContent).toBe('—');
    expect(screen.getByTestId('portfolio-hf-empty-hint').textContent).toBe('no debt');
  });

  it('portfolio with debt: renders the number with no hint (E2)', () => {
    const { container } = render(
      <PortfolioSummaryBar summary={summary} healthFactors={[makeHf({ healthFactor: 2.5, totalDebtUsd: 4_000 })]} />,
    );
    const badge = container.querySelector('[data-testid="portfolio-min-hf"]');
    expect(badge?.getAttribute('data-hf-state')).toBe('computed');
    expect(badge?.getAttribute('data-hf-color')).toBe('green');
    expect(badge?.className).toContain('text-emerald-600');
    expect(badge?.textContent).toBe('2.50');
    expect(screen.queryByTestId('portfolio-hf-empty-hint')).toBeNull();
  });

  it('no health factors at all: plain "—" without hint, Advanced toggle hidden (E3)', () => {
    const { container } = render(<PortfolioSummaryBar summary={summary} />);
    const badge = container.querySelector('[data-testid="portfolio-min-hf"]');
    expect(badge?.getAttribute('data-hf-state')).toBe('unknown');
    expect(badge?.textContent).toBe('—');
    expect(screen.queryByTestId('portfolio-hf-empty-hint')).toBeNull();
    expect(screen.queryByTestId('portfolio-advanced-toggle')).toBeNull();
  });

  it('debt exists but HF not computable (0): plain "—" without hint — must not claim "no debt" (E4)', () => {
    const { container } = render(
      <PortfolioSummaryBar summary={summary} healthFactors={[makeHf({ healthFactor: 0, totalDebtUsd: 4_000 })]} />,
    );
    const badge = container.querySelector('[data-testid="portfolio-min-hf"]');
    expect(badge?.getAttribute('data-hf-state')).toBe('unknown');
    expect(badge?.textContent).toBe('—');
    expect(screen.queryByTestId('portfolio-hf-empty-hint')).toBeNull();
  });

  it('supply-only portfolio keeps the Advanced toggle visible (E7)', () => {
    render(<PortfolioSummaryBar summary={summary} healthFactors={[makeHf({ totalBorrowCapacityUsd: 5_000 })]} />);
    expect(screen.getByTestId('portfolio-advanced-toggle')).not.toBeNull();
  });
});

describe('PortfolioSummaryBar — Advanced section typography (AAV-1304)', () => {
  function renderExpanded(hfs: PortfolioHealthFactor[]) {
    render(<PortfolioSummaryBar summary={summary} healthFactors={hfs} />);
    fireEvent.click(screen.getByTestId('portfolio-advanced-toggle'));
  }

  it('Net Effective APY label carries the shared section-header tokens (E6)', () => {
    renderExpanded([makeHf()]);
    const label = screen.getByText('Net Effective APY');
    for (const token of ['ds-text-10', 'font-semibold', 'uppercase', 'tracking-wider', 'text-muted-foreground']) {
      expect(label.className, `missing ${token}`).toContain(token);
    }
  });

  it('Health Factor and Borrow capacity labels use the same tokens as Net Effective APY (E6)', () => {
    renderExpanded([makeHf({ healthFactor: 2.5, totalDebtUsd: 4_000, totalBorrowCapacityUsd: 5_000 })]);
    for (const text of ['Health Factor (1 pools)'.replace(' (1 pools)', ''), 'Borrow capacity']) {
      const label = screen.getByText(text);
      for (const token of ['ds-text-10', 'font-semibold', 'uppercase', 'tracking-wider', 'text-muted-foreground']) {
        expect(label.className, `${text} missing ${token}`).toContain(token);
      }
    }
  });

  it('per-pool Health Factor value is font-bold (E6)', () => {
    renderExpanded([makeHf({ healthFactor: 2.5, totalDebtUsd: 4_000 })]);
    const row = screen.getByTestId('portfolio-hf-detail');
    expect(row.querySelector('.font-bold')).not.toBeNull();
  });

  it('Borrow capacity values use font-bold like the other summary values (E6)', () => {
    renderExpanded([makeHf({ totalBorrowCapacityUsd: 5_000 })]);
    const value = screen.getByText(/remaining/);
    expect(value.textContent).toContain('remaining');
    expect(value.className).toContain('font-bold');
    expect(value.className).not.toContain('font-medium');
  });

  it('non-numeric borrow status text stays font-medium — bold rule is for values only (review fix)', () => {
    renderExpanded([
      makeHf({ poolKey: '1:AaveV3Ethereum', totalDebtUsd: 4_000, totalBorrowCapacityUsd: 0 }),
      makeHf({ poolKey: '8453:AaveV3Base', healthFactor: 3, totalDebtUsd: 1_000, totalBorrowCapacityUsd: 5_000 }),
    ]);
    const status = screen.getByText('No borrowing capacity');
    expect(status.className).toContain('font-medium');
    expect(status.className).not.toContain('font-bold');
    const numeric = screen.getByText(/remaining/);
    expect(numeric.className).toContain('font-bold');
  });

  it('Net Effective APY value uses font-bold (E6)', () => {
    renderExpanded([makeHf()]);
    const value = screen.getByTestId('portfolio-ne-apy');
    expect(value.className).toContain('font-bold');
  });
});

describe('PortfolioSummaryBar — eMode fallback notice (AAV-1399)', () => {
  function renderExpanded(hfs: PortfolioHealthFactor[]) {
    render(<PortfolioSummaryBar summary={summary} healthFactors={hfs} />);
    fireEvent.click(screen.getByTestId('portfolio-advanced-toggle'));
  }

  it('B1: shows the base-LTV notice when a pool fell back from a known eMode category', () => {
    renderExpanded([makeHf({ totalBorrowCapacityUsd: 93_000, totalDebtUsd: 50_000, eModeFallback: true })]);
    const notice = screen.getByTestId('emode-fallback-notice');
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.textContent).toContain('eMode data refreshing');
    expect(notice.textContent).toContain('base LTV');
    expect(notice.className).toContain('text-muted-foreground');
  });

  it('B2: no notice when all pools resolved their eMode category', () => {
    renderExpanded([makeHf({ totalBorrowCapacityUsd: 93_000, totalDebtUsd: 50_000 })]);
    expect(screen.queryByTestId('emode-fallback-notice')).toBeNull();
  });
});
