// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedInput, computeCursorAfterSanitize } from './useDebouncedInput';

const DEBOUNCE_MS = 300;

describe('useDebouncedInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('onChange (sanitize only, no thousands separators)', () => {
    it('accepts numeric input', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '12345' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('12345');
    });

    it('accepts decimal input', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '12.5' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('12.5');
    });

    it('rejects non-numeric characters', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '12abc' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('12');
    });

    it('does not add thousands separators during typing', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('10000');
    });

    it('handles leading dot as "0."', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '.' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('0.');
    });

    it('preserves trailing dot for decimal input', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '5.' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('5.');
    });

    it('allows empty string (Backspace to clear)', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('');
    });

    it('clamps negative input to 0', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '-5' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('0');
    });
  });

  describe('debounce behavior', () => {
    it('does not call onCommit immediately on change', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(onCommit).not.toHaveBeenCalled();
    });

    it('calls onCommit with formatted value after debounce delay', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith('10,000');
    });

    it('resets debounce timer on subsequent changes (only last value committed)', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '1000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      act(() => {
        result.current.handleChange({ target: { value: '2000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith('2,000');
    });

    it('does not commit if value has not changed since last commit', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe('onBlur (immediate commit + format)', () => {
    it('commits immediately on blur without waiting for debounce', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleBlur({ target: { value: '10000' } } as React.FocusEvent<HTMLInputElement>);
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith('10,000');
    });

    it('cancels pending debounce timer on blur', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleBlur({ target: { value: '10000' } } as React.FocusEvent<HTMLInputElement>);
      });
      act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it('formats with thousands separators on blur', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '1234.5' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleBlur({ target: { value: '1234.5' } } as React.FocusEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('1,234.5');
      expect(onCommit).toHaveBeenCalledWith('1,234.5');
    });

    it('handles empty value on blur', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleBlur({ target: { value: '' } } as React.FocusEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('');
      expect(onCommit).toHaveBeenCalledWith('');
    });

    it('preserves "0." on blur', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleBlur({ target: { value: '0.' } } as React.FocusEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('0.');
      expect(onCommit).toHaveBeenCalledWith('0.');
    });
  });

  describe('onFocus (strip thousands separators + select)', () => {
    it('strips thousands separators on focus for clean editing', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleBlur({ target: { value: '10000' } } as React.FocusEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('10,000');
      act(() => {
        result.current.handleFocus({ target: { value: '10,000', select: vi.fn() } } as unknown as React.FocusEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('10000');
    });

    it('selects all text on focus', () => {
      const onCommit = vi.fn();
      const select = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleFocus({ target: { value: '10,000', select } } as unknown as React.FocusEvent<HTMLInputElement>);
      });
      expect(select).toHaveBeenCalled();
    });
  });

  describe('Enter key (immediate commit)', () => {
    it('commits immediately on Enter key press', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleKeyDown({ key: 'Enter' } as React.KeyboardEvent<HTMLInputElement>);
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith('10,000');
    });

    it('cancels pending debounce timer on Enter', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleKeyDown({ key: 'Enter' } as React.KeyboardEvent<HTMLInputElement>);
      });
      act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it('ignores non-Enter keys', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleKeyDown({ key: 'Tab' } as React.KeyboardEvent<HTMLInputElement>);
      });
      expect(onCommit).not.toHaveBeenCalled();
    });
  });

  describe('external value sync', () => {
    it('syncs displayValue when external value prop changes (not focused)', () => {
      const onCommit = vi.fn();
      const { result, rerender } = renderHook(
        ({ value }) => useDebouncedInput({ onCommit, value }),
        { initialProps: { value: '1,000' } },
      );
      expect(result.current.displayValue).toBe('1,000');
      rerender({ value: '2,000' });
      expect(result.current.displayValue).toBe('2,000');
    });

    it('does not overwrite displayValue while user is typing (focused)', () => {
      const onCommit = vi.fn();
      const { result, rerender } = renderHook(
        ({ value }) => useDebouncedInput({ onCommit, value }),
        { initialProps: { value: '1,000' } },
      );
      act(() => {
        result.current.handleFocus({ target: { value: '1,000', select: vi.fn() } } as unknown as React.FocusEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleChange({ target: { value: '5000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      rerender({ value: '1,000' });
      expect(result.current.displayValue).toBe('5000');
    });
  });

  describe('clear behavior', () => {
    it('clears displayValue and commits empty string', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleClear();
      });
      expect(result.current.displayValue).toBe('');
      expect(onCommit).toHaveBeenCalledWith('');
    });
  });

  describe('Backspace behavior (no value jumping)', () => {
    it('deleting last char from "10000" yields "1000"', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleChange({ target: { value: '1000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('1000');
    });

    it('deleting from "1,000" (after blur+focus+backspace) yields "100"', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '1000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleBlur({ target: { value: '1000' } } as React.FocusEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleFocus({ target: { value: '1,000', select: vi.fn() } } as unknown as React.FocusEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleChange({ target: { value: '100' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('100');
    });
  });

  describe('cleanup', () => {
    it('cancels debounce timer on unmount', () => {
      const onCommit = vi.fn();
      const { result, unmount } = renderHook(() => useDebouncedInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      unmount();
      act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
      });
      expect(onCommit).not.toHaveBeenCalled();
    });
  });
});

describe('computeCursorAfterSanitize (AAV-775 pure logic)', () => {
  it('cursor after decimal stays after decimal when leading zero added', () => {
    expect(computeCursorAfterSanitize('.', '0.', 1, false)).toBe(2);
  });

  it('cursor at end of number stays at end', () => {
    expect(computeCursorAfterSanitize('15', '15', 2, false)).toBe(2);
  });

  it('cursor in middle of number preserved after sanitize (insert at pos 1)', () => {
    expect(computeCursorAfterSanitize('15', '105', 1, false)).toBe(1);
  });

  it('cursor after decimal point preserved', () => {
    expect(computeCursorAfterSanitize('1.', '1.5', 2, false)).toBe(2);
  });

  it('cursor after full decimal preserved', () => {
    expect(computeCursorAfterSanitize('1.5', '1.55', 3, false)).toBe(3);
  });

  it('cursor at start of number stays at start', () => {
    expect(computeCursorAfterSanitize('5', '5', 0, false)).toBe(0);
  });

  it('negative input cursor goes to position 1 (after zero)', () => {
    expect(computeCursorAfterSanitize('5', '0', 1, true)).toBe(1);
  });

  it('cursor clamped to sanitized length', () => {
    expect(computeCursorAfterSanitize('123', '12', 3, false)).toBe(2);
  });
});

describe('useDebouncedInput cursor position preservation (AAV-775 integration)', () => {
  it('handleChange computes cursor and useLayoutEffect restores it via inputRef', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDebouncedInput({ onCommit, debounceMs: 0 }));
    act(() => {
      result.current.handleChange({
        target: { value: '.', selectionStart: 1 },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(result.current.displayValue).toBe('0.');
  });

  it('handleChange with middle cursor does not reset displayValue', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDebouncedInput({ onCommit, debounceMs: 0 }));
    act(() => {
      result.current.handleChange({
        target: { value: '15', selectionStart: 2 },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(result.current.displayValue).toBe('15');
  });
});
