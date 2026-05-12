// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
      {children}
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
      />,
      { wrapper: Wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /switch to token input/i }));
    expect(onUpdateInputMode).toHaveBeenCalledWith('pos-1', 'token');
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
      />,
      { wrapper: Wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /switch to usd input/i }));
    expect(onUpdateInputMode).toHaveBeenCalledWith('pos-1', 'usd');
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
});
