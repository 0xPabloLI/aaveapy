import { useState, useCallback } from 'react';
import { sanitizeNumberInput, formatNumberInput } from '@/lib/numberFormat';

interface UseNumberInputParams {
  initialValue?: string;
  onCommit: (formattedValue: string) => void;
}

interface UseNumberInputReturn {
  displayValue: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  handleFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export function useNumberInput({ initialValue = '', onCommit }: UseNumberInputParams): UseNumberInputReturn {
  const [displayValue, setDisplayValue] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeNumberInput(e.target.value);
    setDisplayValue(sanitized);
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    const formatted = formatNumberInput(e.target.value);
    setDisplayValue(formatted);
    onCommit(formatted);
  }, [onCommit]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    const raw = e.target.value.replace(/,/g, '');
    setDisplayValue(raw);
    e.target.select();
  }, []);

  return { displayValue, handleChange, handleBlur, handleFocus };
}

export type { UseNumberInputParams, UseNumberInputReturn };
