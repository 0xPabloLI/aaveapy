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
      expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyAmount: '7000', supplyDeltaSign: 1, supplyDeltaRawUsd: 4000 });
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
      expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyAmount: '3000', supplyDeltaSign: -1, supplyDeltaRawUsd: -2000 });
    });

    it('clears delta by resetting amount to walletValue so deltaDisplay becomes empty', () => {
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
      expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyAmount: '3000', supplyDeltaSign: 1, supplyDeltaRawUsd: null });
    });

    it('toggles delta sign and recalculates amount when delta is non-zero', () => {
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
      expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyDeltaSign: -1, supplyAmount: '0', supplyDeltaRawUsd: -4000 });
    });

    it('toggles delta sign even when delta is zero (patches sign only)', () => {
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

    it('patches deltaSign alongside amount in handleDeltaCommit (positive delta)', () => {
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
      const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
      fireEvent.change(input, { target: { value: '5000' } });
      fireEvent.blur(input);
      expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyAmount: '8000', supplyDeltaSign: 1, supplyDeltaRawUsd: 5000 });
    });

    it('patches deltaSign alongside amount in handleDeltaCommit (negative delta)', () => {
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
      fireEvent.change(input, { target: { value: '3000' } });
      fireEvent.blur(input);
      expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyAmount: '2000', supplyDeltaSign: -1, supplyDeltaRawUsd: -3000 });
    });

    it('allows toggling from negative to positive even when deltaDisplay is empty', () => {
      const actions = makeActions();
      render(
        <PortfolioTokenRow
          entry={makeEntry({ supply: { amount: '3000', inputMode: 'usd', walletValue: 3000, deltaSign: -1 } })}
          actions={actions}
          reserveId="reserve-1"
          onRemove={vi.fn()}
        />,
        { wrapper: Wrapper },
      );
      fireEvent.click(screen.getByRole('button', { name: /reducing position/i }));
      expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyDeltaSign: 1 });
    });

    it('toggles borrow delta sign even when delta is zero (patches sign only)', () => {
      const actions = makeActions();
      render(
        <PortfolioTokenRow
          entry={makeEntry({ borrow: { amount: '2000', inputMode: 'usd', walletValue: 2000, deltaSign: 1 } })}
          actions={actions}
          reserveId="reserve-1"
          onRemove={vi.fn()}
        />,
        { wrapper: Wrapper },
      );
      fireEvent.click(screen.getByRole('button', { name: /adding to position/i }));
      expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { borrowDeltaSign: -1 });
    });

    it('resets deltaSign to 1 when clearing supply delta', () => {
      const actions = makeActions();
      render(
        <PortfolioTokenRow
          entry={makeEntry({ supply: { amount: '7000', inputMode: 'usd', walletValue: 3000, deltaSign: -1 } })}
          actions={actions}
          reserveId="reserve-1"
          onRemove={vi.fn()}
        />,
        { wrapper: Wrapper },
      );
      fireEvent.click(screen.getByRole('button', { name: /clear.*USDC.*supply/i }));
      expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyAmount: '3000', supplyDeltaSign: 1, supplyDeltaRawUsd: null });
    });

    describe('regression: floating-point noise in effectiveDisplay and deltaDisplay', () => {
      it('effectiveDisplay does not leak raw float noise when inputMode=usd', () => {
        const walletValue = 2999.995379612;
        const amount = String(walletValue + 1000.004620388);
        render(
          <PortfolioTokenRow
            entry={makeEntry({ supply: { amount, inputMode: 'usd', walletValue, deltaSign: 1 } })}
            actions={makeActions()}
            reserveId="reserve-1"
            onRemove={vi.fn()}
            tokenPriceInUsd={1}
          />,
          { wrapper: Wrapper },
        );
        const effectiveSpan = screen.getByLabelText(/Effective amount/);
        const text = effectiveSpan.textContent ?? '';
        const cleaned = text.replace(/,/g, '');
        if (cleaned.includes('.')) {
          const sigDigits = (cleaned.replace(/^0+/, '').replace('.', '').replace(/0+$/, '')).length;
          expect(sigDigits).toBeLessThanOrEqual(8);
        }
        expect(text).not.toMatch(/\d{9,}/);
      });

      it('effectiveDisplay does not leak raw float noise when inputMode=token with non-integer price', () => {
        const walletValue = 3000;
        const tokenAmount = '5';
        const tokenPrice = 1999.9990273412;
        const expectedUsd = 5 * tokenPrice;
        render(
          <PortfolioTokenRow
            entry={makeEntry({ supply: { amount: tokenAmount, inputMode: 'token', walletValue, deltaSign: 1 } })}
            actions={makeActions()}
            reserveId="reserve-1"
            onRemove={vi.fn()}
            tokenPriceInUsd={tokenPrice}
          />,
          { wrapper: Wrapper },
        );
        const effectiveSpan = screen.getByLabelText(/Effective amount/);
        const text = effectiveSpan.textContent ?? '';
        const cleaned = text.replace(/,/g, '');
        if (cleaned.includes('.')) {
          const sigDigits = (cleaned.replace(/^0+/, '').replace('.', '').replace(/0+$/, '')).length;
          expect(sigDigits).toBeLessThanOrEqual(8);
        }
        expect(text).not.toMatch(/\d{9,}/);
      });

      it('deltaDisplay does not leak raw float noise when inputMode=token with non-integer price', () => {
        const walletValue = 3000;
        const tokenAmount = '5';
        const tokenPrice = 1999.9990273412;
        render(
          <PortfolioTokenRow
            entry={makeEntry({ supply: { amount: tokenAmount, inputMode: 'token', walletValue, deltaSign: 1 } })}
            actions={makeActions()}
            reserveId="reserve-1"
            onRemove={vi.fn()}
            tokenPriceInUsd={tokenPrice}
          />,
          { wrapper: Wrapper },
        );
        const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
        const text = (input as HTMLInputElement).value;
        const cleaned = text.replace(/,/g, '');
        if (cleaned.includes('.')) {
          const sigDigits = (cleaned.replace(/^0+/, '').replace('.', '').replace(/0+$/, '')).length;
          expect(sigDigits).toBeLessThanOrEqual(8);
        }
      });
    });

    describe('regression: delta input bugs (AAV-736 follow-up)', () => {
      it('Bug A: clear button should result in empty deltaDisplay, not walletValue', () => {
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
        const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
        expect(input).toHaveValue('4,000');
        fireEvent.click(screen.getByRole('button', { name: /clear.*USDC.*supply/i }));
        expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyAmount: '3000', supplyDeltaSign: 1, supplyDeltaRawUsd: null });
      });

      it('Bug B: toggle sign recalculates amount via effectiveUsd with new sign', () => {
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
        expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyDeltaSign: -1, supplyAmount: '0', supplyDeltaRawUsd: -4000 });
      });

      it('Bug C: delta input commits immediately without debounce delay', () => {
        vi.useFakeTimers();
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
        const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
        fireEvent.change(input, { target: { value: '5' } });
        vi.advanceTimersByTime(0);
        expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyAmount: '3005', supplyDeltaSign: 1, supplyDeltaRawUsd: 5 });
        vi.useRealTimers();
      });

      it('X button and keyboard delete produce identical patches (single semantic path)', () => {
        const xActions = makeActions();
        const { unmount } = render(
          <PortfolioTokenRow
            entry={makeEntry({ supply: { amount: '7000', inputMode: 'usd', walletValue: 3000, deltaSign: 1 } })}
            actions={xActions}
            reserveId="reserve-1"
            onRemove={vi.fn()}
          />,
          { wrapper: Wrapper },
        );
        fireEvent.click(screen.getByRole('button', { name: /clear.*USDC.*supply/i }));
        const xCall = xActions.updateReserve.mock.calls[0];
        unmount();

        const kbActions = makeActions();
        render(
          <PortfolioTokenRow
            entry={makeEntry({ supply: { amount: '7000', inputMode: 'usd', walletValue: 3000, deltaSign: 1 } })}
            actions={kbActions}
            reserveId="reserve-1"
            onRemove={vi.fn()}
          />,
          { wrapper: Wrapper },
        );
        const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
        fireEvent.change(input, { target: { value: '' } });
        fireEvent.blur(input);
        const kbCall = kbActions.updateReserve.mock.calls[0];

        expect(xCall).toEqual(kbCall);
      });

      it('Bug D: clearing delta input and blurring should reset delta to zero (same as eraser)', () => {
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
        const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
        expect(input).toHaveValue('4,000');
        fireEvent.change(input, { target: { value: '' } });
        fireEvent.blur(input);
        expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyAmount: '3000', supplyDeltaSign: 1, supplyDeltaRawUsd: null });
      });

      it('Bug D (borrow): clearing borrow delta input and blurring should reset delta', () => {
        const actions = makeActions();
        render(
          <PortfolioTokenRow
            entry={makeEntry({ borrow: { amount: '5000', inputMode: 'usd', walletValue: 2000, deltaSign: -1 } })}
            actions={actions}
            reserveId="reserve-1"
            onRemove={vi.fn()}
          />,
          { wrapper: Wrapper },
        );
        const input = screen.getByRole('textbox', { name: /borrow.*delta.*USDC/i });
        fireEvent.change(input, { target: { value: '' } });
        fireEvent.blur(input);
        expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { borrowAmount: '2000', borrowDeltaSign: 1, borrowDeltaRawUsd: null });
      });

      it('Bug B (borrow): toggle borrow sign with delta recalculates amount', () => {
        const actions = makeActions();
        render(
          <PortfolioTokenRow
            entry={makeEntry({ borrow: { amount: '5000', inputMode: 'usd', walletValue: 2000, deltaSign: 1 } })}
            actions={actions}
            reserveId="reserve-1"
            onRemove={vi.fn()}
          />,
          { wrapper: Wrapper },
        );
        fireEvent.click(screen.getByRole('button', { name: /adding to position/i }));
        expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { borrowDeltaSign: -1, borrowAmount: '0', borrowDeltaRawUsd: -3000 });
      });

      it('token mode: toggle sign recalculates amount using tokenPriceInUsd', () => {
        const actions = makeActions();
        render(
          <PortfolioTokenRow
            entry={makeEntry({ supply: { amount: '7', inputMode: 'token', walletValue: 3000, deltaSign: 1 } })}
            actions={actions}
            reserveId="reserve-1"
            onRemove={vi.fn()}
            tokenPriceInUsd={1000}
          />,
          { wrapper: Wrapper },
        );
        fireEvent.click(screen.getByRole('button', { name: /adding to position/i }));
        expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', { supplyDeltaSign: -1, supplyAmount: '0', supplyDeltaRawUsd: -4000 });
      });

      it('token mode: toggle sign is no-op when tokenPriceInUsd is missing', () => {
        const actions = makeActions();
        render(
          <PortfolioTokenRow
            entry={makeEntry({ supply: { amount: '7', inputMode: 'token', walletValue: 3000, deltaSign: 1 } })}
            actions={actions}
            reserveId="reserve-1"
            onRemove={vi.fn()}
          />,
          { wrapper: Wrapper },
        );
        fireEvent.click(screen.getByRole('button', { name: /adding to position/i }));
        expect(actions.updateReserve).not.toHaveBeenCalled();
      });
    });

    describe('blur precision: deltaRawUsd eliminates reverse calculation drift', () => {
      it('USD mode: deltaDisplay reads deltaRawUsd exactly, no rounding drift on blur', () => {
        const walletValue = 3000;
        const deltaUsd = 1000;
        const effectiveUsd = walletValue + deltaUsd;
        const actions = makeActions();
        render(
          <PortfolioTokenRow
            entry={makeEntry({ supply: { amount: String(effectiveUsd), inputMode: 'usd', walletValue, deltaSign: 1, deltaRawUsd: deltaUsd } })}
            actions={actions}
            reserveId="reserve-1"
            onRemove={vi.fn()}
          />,
          { wrapper: Wrapper },
        );
        const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
        expect((input as HTMLInputElement).value).toBe('1,000');
      });

      it('token mode: deltaDisplay reads deltaRawUsd exactly, no token-price round-trip drift', () => {
        const walletValue = 3000;
        const deltaUsd = 4000;
        const tokenPrice = 1999.9990273412;
        const tokenAmount = (walletValue + deltaUsd) / tokenPrice;
        const actions = makeActions();
        render(
          <PortfolioTokenRow
            entry={makeEntry({ supply: { amount: String(tokenAmount), inputMode: 'token', walletValue, deltaSign: 1, deltaRawUsd: deltaUsd } })}
            actions={actions}
            reserveId="reserve-1"
            onRemove={vi.fn()}
            tokenPriceInUsd={tokenPrice}
          />,
          { wrapper: Wrapper },
        );
        const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
        const displayed = (input as HTMLInputElement).value.replace(/,/g, '');
        expect(parseFloat(displayed)).toBe(4000);
      });

      it('large delta: deltaRawUsd preserves full precision (8 sig digits only affect amount)', () => {
        const walletValue = 12345678;
        const deltaUsd = 999.9967;
        const actions = makeActions();
        render(
          <PortfolioTokenRow
            entry={makeEntry({ supply: { amount: String(walletValue + deltaUsd), inputMode: 'usd', walletValue, deltaSign: 1, deltaRawUsd: deltaUsd } })}
            actions={actions}
            reserveId="reserve-1"
            onRemove={vi.fn()}
          />,
          { wrapper: Wrapper },
        );
        const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
        const displayed = (input as HTMLInputElement).value.replace(/,/g, '');
        expect(Math.abs(parseFloat(displayed) - deltaUsd)).toBeLessThan(0.01);
      });
    });

    describe('deltaRawUsd write/clear semantics', () => {
      it('handleDeltaCommit writes correct deltaRawUsd on input commit', () => {
        vi.useFakeTimers();
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
        const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
        fireEvent.change(input, { target: { value: '2500' } });
        vi.advanceTimersByTime(0);
        expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', expect.objectContaining({ supplyDeltaRawUsd: 2500 }));
        vi.useRealTimers();
      });

      it('handleDeltaCommit writes negative deltaRawUsd when deltaSign is -1', () => {
        vi.useFakeTimers();
        const actions = makeActions();
        render(
          <PortfolioTokenRow
            entry={makeEntry({ supply: { amount: '1000', inputMode: 'usd', walletValue: 3000, deltaSign: -1 } })}
            actions={actions}
            reserveId="reserve-1"
            onRemove={vi.fn()}
          />,
          { wrapper: Wrapper },
        );
        const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
        fireEvent.change(input, { target: { value: '1500' } });
        vi.advanceTimersByTime(0);
        expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', expect.objectContaining({ supplyDeltaRawUsd: -1500 }));
        vi.useRealTimers();
      });

      it('clearing delta via empty input sends deltaRawUsd: null', () => {
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
        const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
        fireEvent.change(input, { target: { value: '' } });
        fireEvent.blur(input);
        expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', expect.objectContaining({ supplyDeltaRawUsd: null }));
      });

      it('clearing delta via X button sends deltaRawUsd: null', () => {
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
        expect(actions.updateReserve).toHaveBeenCalledWith('reserve-1', expect.objectContaining({ supplyDeltaRawUsd: null }));
      });
    });

    describe('token mode handleDeltaCommit: amount stored in token units', () => {
      it('token mode: amount is stored as token quantity, not USD value', () => {
        vi.useFakeTimers();
        const actions = makeActions();
        const tokenPrice = 2000;
        const walletValue = 3000;
        render(
          <PortfolioTokenRow
            entry={makeEntry({ supply: { amount: '1.5', inputMode: 'token', walletValue, deltaSign: 1 } })}
            actions={actions}
            reserveId="reserve-1"
            onRemove={vi.fn()}
            tokenPriceInUsd={tokenPrice}
          />,
          { wrapper: Wrapper },
        );
        const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
        fireEvent.change(input, { target: { value: '2000' } });
        vi.advanceTimersByTime(0);
        expect(actions.updateReserve).toHaveBeenCalled();
        const call = actions.updateReserve.mock.calls[0];
        const patch = call[1];
        const deltaRawUsd = patch.supplyDeltaRawUsd as number;
        const effectiveUsd = walletValue + deltaRawUsd;
        const expectedTokenAmount = effectiveUsd / tokenPrice;
        const actualTokenAmount = parseFloat(patch.supplyAmount as string);
        expect(Math.abs(actualTokenAmount - expectedTokenAmount)).toBeLessThan(0.001);
        vi.useRealTimers();
      });

      it('token mode: borrow side stores amount as token quantity', () => {
        vi.useFakeTimers();
        const actions = makeActions();
        const tokenPrice = 1500;
        const walletValue = 2000;
        render(
          <PortfolioTokenRow
            entry={makeEntry({ borrow: { amount: '1', inputMode: 'token', walletValue, deltaSign: 1 } })}
            actions={actions}
            reserveId="reserve-1"
            onRemove={vi.fn()}
            tokenPriceInUsd={tokenPrice}
          />,
          { wrapper: Wrapper },
        );
        const input = screen.getByRole('textbox', { name: /borrow.*delta.*USDC/i });
        fireEvent.change(input, { target: { value: '3000' } });
        vi.advanceTimersByTime(0);
        expect(actions.updateReserve).toHaveBeenCalled();
        const call = actions.updateReserve.mock.calls[0];
        const patch = call[1];
        const deltaRawUsd = patch.borrowDeltaRawUsd as number;
        const effectiveUsd = walletValue + deltaRawUsd;
        const expectedTokenAmount = effectiveUsd / tokenPrice;
        const actualTokenAmount = parseFloat(patch.borrowAmount as string);
        expect(Math.abs(actualTokenAmount - expectedTokenAmount)).toBeLessThan(0.001);
        vi.useRealTimers();
      });
    });
  });
});
