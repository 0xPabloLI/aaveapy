// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNumberInput } from './useNumberInput';

describe('useNumberInput', () => {
  describe('onChange (sanitize only, no thousands separators)', () => {
    it('accepts numeric input', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '12345' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('12345');
    });

    it('accepts decimal input', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '12.5' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('12.5');
    });

    it('rejects non-numeric characters', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '12abc' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('12');
    });

    it('does not add thousands separators during typing', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('10000');
    });

    it('handles leading dot as "0."', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '.' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('0.');
    });

    it('preserves trailing dot for decimal input', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '5.' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('5.');
    });

    it('allows empty string (Backspace to clear)', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('');
    });
  });

  describe('onBlur (format with thousands separators)', () => {
    it('adds thousands separators on blur', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleBlur({ target: { value: '10000' } } as React.FocusEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('10,000');
      expect(onCommit).toHaveBeenCalledWith('10,000');
    });

    it('formats decimal values on blur', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
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
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleBlur({ target: { value: '' } } as React.FocusEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('');
      expect(onCommit).toHaveBeenCalledWith('');
    });

    it('preserves "0." on blur (user may intend to type decimal)', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleBlur({ target: { value: '0.' } } as React.FocusEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('0.');
      expect(onCommit).toHaveBeenCalledWith('0.');
    });
  });

  describe('onFocus (strip thousands separators)', () => {
    it('strips thousands separators on focus for clean editing', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleBlur({ target: { value: '10000' } } as React.FocusEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('10,000');
      act(() => {
        result.current.handleFocus({ target: { value: '10,000', select: vi.fn(), setSelectionRange: vi.fn() } } as unknown as React.FocusEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('10000');
    });
  });

  describe('Backspace behavior (no value jumping)', () => {
    it('deleting last char from "10000" yields "1000" (not "1")', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleChange({ target: { value: '1000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('1000');
    });

    it('deleting from "1,000" (after blur+focus+backspace) yields "100" (raw, no commas)', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '1000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleBlur({ target: { value: '1000' } } as React.FocusEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleFocus({ target: { value: '1,000', select: vi.fn(), setSelectionRange: vi.fn() } } as unknown as React.FocusEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleChange({ target: { value: '100' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('100');
    });
  });
});
