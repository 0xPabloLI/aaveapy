import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CapProgressContent } from './CapProgressRing';

describe('CapProgressContent sort arrows', () => {

  const baseProps = {
    currentSize: 500_000_000,
    cap: 1_000_000_000,
  };

  it('renders "Total supplied" sort arrow button when onSortSupplySize is provided', () => {
    const html = renderToString(
      <CapProgressContent
        {...baseProps}
        onSortSupplySize={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Sort by supply size"');
  });

  it('does not render "Total supplied" sort arrow when onSortSupplySize not provided', () => {
    const html = renderToString(
      <CapProgressContent {...baseProps} />,
    );
    expect(html).not.toContain('aria-label="Sort by supply size"');
  });

  it('renders "Suppliable" sort arrow button when onSortSuppliable is provided', () => {
    const html = renderToString(
      <CapProgressContent
        {...baseProps}
        onSortSuppliable={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Sort by suppliable"');
  });

  it('does not render "Suppliable" sort arrow when onSortSuppliable not provided', () => {
    const html = renderToString(
      <CapProgressContent {...baseProps} />,
    );
    expect(html).not.toContain('aria-label="Sort by suppliable"');
  });

  it('shows ArrowDown with opacity-50 when supply size sort is inactive', () => {
    const html = renderToString(
      <CapProgressContent
        {...baseProps}
        onSortSupplySize={() => {}}
        isSortSupplySizeActive={false}
      />,
    );
    expect(html).toContain('opacity-50');
  });

  it('shows ArrowDown when supply size sort is active desc', () => {
    const html = renderToString(
      <CapProgressContent
        {...baseProps}
        onSortSupplySize={() => {}}
        isSortSupplySizeActive={true}
        supplySizeSortOrder="desc"
      />,
    );
    expect(html).toContain('Sort by supply size');
  });

  it('shows ArrowUp when supply size sort is active asc', () => {
    const html = renderToString(
      <CapProgressContent
        {...baseProps}
        onSortSupplySize={() => {}}
        isSortSupplySizeActive={true}
        supplySizeSortOrder="asc"
      />,
    );
    expect(html).toContain('Sort by supply size');
  });
});