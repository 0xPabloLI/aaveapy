// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import PortfolioTokenRow from './PortfolioTokenRow';
import type { PortfolioReserveEntry, PortfolioSideData } from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';

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

const EMPTY_SIDE: PortfolioSideData = { amount: '', inputMode: 'usd', walletValue: null };

const noop = () => {};

const makeActions = (): PortfolioSimulationActions => ({
  setActive: vi.fn(),
  addReserve: vi.fn(),
  removeReserve: vi.fn(),
  updateReserve: vi.fn(),
  hideReserve: vi.fn(),
  unhideReserve: vi.fn(),
  importReserves: vi.fn(),
  restoreToWallet: vi.fn(),
  clearAll: vi.fn(),
  saveSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
  undoLastRemove: vi.fn(),
});

function makeEntry(overrides: Partial<PortfolioReserveEntry> = {}): PortfolioReserveEntry {
  return {
    reserveId: 'reserve-1',
    marketName: 'AaveV3Ethereum',
    chainName: 'Ethereum',
    tokenSymbol: 'USDC',
    supply: { amount: '5000', inputMode: 'usd', walletValue: null },
    borrow: { ...EMPTY_SIDE },
    hidden: false,
    isOrphan: false,
    ...overrides,
  };
}

function renderRow(opts?: { isMobile?: boolean; supplyOverrides?: Partial<PortfolioSideData>; borrowOverrides?: Partial<PortfolioSideData>; tokenPriceInUsd?: number; hidden?: boolean }) {
  vi.mocked(useIsMobile).mockReturnValue(opts?.isMobile ?? false);
  const entry = makeEntry({
    supply: opts?.supplyOverrides ? { ...EMPTY_SIDE, ...opts.supplyOverrides } : { amount: '5000', inputMode: 'usd', walletValue: null },
    borrow: opts?.borrowOverrides ? { ...EMPTY_SIDE, ...opts.borrowOverrides } : { ...EMPTY_SIDE },
    hidden: opts?.hidden ?? false,
  });
  return render(
    <PortfolioTokenRow
      entry={entry}
      actions={makeActions()}
      reserveId="reserve-1"
      onRemove={noop}
      tokenPriceInUsd={opts?.tokenPriceInUsd}
    />,
    { wrapper: Wrapper },
  );
}

describe('PortfolioTokenRow render', () => {
  beforeEach(() => {
    cleanup();
  });

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

  it('renders Borrow input when entry has borrow data', () => {
    renderRow({ borrowOverrides: { amount: '2000' } });
    expect(
      screen.getByRole('textbox', { name: /borrow.*USDC/i }),
    ).toBeTruthy();
  });

  it('always renders Borrow input (entry always has both sides)', () => {
    renderRow();
    expect(
      screen.queryByRole('textbox', { name: /borrow/i }),
    ).toBeTruthy();
  });

  it('row has grid-cols-subgrid class', () => {
    renderRow();
    const row = screen.getByRole('button', { name: /remove/i })
      .closest('div');
    const subgridEl = row?.parentElement;
    expect(subgridEl?.classList.contains('grid-cols-subgrid')).toBe(true);
  });

  it('minus button is not absolute-positioned (inline on the left)', () => {
    renderRow();
    const btn = screen.getByRole('button', { name: /remove.*USDC/i });
    const parentClasses = Array.from(btn.parentElement?.classList ?? []);
    const rowWrapper = btn.closest('[class*="rounded-lg"]');
    const wrapperClasses = Array.from(rowWrapper?.classList ?? []);
    const allClasses = [...parentClasses, ...wrapperClasses];
    expect(allClasses.filter((c) => c.includes('absolute')).length).toBe(0);
  });

  it('shows effective amount with muted color when synced (delta ≈ 0)', () => {
    renderRow({
      supplyOverrides: { amount: '5000', walletValue: 5000, inputMode: 'usd' },
    });
    const el = screen.getByLabelText(/effective amount/i);
    expect(el).toBeTruthy();
    expect(el.textContent).toBe('5,000');
    expect(el.className).toContain('text-muted-foreground');
  });

  it('shows effective amount with foreground color when modified (delta ≠ 0)', () => {
    renderRow({
      supplyOverrides: { amount: '7500', walletValue: 5000, inputMode: 'usd' },
    });
    const el = screen.getByLabelText(/effective amount/i);
    expect(el).toBeTruthy();
    expect(el.textContent).toBe('7,500');
    expect(el.className).toContain('text-foreground');
  });

  it('shows token amount in token input mode', () => {
    renderRow({
      supplyOverrides: { amount: '100', walletValue: 50, inputMode: 'token' },
      tokenPriceInUsd: 50,
    });
    const el = screen.getByLabelText(/effective amount/i);
    expect(el.textContent).toBe('100');
  });

  it('uses muted color when token price is unavailable in token mode', () => {
    renderRow({
      supplyOverrides: { amount: '100', walletValue: 50, inputMode: 'token' },
      tokenPriceInUsd: undefined,
    });
    const el = screen.getByLabelText(/effective amount/i);
    expect(el.className).toContain('text-muted-foreground');
  });

  it('aria-label includes wallet value for screen readers', () => {
    renderRow({
      supplyOverrides: { amount: '7500', walletValue: 5000, inputMode: 'usd' },
    });
    const el = screen.getByLabelText(/effective amount.*wallet.*5,000/i);
    expect(el).toBeTruthy();
  });

  it('does not show effective amount for manual positions (no wallet)', () => {
    renderRow({
      supplyOverrides: { amount: '5000', walletValue: null },
    });
    expect(screen.queryByLabelText(/effective amount/i)).toBeNull();
  });

  it('minus button is not absolute-positioned (inline on the left)', () => {
    renderRow();
    const btn = screen.getByRole('button', { name: /remove.*USDC/i });
    const parentDiv = btn.closest('div');
    expect(parentDiv).toBeTruthy();
    expect(parentDiv!.className.includes('absolute')).toBe(false);
  });

  describe('hidden state', () => {
    function renderHiddenRow() {
      return renderRow({
        hidden: true,
        supplyOverrides: { walletValue: 5000 },
      });
    }

    it('shows Restore button instead of Remove when hidden', () => {
      renderHiddenRow();
      expect(
        screen.getByRole('button', { name: /restore.*USDC/i }),
      ).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: /remove.*USDC/i }),
      ).toBeNull();
    });

    it('renders no small EyeOff icon in hiddenSuffix (only the Restore button EyeOff)', () => {
      renderHiddenRow();
      const restoreBtn = screen.getByRole('button', { name: /restore/i });
      const svgInBtn = restoreBtn.querySelector('svg');
      expect(svgInBtn).toBeTruthy();
      expect(svgInBtn!.classList.contains('size-3.5')).toBe(true);
      const smallSvgs = Array.from(document.querySelectorAll('svg.size-3'));
      const isEyeOffPath = (svg: SVGSVGElement) => {
        const paths = svg.querySelectorAll('path');
        return Array.from(paths).some((p) => p.getAttribute('d')?.includes('17'));
      };
      const eyeOffSmall = smallSvgs.filter(isEyeOffPath);
      expect(eyeOffSmall.length).toBe(0);
    });
  });
});
