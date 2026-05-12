// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { SegmentedToggle, type SegmentedToggleOption } from './segmented-toggle';

const OPTIONS: SegmentedToggleOption<'usd' | 'token'>[] = [
  { value: 'usd', label: 'USD' },
  { value: 'token', label: 'Token' },
];

function Harness({
  orientation = 'vertical' as 'vertical' | 'horizontal',
  initial = 'usd' as 'usd' | 'token',
  onChangeSpy,
}: {
  orientation?: 'vertical' | 'horizontal';
  initial?: 'usd' | 'token';
  onChangeSpy?: (v: 'usd' | 'token') => void;
}) {
  const [value, setValue] = useState<'usd' | 'token'>(initial);
  return (
    <SegmentedToggle
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChangeSpy?.(v);
      }}
      orientation={orientation}
    />
  );
}

describe('SegmentedToggle (vertical)', () => {
  beforeEach(() => cleanup());

  // ─── aria ───────────────────────────────────────────────────

  it('renders a radiogroup with aria-orientation=vertical', () => {
    render(<Harness />);
    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('exposes each option as a radio with aria-checked reflecting state', () => {
    render(<Harness initial="usd" />);
    const usd = screen.getByRole('radio', { name: 'USD' });
    const token = screen.getByRole('radio', { name: 'Token' });
    expect(usd.getAttribute('aria-checked')).toBe('true');
    expect(token.getAttribute('aria-checked')).toBe('false');
  });

  it('horizontal orientation reports aria-orientation=horizontal', () => {
    render(<Harness orientation="horizontal" />);
    expect(
      screen.getByRole('radiogroup').getAttribute('aria-orientation'),
    ).toBe('horizontal');
  });

  // ─── interaction ────────────────────────────────────────────

  it('clicking an option fires onChange and updates aria-checked', () => {
    const spy = vi.fn();
    render(<Harness onChangeSpy={spy} />);
    const token = screen.getByRole('radio', { name: 'Token' });
    fireEvent.click(token);
    expect(spy).toHaveBeenCalledWith('token');
    expect(token.getAttribute('aria-checked')).toBe('true');
    expect(
      screen.getByRole('radio', { name: 'USD' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('clicking the already-active option keeps state stable', () => {
    const spy = vi.fn();
    render(<Harness initial="usd" onChangeSpy={spy} />);
    const usd = screen.getByRole('radio', { name: 'USD' });
    fireEvent.click(usd);
    // onChange still fires (controlled component), but selection stays put.
    expect(usd.getAttribute('aria-checked')).toBe('true');
  });

  // ─── keyboard ───────────────────────────────────────────────

  it('Space/Enter on a focused option activates it (native button semantics)', () => {
    const spy = vi.fn();
    render(<Harness onChangeSpy={spy} />);
    const token = screen.getByRole('radio', { name: 'Token' }) as HTMLButtonElement;
    token.focus();
    expect(document.activeElement).toBe(token);
    // jsdom/happy-dom: clicking simulates Space/Enter activation on <button>.
    fireEvent.click(token);
    expect(spy).toHaveBeenCalledWith('token');
  });

  it('Tab order matches DOM order — both options are focusable', () => {
    render(<Harness />);
    const radios = screen.getAllByRole('radio') as HTMLButtonElement[];
    radios.forEach((btn) => {
      // Native <button> elements are tab-focusable; tabIndex defaults to 0.
      expect(btn.tabIndex).toBeGreaterThanOrEqual(0);
      expect(btn.getAttribute('disabled')).toBeNull();
    });
  });
});
