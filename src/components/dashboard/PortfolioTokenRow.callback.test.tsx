// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import PortfolioTokenRow from './PortfolioTokenRow';
import type { PortfolioReserveEntry } from '@/types/portfolio';
import type { PortfolioSimulationActions } from '@/hooks/usePortfolioSimulation';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

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

function makeEntry(overrides: Partial<PortfolioReserveEntry> = {}): PortfolioReserveEntry {
  return {
    reserveId: 'reserve-1',
    marketName: 'AaveV3Ethereum',
    chainName: 'Ethereum',
    tokenSymbol: 'USDC',
    supply: { amount: '5000', inputMode: 'usd', walletValue: null, deltaSign: 1 },
    borrow: { amount: '', inputMode: 'usd', walletValue: null },
    hidden: false,
    isOrphan: false,
    ...overrides,
  };
}

function makeActions(): PortfolioSimulationActions {
  return {
    setActive: vi.fn(),
    addReserve: vi.fn(),
    removeReserve: vi.fn(),
    updateReserve: vi.fn(),
    hideReserve: vi.fn(),
    unhideReserve: vi.fn(),
    importReserves: vi.fn(),
    restoreToWallet: vi.fn(),
    removeHiddenEntries: vi.fn(() => 0),
    clearAll: vi.fn(),
    saveSnapshot: vi.fn(),
    deleteSnapshot: vi.fn(),
    undoLastRemove: vi.fn(),
  };
}

