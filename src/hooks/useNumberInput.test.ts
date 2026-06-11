// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNumberInput } from './useNumberInput';

describe('useNumberInput', () => {
  describe('onChange (sanitize and format with thousands separators)', () => {
    it('accepts numeric input and formats with thousands separators', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '12345' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('12,345');
    });

    it('adds thousands separators during typing', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('10,000');
    });

    it('handles leading dot as "0."', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '.' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('0.');
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

  describe('onFocus (preserve thousands separators)', () => {
    it('keeps thousands separators on focus', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleBlur({ target: { value: '10000' } } as React.FocusEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('10,000');
      act(() => {
        result.current.handleFocus({ target: { value: '10,000', select: vi.fn(), setSelectionRange: vi.fn() } } as unknown as React.FocusEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('10,000');
    });
  });

  describe('onBlur (format with thousands separators)', () => {
    it('formats value with thousands separators on blur', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleBlur({ target: { value: '10000' } } as React.FocusEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('10,000');
    });

    it('blur is idempotent on already-formatted value', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleBlur({ target: { value: '10,000' } } as React.FocusEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('10,000');
    });
  });

  describe('Backspace behavior (no value jumping)', () => {
    it('deleting last char from "10,000" yields "1,000"', () => {
      const onCommit = vi.fn();
      const { result } = renderHook(() => useNumberInput({ onCommit }));
      act(() => {
        result.current.handleChange({ target: { value: '10000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      act(() => {
        result.current.handleChange({ target: { value: '1000' } } as React.ChangeEvent<HTMLInputElement>);
      });
      expect(result.current.displayValue).toBe('1,000');
    });
  });
});
