/**
 * @deprecated Use `useDebouncedInput` instead. This module is kept as a
 * compatibility shim and will be removed in a future release.
 *
 * Migration note: replace `initialValue` with `value`. The returned
 * `handleKeyDown` and `handleClear` from `useDebouncedInput` are new
 * and optional to use.
 */
import { useDebouncedInput } from './useDebouncedInput';
import type { UseDebouncedInputParams, UseDebouncedInputReturn } from './useDebouncedInput';

/** @deprecated Use UseDebouncedInputParams instead */
export type UseNumberInputParams = Omit<UseDebouncedInputParams, 'debounceMs'> & {
  initialValue?: string;
};

/** @deprecated Use UseDebouncedInputReturn instead */
export type UseNumberInputReturn = Pick<
  UseDebouncedInputReturn,
  'displayValue' | 'handleChange' | 'handleBlur' | 'handleFocus'
>;

/** @deprecated Use useDebouncedInput instead */
export function useNumberInput({
  initialValue,
  onCommit,
}: UseNumberInputParams): UseNumberInputReturn {
  const { displayValue, handleChange, handleBlur, handleFocus } = useDebouncedInput({
    value: initialValue,
    onCommit,
  });
  return { displayValue, handleChange, handleBlur, handleFocus };
}
