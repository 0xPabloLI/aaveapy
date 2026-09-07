// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { LocalCurrencyCalculator, type CalculatorCopy } from './LocalCurrencyCalculator';

const marketsMock = vi.fn();
const fxMock = vi.fn();

vi.mock('@/hooks/useAaveMarkets', () => ({
  useAaveMarkets: () => marketsMock(),
}));
vi.mock('@/lib/fxRates', () => ({
  useUsdRate: () => fxMock(),
}));

const copy: CalculatorCopy = {
  id: 'calc',
  h2: 'Calculadora',
  intro: 'intro',
  numberLocale: 'pt-BR',
  currency: 'BRL',
  defaultAmount: 10000,
  amountLabel: 'Valor',
  reserveLabel: 'Reserva',
  apyLabel: 'APY',
  perYear: 'Por ano',
  perMonth: 'Por mês',
  perDay: 'Por dia',
  usdEquivalentLabel: 'Em dólares:',
  loading: 'carregando',
  error: 'erro',
  disclaimer: 'aviso',
};

const reserve = (over: Record<string, unknown> = {}) => ({
  reserveId: 'r1',
  tokenSymbol: 'USDC',
  chainName: 'Base',
  supplyApy: 5,
  ...over,
});

describe('LocalCurrencyCalculator', () => {
  beforeEach(() => {
    fxMock.mockReturnValue({ data: undefined });
    marketsMock.mockReturnValue({
      data: { reserves: [reserve()] },
      isLoading: false,
      isError: false,
    });
  });

  afterEach(() => cleanup());

  it('computes yearly, monthly and daily earnings in the local currency', () => {
    render(<LocalCurrencyCalculator copy={copy} />);
    // 10.000 BRL at 5% => 500 / year, ~41,67 / month, ~1,37 / day
    expect(screen.getByText(/500,00/)).toBeInTheDocument();
    expect(screen.getByText(/41,67/)).toBeInTheDocument();
    expect(screen.getByText(/1,37/)).toBeInTheDocument();
  });

  it('recomputes when the amount changes and ignores invalid input', () => {
    render(<LocalCurrencyCalculator copy={copy} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '20000' } });
    expect(screen.getByText(/1\.000,00/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'abc' } });
    expect(screen.getAllByText(/0,00/).length).toBeGreaterThan(0);
  });

  it('shows the USD equivalent only when an FX rate is available', () => {
    const { rerender } = render(<LocalCurrencyCalculator copy={copy} />);
    expect(screen.queryByText(/Em dólares:/)).toBeNull();

    fxMock.mockReturnValue({ data: { rate: 5 } });
    rerender(<LocalCurrencyCalculator copy={{ ...copy }} />);
    expect(screen.getByText(/Em dólares:/)).toBeInTheDocument();
  });

  it('excludes frozen or non-stablecoin reserves', () => {
    marketsMock.mockReturnValue({
      data: {
        reserves: [
          reserve({ reserveId: 'weth', tokenSymbol: 'WETH', supplyApy: 9 }),
          reserve({ reserveId: 'frozen', isFrozen: true, supplyApy: 8 }),
          reserve(),
        ],
      },
      isLoading: false,
      isError: false,
    });
    render(<LocalCurrencyCalculator copy={copy} />);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('USDC');
  });

  it('renders an error message when rates cannot be loaded', () => {
    marketsMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<LocalCurrencyCalculator copy={copy} />);
    expect(screen.getByText('erro')).toBeInTheDocument();
  });
});
