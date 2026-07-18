// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReserveIdentity from '@/components/primitives/ReserveIdentity';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function wrap(ui: React.ReactElement) {
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe('ReserveIdentity', () => {
  const baseProps = {
    tokenSymbol: 'USDC',
    chainId: 1,
    chainName: 'Ethereum',
    marketName: 'AaveV4Main',
  };

  it('renders token symbol', () => {
    const { container } = render(wrap(<ReserveIdentity {...baseProps} variant="stacked" />));
    expect(container.textContent).toContain('USDC');
  });

  it('renders market label derived from marketName', () => {
    const { container } = render(wrap(<ReserveIdentity {...baseProps} variant="stacked" />));
    expect(container.textContent).toContain('Main');
  });

  it('renders hubName chip when hubName is provided', () => {
    const { container } = render(wrap(<ReserveIdentity {...baseProps} hubName="Core" variant="stacked" />));
    expect(container.textContent).toContain('Core');
  });

  it('does not render hub chip when hubName is undefined', () => {
    const { container } = render(wrap(<ReserveIdentity {...baseProps} variant="stacked" />));
    expect(container.querySelector('[title^="Hub:"]')).toBeNull();
  });

  it('uses V4 hub chip style for V4 market', () => {
    const { container } = render(wrap(<ReserveIdentity {...baseProps} hubName="Core" variant="stacked" />));
    const hubChip = container.querySelector('[title="Hub: Core"]');
    expect(hubChip?.className).toContain('rgb(var(--ds-brand-magenta-rgb))');
  });

  it('uses default hub chip style for V3 market', () => {
    const { container } = render(
      wrap(<ReserveIdentity {...baseProps} marketName="AaveV3Ethereum" hubName="Core" variant="stacked" />),
    );
    const hubChip = container.querySelector('[title="Hub: Core"]');
    expect(hubChip?.className).toContain('text-muted-foreground');
  });

  describe('compact variant', () => {
    it('renders token symbol in compact layout', () => {
      const { container } = render(wrap(<ReserveIdentity {...baseProps} hubName="Core" variant="compact" />));
      expect(container.textContent).toContain('USDC');
      expect(container.textContent).toContain('Core');
    });

    it('renders dividers between sections', () => {
      const { container } = render(wrap(<ReserveIdentity {...baseProps} hubName="Core" variant="compact" />));
      const dividers = container.querySelectorAll('.h-3.w-px');
      expect(dividers.length).toBeGreaterThanOrEqual(2);
    });

    it('renders only one divider when no hubName', () => {
      const { container } = render(wrap(<ReserveIdentity {...baseProps} variant="compact" />));
      const dividers = container.querySelectorAll('.h-3.w-px');
      expect(dividers.length).toBe(1);
    });
  });

  describe('stacked variant', () => {
    it('renders token symbol and market label in stacked layout', () => {
      const { container } = render(wrap(<ReserveIdentity {...baseProps} variant="stacked" />));
      expect(container.textContent).toContain('USDC');
      expect(container.textContent).toContain('Main');
    });

    it('applies disabled styling when disabled', () => {
      const { container } = render(wrap(<ReserveIdentity {...baseProps} variant="stacked" disabled />));
      const symbol = container.querySelector('.font-semibold.truncate');
      expect(symbol?.className).toContain('line-through');
      expect(symbol?.textContent).toBe('USDC');
    });
  });
});
