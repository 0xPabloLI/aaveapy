// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import PortfolioTokenRow from './PortfolioTokenRow';
import type { PortfolioPosition } from '@/types/portfolio';

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

function makeSupply(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    positionId: 'pos-1',
    reserveId: 'reserve-1',
    side: 'supply',
    amount: '5000',
    inputMode: 'usd',
    walletValue: null,
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
    walletValue: null,
    ...overrides,
  };
}

describe('PortfolioTokenRow callbacks', () => {
  beforeEach(() => cleanup());

  it('calls onRemove with reserveId when minus button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <PortfolioTokenRow
        reserveId="reserve-1"
        tokenSymbol="USDC"
        chainName="Ethereum"
        marketName="AaveV3Ethereum"
        supplyPosition={makeSupply()}
        borrowPosition={null}
        onRemove={onRemove}
        onUpdateAmount={vi.fn()}
        onUpdateInputMode={vi.fn()}
      />,
      { wrapper: Wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /remove.*USDC/i }));
    expect(onRemove).toHaveBeenCalledWith('reserve-1');
  });

  it('calls onUpdateAmount when supply input value changes', () => {
    const onUpdateAmount = vi.fn();
    render(
      <PortfolioTokenRow
        reserveId="reserve-1"
        tokenSymbol="USDC"
        chainName="Ethereum"
        marketName="AaveV3Ethereum"
        supplyPosition={makeSupply()}
        borrowPosition={null}
        onRemove={vi.fn()}
        onUpdateAmount={onUpdateAmount}
        onUpdateInputMode={vi.fn()}
      />,
      { wrapper: Wrapper },
    );
    const input = screen.getByRole('textbox', { name: /supply.*USDC/i });
    fireEvent.change(input, { target: { value: '10000' } });
    expect(onUpdateAmount).toHaveBeenCalledWith('pos-1', '10,000');
  });

  it('calls onUpdateAmount when borrow input value changes', () => {
    const onUpdateAmount = vi.fn();
    render(
      <PortfolioTokenRow
        reserveId="reserve-1"
        tokenSymbol="USDC"
        chainName="Ethereum"
        marketName="AaveV3Ethereum"
        supplyPosition={makeSupply()}
        borrowPosition={makeBorrow()}
        onRemove={vi.fn()}
        onUpdateAmount={onUpdateAmount}
        onUpdateInputMode={vi.fn()}
      />,
      { wrapper: Wrapper },
    );
    const input = screen.getByRole('textbox', { name: /borrow.*USDC/i });
    fireEvent.change(input, { target: { value: '3000' } });
    expect(onUpdateAmount).toHaveBeenCalledWith('pos-2', '3,000');
  });

  it('calls onUpdateInputMode when switching supply input mode from USD to token', () => {
    const onUpdateInputMode = vi.fn();
    render(
      <PortfolioTokenRow
        reserveId="reserve-1"
        tokenSymbol="USDC"
        chainName="Ethereum"
        marketName="AaveV3Ethereum"
        supplyPosition={makeSupply({ inputMode: 'usd' })}
        borrowPosition={null}
        onRemove={vi.fn()}
        onUpdateAmount={vi.fn()}
        onUpdateInputMode={onUpdateInputMode}
        tokenPriceInUsd={1}
      />,
      { wrapper: Wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /switch to token input/i }));
    expect(onUpdateInputMode).toHaveBeenCalledWith('pos-1', 'token', 1);
  });

  it('calls onUpdateInputMode when switching supply input mode from token to USD', () => {
    const onUpdateInputMode = vi.fn();
    render(
      <PortfolioTokenRow
        reserveId="reserve-1"
        tokenSymbol="USDC"
        chainName="Ethereum"
        marketName="AaveV3Ethereum"
        supplyPosition={makeSupply({ inputMode: 'token' })}
        borrowPosition={null}
        onRemove={vi.fn()}
        onUpdateAmount={vi.fn()}
        onUpdateInputMode={onUpdateInputMode}
        tokenPriceInUsd={1}
      />,
      { wrapper: Wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /switch to usd input/i }));
    expect(onUpdateInputMode).toHaveBeenCalledWith('pos-1', 'usd', 1);
  });

  it('clears supply amount when clear button is clicked', () => {
    const onUpdateAmount = vi.fn();
    render(
      <PortfolioTokenRow
        reserveId="reserve-1"
        tokenSymbol="USDC"
        chainName="Ethereum"
        marketName="AaveV3Ethereum"
        supplyPosition={makeSupply({ amount: '5000' })}
        borrowPosition={null}
        onRemove={vi.fn()}
        onUpdateAmount={onUpdateAmount}
        onUpdateInputMode={vi.fn()}
      />,
      { wrapper: Wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /clear.*USDC.*supply/i }));
    expect(onUpdateAmount).toHaveBeenCalledWith('pos-1', '');
  });

  describe('delta mode (walletValue present)', () => {
    it('shows delta input with aria-label containing "delta"', () => {
      render(
        <PortfolioTokenRow
          reserveId="reserve-1"
          tokenSymbol="USDC"
          chainName="Ethereum"
          marketName="AaveV3Ethereum"
          supplyPosition={makeSupply({ amount: '5000', walletValue: 3000 })}
          borrowPosition={null}
          onRemove={vi.fn()}
          onUpdateAmount={vi.fn()}
          onUpdateInputMode={vi.fn()}
        />,
        { wrapper: Wrapper },
      );
      expect(screen.getByRole('textbox', { name: /supply.*delta.*USDC/i })).toBeInTheDocument();
    });

    it('calls onUpdateAmount with effective amount when positive delta input changes', () => {
      const onUpdateAmount = vi.fn();
      render(
        <PortfolioTokenRow
          reserveId="reserve-1"
          tokenSymbol="USDC"
          chainName="Ethereum"
          marketName="AaveV3Ethereum"
          supplyPosition={makeSupply({ amount: '5000', walletValue: 3000 })}
          borrowPosition={null}
          onRemove={vi.fn()}
          onUpdateAmount={onUpdateAmount}
          onUpdateInputMode={vi.fn()}
        />,
        { wrapper: Wrapper },
      );
      const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
      fireEvent.change(input, { target: { value: '4000' } });
      // walletValue(3000) + delta(4000) = effective(7000)
      expect(onUpdateAmount).toHaveBeenCalledWith('pos-1', '7,000');
    });

    it('calls onUpdateAmount with effective amount when negative delta input changes', () => {
      const onUpdateAmount = vi.fn();
      render(
        <PortfolioTokenRow
          reserveId="reserve-1"
          tokenSymbol="USDC"
          chainName="Ethereum"
          marketName="AaveV3Ethereum"
          // amount=2000, wallet=5000 → delta = -3000 (negative)
          supplyPosition={makeSupply({ amount: '2000', walletValue: 5000 })}
          borrowPosition={null}
          onRemove={vi.fn()}
          onUpdateAmount={onUpdateAmount}
          onUpdateInputMode={vi.fn()}
        />,
        { wrapper: Wrapper },
      );
      const input = screen.getByRole('textbox', { name: /supply.*delta.*USDC/i });
      // Type 2000 into the delta input (still negative because sign preserved)
      fireEvent.change(input, { target: { value: '2000' } });
      // walletValue(5000) + (-1)*2000 = effective(3000)
      expect(onUpdateAmount).toHaveBeenCalledWith('pos-1', '3,000');
    });

    it('clears delta by restoring to walletValue', () => {
      const onUpdateAmount = vi.fn();
      render(
        <PortfolioTokenRow
          reserveId="reserve-1"
          tokenSymbol="USDC"
          chainName="Ethereum"
          marketName="AaveV3Ethereum"
          // amount=7000, wallet=3000 → delta=+4000 (hasValue=true → clear button shown)
          supplyPosition={makeSupply({ amount: '7000', walletValue: 3000 })}
          borrowPosition={null}
          onRemove={vi.fn()}
          onUpdateAmount={onUpdateAmount}
          onUpdateInputMode={vi.fn()}
        />,
        { wrapper: Wrapper },
      );
      fireEvent.click(screen.getByRole('button', { name: /clear.*USDC.*supply/i }));
      // Clear → effective = walletValue = 3000
      expect(onUpdateAmount).toHaveBeenCalledWith('pos-1', '3,000');
    });

    it('toggles delta sign from positive to negative', () => {
      const onUpdateAmount = vi.fn();
      render(
        <PortfolioTokenRow
          reserveId="reserve-1"
          tokenSymbol="USDC"
          chainName="Ethereum"
          marketName="AaveV3Ethereum"
          // amount=7000, wallet=3000 → delta=+4000
          supplyPosition={makeSupply({ amount: '7000', walletValue: 3000 })}
          borrowPosition={null}
          onRemove={vi.fn()}
          onUpdateAmount={onUpdateAmount}
          onUpdateInputMode={vi.fn()}
        />,
        { wrapper: Wrapper },
      );
      // Click the "Adding to position" button to toggle to negative
      fireEvent.click(screen.getByRole('button', { name: /adding to position/i }));
      // walletValue(3000) + (-1)*4000 = max(-1000, 0) = 0
      expect(onUpdateAmount).toHaveBeenCalledWith('pos-1', '0');
    });
  });
});
