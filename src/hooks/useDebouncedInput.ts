import { useState, useCallback, useRef, useEffect } from 'react';
import { sanitizeNumberInput, formatNumberInput } from '@/lib/numberFormat';

const DEFAULT_DEBOUNCE_MS = 300;

interface UseDebouncedInputParams {
  value?: string;
  onCommit: (formattedValue: string) => void;
  debounceMs?: number;
}

interface UseDebouncedInputReturn {
  displayValue: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  handleFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleClear: () => void;
}

function commitFormatted(rawValue: string, onCommit: (v: string) => void): string {
  const formatted = formatNumberInput(rawValue);
  onCommit(formatted);
  return formatted;
}

export function useDebouncedInput({
  value,
  onCommit,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseDebouncedInputParams): UseDebouncedInputReturn {
  const [displayValue, setDisplayValue] = useState(value ?? '');
  const [isFocused, setIsFocused] = useState(false);
  const lastCommittedRef = useRef(value ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isFocused && value !== undefined && value !== lastCommittedRef.current) {
      setDisplayValue(value);
      lastCommittedRef.current = value;
    }
  }, [value, isFocused]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const doCommit = useCallback(
    (rawValue: string) => {
      clearTimer();
      const formatted = commitFormatted(rawValue, onCommit);
      lastCommittedRef.current = formatted;
      setDisplayValue(formatted);
    },
    [onCommit, clearTimer],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const wasNegative = /^-/.test(e.target.value);
    const raw = e.target.value.replace(/^-/, '');
    const sanitized = wasNegative ? '0' : sanitizeNumberInput(raw);
    setDisplayValue(sanitized);
    clearTimer();
    if (formatNumberInput(sanitized) !== lastCommittedRef.current) {
      timerRef.current = setTimeout(() => {
        const formatted = commitFormatted(sanitized, onCommit);
        lastCommittedRef.current = formatted;
        timerRef.current = null;
      }, debounceMs);
    }
  }, [onCommit, debounceMs, clearTimer]);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      doCommit(e.target.value);
    },
    [doCommit],
  );

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    clearTimer();
    const raw = e.target.value.replace(/,/g, '');
    setDisplayValue(raw);
    e.target.select();
  }, [clearTimer]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        doCommit(displayValue);
      }
    },
    [displayValue, doCommit],
  );

  const handleClear = useCallback(() => {
    clearTimer();
    setDisplayValue('');
    lastCommittedRef.current = '';
    onCommit('');
  }, [onCommit, clearTimer]);

  return { displayValue, handleChange, handleBlur, handleFocus, handleKeyDown, handleClear };
}

export type { UseDebouncedInputParams, UseDebouncedInputReturn };