describe('PortfolioTokenRow callbacks', () => {
  beforeEach(() => cleanup());

  it('calls onRemove with reserveId when minus button is clicked for manual entry', () => {
    const onRemove = vi.fn();
    const actions = makeActions();
    render(
      <PortfolioTokenRow
        entry={makeEntry({ supply: { amount: '5000', inputMode: 'usd', walletValue: null }, borrow: { amount: '', inputMode: 'usd', walletValue: null } })}
        actions={actions}
        reserveId="reserve-1"
        onRemove={onRemove}
      />,
      { wrapper: Wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /remove.*USDC/i }));
    expect(onRemove).toHaveBeenCalledWith('reserve-1');
  });

  it('calls actions.hideReserve when minus button is clicked for wallet-synced entry', () => {
    const onRemove = vi.fn();
    const actions = makeActions();
    render(
      <PortfolioTokenRow
        entry={makeEntry({ supply: { amount: '5000', inputMode: 'usd', walletValue: 3000 }, borrow: { amount: '', inputMode: 'usd', walletValue: null } })}
        actions={actions}
        reserveId="reserve-1"
        onRemove={onRemove}
      />,
      { wrapper: Wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /remove.*USDC/i }));
    expect(actions.hideReserve).toHaveBeenCalledWith('reserve-1');
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('calls actions.updateReserve on supply input blur (committed via useNumberInput)', () => {
    const actions = makeActions();
    render(
      <PortfolioTokenRow
        entry={makeEntry()}
        actions={actions}
        reserveId="reserve-1"
        onRemove={vi.fn()}
      />,
      { wrapper: Wrapper },
    );
    const input = screen.getByRole('textbox', { name: /supply.*USDC/i });
    fireEvent.change(input, { target: { value: '10000' } });
    fireEvent.blur(input);
    expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyAmount: '10,000' });
  });

  it('calls actions.updateReserve on borrow input blur', () => {
    const actions = makeActions();
    render(
      <PortfolioTokenRow
        entry={makeEntry({ borrow: { amount: '2000', inputMode: 'usd', walletValue: null } })}
        actions={actions}
        reserveId="reserve-1"
        onRemove={vi.fn()}
      />,
      { wrapper: Wrapper },
    );
    const input = screen.getByRole('textbox', { name: /borrow.*USDC/i });
    fireEvent.change(input, { target: { value: '3000' } });
    fireEvent.blur(input);
    expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { borrowAmount: '3,000' });
  });

  it('calls actions.updateReserve when switching supply input mode from USD to token', () => {
    const actions = makeActions();
    render(
      <PortfolioTokenRow
        entry={makeEntry({ supply: { amount: '5000', inputMode: 'usd', walletValue: null } })}
        actions={actions}
        reserveId="reserve-1"
        onRemove={vi.fn()}
        tokenPriceInUsd={1}
      />,
      { wrapper: Wrapper },
    );
    const [supplyModeBtn] = screen.getAllByRole('button', { name: /switch to token input/i });
    fireEvent.click(supplyModeBtn);
    expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyInputMode: 'token' }, 1);
  });

  it('calls actions.updateReserve when switching supply input mode from token to USD', () => {
    const actions = makeActions();
    render(
      <PortfolioTokenRow
        entry={makeEntry({ supply: { amount: '5000', inputMode: 'token', walletValue: null } })}
        actions={actions}
        reserveId="reserve-1"
        onRemove={vi.fn()}
        tokenPriceInUsd={1}
      />,
      { wrapper: Wrapper },
    );
    const [supplyModeBtn] = screen.getAllByRole('button', { name: /switch to usd input/i });
    fireEvent.click(supplyModeBtn);
    expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyInputMode: 'usd' }, 1);
  });

  it('clears supply amount when clear button is clicked', () => {
    const actions = makeActions();
    render(
      <PortfolioTokenRow
        entry={makeEntry({ supply: { amount: '5000', inputMode: 'usd', walletValue: null } })}
        actions={actions}
        reserveId="reserve-1"
        onRemove={vi.fn()}
      />,
      { wrapper: Wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /clear.*USDC.*supply/i }));
    expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyAmount: '' });
  });

  describe('delta mode (walletValue present)', () => {
    it('shows delta input with aria-label containing "delta"', () => {
      render(
        <PortfolioTokenRow
          entry={makeEntry({ supply: { amount: '5000', inputMode: 'usd', walletValue: 3000, deltaSign: 1 } })}
          actions={makeActions()}
          reserveId="reserve-1"
          onRemove={vi.fn()}
        />,
        { wrapper: Wrapper },
      );
      expect(screen.getByRole('textbox', { name: /supply.*delta.*USDC/i })).toBeInTheDocument();
    });

    it('calls actions.updateReserve with effective amount on blur in positive delta mode', () => {
      const actions = makeActions();
      render(
        <PortfolioTokenRow
          entry={makeEntry({ supply: { amount: '5000', inputMode: 'usd', walletValue: 3000, deltaSign: 1 } })}
          actions={actions}
          reserveId="reserve-1"
          onRemove={vi.fn()}
        />,
        { wrapper: Wrapper },
      );
      const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
      fireEvent.change(input, { target: { value: '4000' } });
      fireEvent.blur(input);
      expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyAmount: '7,000' });
    });

    it('calls actions.updateReserve with effective amount on blur in negative delta mode', () => {
      const actions = makeActions();
      render(
        <PortfolioTokenRow
          entry={makeEntry({ supply: { amount: '2000', inputMode: 'usd', walletValue: 5000, deltaSign: -1 } })}
          actions={actions}
          reserveId="reserve-1"
          onRemove={vi.fn()}
        />,
        { wrapper: Wrapper },
      );
      const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
      fireEvent.change(input, { target: { value: '2000' } });
      fireEvent.blur(input);
      expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyAmount: '3,000' });
    });

    it('clears delta by restoring to walletValue', () => {
      const actions = makeActions();
      render(
        <PortfolioTokenRow
          entry={makeEntry({ supply: { amount: '7000', inputMode: 'usd', walletValue: 3000, deltaSign: 1 } })}
          actions={actions}
          reserveId="reserve-1"
          onRemove={vi.fn()}
        />,
        { wrapper: Wrapper },
      );
      fireEvent.click(screen.getByRole('button', { name: /clear.*USDC.*supply/i }));
      expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyAmount: '3,000' });
    });

    it('toggles delta sign from positive to negative and calls actions.updateReserve', () => {
      const actions = makeActions();
      render(
        <PortfolioTokenRow
          entry={makeEntry({ supply: { amount: '7000', inputMode: 'usd', walletValue: 3000, deltaSign: 1 } })}
          actions={actions}
          reserveId="reserve-1"
          onRemove={vi.fn()}
        />,
        { wrapper: Wrapper },
      );
      fireEvent.click(screen.getByRole('button', { name: /adding to position/i }));
      expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyDeltaSign: -1, supplyAmount: '0' });
    });

    it('toggles delta sign when input is empty (Bug 1 fix)', () => {
      const actions = makeActions();
      render(
        <PortfolioTokenRow
          entry={makeEntry({ supply: { amount: '3000', inputMode: 'usd', walletValue: 3000, deltaSign: 1 } })}
          actions={actions}
          reserveId="reserve-1"
          onRemove={vi.fn()}
        />,
        { wrapper: Wrapper },
      );
      fireEvent.click(screen.getByRole('button', { name: /adding to position/i }));
      expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyDeltaSign: -1 });
    });
  });
});
