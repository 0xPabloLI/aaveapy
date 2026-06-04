// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import PortfolioTokenRow from './PortfolioTokenRow';
import type { PortfolioPosition } from '@/types/portfolio';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

const { useIsMobile } = await vi.importMock<typeof import('@/hooks/use-mobile')>(
  '@/hooks/use-mobile',
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}

function makeSupply(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    positionId: 'pos-1',
    reserveId: 'reserve-1',
    side: 'supply',
    amount: '5000',
    inputMode: 'usd',
    ...overrides,
  };
}

function makeBorrow(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    positionId: 'pos-2',
    reserveId: 'reserve-1',
    side: 'borrow',
    amount: '2000',
    inputMode: 'usd',
    ...overrides,
  };
}

const noop = () => {};

function renderRow(opts?: { isMobile?: boolean; borrow?: boolean }) {
  vi.mocked(useIsMobile).mockReturnValue(opts?.isMobile ?? false);
  return render(
    <PortfolioTokenRow
      reserveId="reserve-1"
      tokenSymbol="USDC"
      chainName="Ethereum"
      marketName="AaveV3Ethereum"
      supplyPosition={makeSupply()}
      borrowPosition={opts?.borrow ? makeBorrow() : null}
      onRemove={noop}
      onUpdateAmount={noop}
      onUpdateInputMode={noop}
    />,
    { wrapper: Wrapper },
  );
}

describe('PortfolioTokenRow render', () => {
  beforeEach(() => {
    cleanup();
  });

  // ─── render ─────────────────────────────────────────────────

  it('renders token symbol', () => {
    renderRow();
    expect(screen.getByText('USDC')).toBeTruthy();
  });

  it('renders minus button', () => {
    renderRow();
    expect(
      screen.getByRole('button', { name: /remove.*USDC/i }),
    ).toBeTruthy();
  });

  it('renders Supply input', () => {
    renderRow();
    expect(
      screen.getByRole('textbox', { name: /supply.*USDC/i }),
    ).toBeTruthy();
  });

  it('renders Borrow input when borrow position exists', () => {
    renderRow({ borrow: true });
    expect(
      screen.getByRole('textbox', { name: /borrow.*USDC/i }),
    ).toBeTruthy();
  });

  it('does not render Borrow input without borrow position', () => {
    renderRow({ borrow: false });
    expect(
      screen.queryByRole('textbox', { name: /borrow/i }),
    ).toBeNull();
  });

  // ─── subgrid ────────────────────────────────────────────────

  it('row has grid-cols-subgrid class', () => {
    renderRow();
    const row = screen.getByRole('button', { name: /remove/i })
      .closest('div');
    const subgridEl = row?.parentElement;
    expect(subgridEl?.classList.contains('grid-cols-subgrid')).toBe(true);
  });

  // ─── minus inline ───────────────────────────────────────────

  it('minus button is not absolute-positioned (inline on the left)', () => {
    renderRow();
    const btn = screen.getByRole('button', { name: /remove.*USDC/i });
    const parentClasses = Array.from(btn.parentElement?.classList ?? []);
    const rowWrapper = btn.closest('[class*="rounded-lg"]');
    const wrapperClasses = Array.from(rowWrapper?.classList ?? []);
    const allClasses = [...parentClasses, ...wrapperClasses];
    expect(allClasses.filter((c) => c.includes('absolute')).length).toBe(0);
  });

  // ─── minus inline ───────────────────────────────────────────

  it('minus button is not absolute-positioned (inline on the left)', () => {
    renderRow();
    const btn = screen.getByRole('button', { name: /remove.*USDC/i });
    const parentDiv = btn.closest('div');
    expect(parentDiv).toBeTruthy();
    expect(parentDiv!.className.includes('absolute')).toBe(false);
  });
});