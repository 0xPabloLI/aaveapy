// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent, screen } from '@testing-library/react';
import { ReservesTableShowMore, ReservesTableFloatingScroll } from './ReservesTablePagination';

describe('ReservesTableShowMore', () => {
  afterEach(() => cleanup());

  it('renders "Show N More Reserves" button when there are more reserves to show', () => {
    const onShowAll = vi.fn();
    render(
      <ReservesTableShowMore
        totalCount={50}
        displayCount={20}
        showAll={false}
        defaultVisibleCount={20}
        variant="desktop"
        onShowAll={onShowAll}
        onShowLess={vi.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: /show 30 more reserves/i });
    expect(button).toBeInTheDocument();
  });

  it('calls onShowAll when "Show More" button is clicked', () => {
    const onShowAll = vi.fn();
    render(
      <ReservesTableShowMore
        totalCount={50}
        displayCount={20}
        showAll={false}
        defaultVisibleCount={20}
        variant="desktop"
        onShowAll={onShowAll}
        onShowLess={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /show 30 more reserves/i }));
    expect(onShowAll).toHaveBeenCalledOnce();
  });

  it('renders "Show Less" button when showAll is true and totalCount > defaultVisibleCount', () => {
    render(
      <ReservesTableShowMore
        totalCount={50}
        displayCount={50}
        showAll
        defaultVisibleCount={20}
        variant="desktop"
        onShowAll={vi.fn()}
        onShowLess={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
  });

  it('calls onShowLess when "Show Less" button is clicked', () => {
    const onShowLess = vi.fn();
    render(
      <ReservesTableShowMore
        totalCount={50}
        displayCount={50}
        showAll
        defaultVisibleCount={20}
        variant="desktop"
        onShowAll={vi.fn()}
        onShowLess={onShowLess}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /show less/i }));
    expect(onShowLess).toHaveBeenCalledOnce();
  });

  it('renders nothing when all reserves are shown and showAll is false', () => {
    const { container } = render(
      <ReservesTableShowMore
        totalCount={20}
        displayCount={20}
        showAll={false}
        defaultVisibleCount={20}
        variant="desktop"
        onShowAll={vi.fn()}
        onShowLess={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('uses desktop border-t wrapper for desktop variant', () => {
    render(
      <ReservesTableShowMore
        totalCount={50}
        displayCount={20}
        showAll={false}
        defaultVisibleCount={20}
        variant="desktop"
        onShowAll={vi.fn()}
        onShowLess={vi.fn()}
      />,
    );
    const wrapper = screen.getByRole('button', { name: /show 30 more reserves/i }).parentElement;
    expect(wrapper?.className).toContain('border-t');
  });

  it('does not use border-t wrapper for mobile variant', () => {
    render(
      <ReservesTableShowMore
        totalCount={50}
        displayCount={20}
        showAll={false}
        defaultVisibleCount={20}
        variant="mobile"
        onShowAll={vi.fn()}
        onShowLess={vi.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: /show 30 more reserves/i });
    const wrapper = button.parentElement;
    expect(wrapper?.className).not.toContain('border-t');
  });

  it('shows both "Show More" and "Show Less" when partially expanded beyond default', () => {
    render(
      <ReservesTableShowMore
        totalCount={100}
        displayCount={60}
        showAll
        defaultVisibleCount={20}
        variant="desktop"
        onShowAll={vi.fn()}
        onShowLess={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /show 40 more reserves/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
  });
});

describe('ReservesTableFloatingScroll', () => {
  afterEach(() => cleanup());

  it('renders nothing when tableInView is false', () => {
    const { container } = render(
      <ReservesTableFloatingScroll
        tableInView={false}
        variant="desktop"
        onScrollToTop={vi.fn()}
        onScrollToBottom={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders scroll buttons when tableInView is true', () => {
    render(
      <ReservesTableFloatingScroll
        tableInView
        variant="desktop"
        onScrollToTop={vi.fn()}
        onScrollToBottom={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Scroll to table top')).toBeInTheDocument();
    expect(screen.getByLabelText('Scroll to table bottom')).toBeInTheDocument();
  });

  it('renders refresh button when onRefresh is provided', () => {
    render(
      <ReservesTableFloatingScroll
        tableInView
        variant="desktop"
        onScrollToTop={vi.fn()}
        onScrollToBottom={vi.fn()}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByLabelText(/refresh data/i)).toBeInTheDocument();
  });

  it('still renders refresh button when onRefresh is not provided (but click is no-op)', () => {
    render(
      <ReservesTableFloatingScroll
        tableInView
        variant="desktop"
        onScrollToTop={vi.fn()}
        onScrollToBottom={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/refresh data/i)).toBeInTheDocument();
  });
});
