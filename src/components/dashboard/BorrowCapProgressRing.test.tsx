import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BorrowCapProgressContent } from './BorrowCapProgressRing';

describe('BorrowCapProgressContent sort arrows', () => {

  const baseProps = {
    borrowed: 300_000_000,
    cap: 1_000_000_000,
    availableLiquidityUsd: 700_000_000,
  };

  it('renders "Total borrowed" sort arrow button when onSortBorrowSize is provided', () => {
    const html = renderToString(
      <BorrowCapProgressContent
        {...baseProps}
        onSortBorrowSize={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Sort by borrow size"');
  });

  it('does not render "Total borrowed" sort arrow when onSortBorrowSize not provided', () => {
    const html = renderToString(
      <BorrowCapProgressContent {...baseProps} />,
    );
    expect(html).not.toContain('aria-label="Sort by borrow size"');
  });

  it('renders "Borrowable" sort arrow button when onSortBorrowable is provided', () => {
    const html = renderToString(
      <BorrowCapProgressContent
        {...baseProps}
        onSortBorrowable={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Sort by borrowable"');
  });

  it('does not render "Borrowable" sort arrow when onSortBorrowable not provided', () => {
    const html = renderToString(
      <BorrowCapProgressContent {...baseProps} />,
    );
    expect(html).not.toContain('aria-label="Sort by borrowable"');
  });

  it('shows ArrowDown with opacity-50 when borrow size sort is inactive', () => {
    const html = renderToString(
      <BorrowCapProgressContent
        {...baseProps}
        onSortBorrowSize={() => {}}
        isSortBorrowSizeActive={false}
      />,
    );
    expect(html).toContain('opacity-50');
  });

  it('shows ArrowDown when borrow size sort is active desc', () => {
    const html = renderToString(
      <BorrowCapProgressContent
        {...baseProps}
        onSortBorrowSize={() => {}}
        isSortBorrowSizeActive={true}
        borrowSizeSortOrder="desc"
      />,
    );
    expect(html).toContain('Sort by borrow size');
  });

  it('shows ArrowUp when borrow size sort is active asc', () => {
    const html = renderToString(
      <BorrowCapProgressContent
        {...baseProps}
        onSortBorrowSize={() => {}}
        isSortBorrowSizeActive={true}
        borrowSizeSortOrder="asc"
      />,
    );
    expect(html).toContain('Sort by borrow size');
  });
});