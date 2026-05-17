import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DeficitProgressContent } from './DeficitLiquidityRing';

describe('DeficitProgressContent sort arrows', () => {

  const baseProps = {
    deficitUsd: 50_000_000,
    totalSuppliedUsd: 500_000_000,
  };

  it('renders deficit amount sort arrow button when onSortDeficitAmount is provided', () => {
    const html = renderToString(
      <DeficitProgressContent
        {...baseProps}
        onSortDeficitAmount={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Sort by deficit amount"');
  });

  it('does not render deficit amount sort arrow when onSortDeficitAmount not provided', () => {
    const html = renderToString(
      <DeficitProgressContent {...baseProps} />,
    );
    expect(html).not.toContain('aria-label="Sort by deficit amount"');
  });

  it('renders "Total supplied" sort arrow button when onSortSupplySize is provided', () => {
    const html = renderToString(
      <DeficitProgressContent
        {...baseProps}
        onSortSupplySize={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Sort by supply size"');
  });

  it('does not render "Total supplied" sort arrow when onSortSupplySize not provided', () => {
    const html = renderToString(
      <DeficitProgressContent {...baseProps} />,
    );
    expect(html).not.toContain('aria-label="Sort by supply size"');
  });

  it('shows ArrowDown with opacity-50 when deficit amount sort is inactive', () => {
    const html = renderToString(
      <DeficitProgressContent
        {...baseProps}
        onSortDeficitAmount={() => {}}
        isSortDeficitAmountActive={false}
      />,
    );
    expect(html).toContain('opacity-50');
  });

  it('shows ArrowDown when deficit amount sort is active desc', () => {
    const html = renderToString(
      <DeficitProgressContent
        {...baseProps}
        onSortDeficitAmount={() => {}}
        isSortDeficitAmountActive={true}
        deficitAmountSortOrder="desc"
      />,
    );
    expect(html).toContain('Sort by deficit amount');
  });

  it('shows ArrowUp when deficit amount sort is active asc', () => {
    const html = renderToString(
      <DeficitProgressContent
        {...baseProps}
        onSortDeficitAmount={() => {}}
        isSortDeficitAmountActive={true}
        deficitAmountSortOrder="asc"
      />,
    );
    expect(html).toContain('Sort by deficit amount');
  });
});