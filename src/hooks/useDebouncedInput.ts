import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { sanitizeNumberInput, formatNumberInput } from '@/lib/numberFormat';

const DEFAULT_DEBOUNCE_MS = 300;

interface UseDebouncedInputParams {
  value?: string;
  onCommit: (formattedValue: string) => void;
  debounceMs?: number;
}

interface UseDebouncedInputReturn {
  displayValue: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  handleFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleClear: () => void;
}

export function computeCursorAfterSanitize(
  oldRaw: string,
  sanitized: string,
  cursorPos: number,
  wasNegative: boolean,
): number {
  if (wasNegative) return 1;
  const prefixBeforeCursor = oldRaw.slice(0, cursorPos).replace(/,/g, '').replace(/[^\d.]/g, '');
  if (oldRaw.startsWith('.') && cursorPos <= 1) {
    return sanitized.startsWith('0.') ? Math.min(cursorPos + 1, sanitized.length) : cursorPos;
  }
  if (oldRaw.startsWith('.') && cursorPos > 1) {
    const decimalBeforeCursor = prefixBeforeCursor.slice(1);
    return Math.min(2 + decimalBeforeCursor.length, sanitized.length);
  }
  return Math.min(prefixBeforeCursor.length, sanitized.length);
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingCursorRef = useRef<number | null>(null);

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

  useLayoutEffect(() => {
    if (pendingCursorRef.current !== null && inputRef.current !== null) {
      const pos = pendingCursorRef.current;
      pendingCursorRef.current = null;
      inputRef.current.setSelectionRange(pos, pos);
    }
  }, [displayValue]);

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
    const cursorPos = e.target.selectionStart ?? e.target.value.length;
    pendingCursorRef.current = computeCursorAfterSanitize(raw, sanitized, cursorPos, wasNegative);
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
    pendingCursorRef.current = raw.length;
    setDisplayValue(raw);
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

  return { displayValue, inputRef, handleChange, handleBlur, handleFocus, handleKeyDown, handleClear };
}

export type { UseDebouncedInputParams, UseDebouncedInputReturn };
