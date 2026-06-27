import { useCallback, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';

import type { ScenarioControlsHandle, ScenarioInputMode } from '@/components/dashboard/ScenarioControls';

interface UseSharedScenarioInputsOptions {
  /**
   * Imperative handle to the desktop `ScenarioControls` instance. Used
   * by the `handleCorrectSupplyInput` / `handleCorrectBorrowInput`
   * helpers to push back a corrected value (e.g. clamping) into the
   * controlled input.
   */
  scenarioControlsRef: RefObject<ScenarioControlsHandle | null>;
}

export interface UseSharedScenarioInputsResult {
  /** Debounced supply input fed into `useSharedRateSimulations`. */
  debouncedSharedSupplyInput: string;
  /** Debounced borrow input fed into `useSharedRateSimulations`. */
  debouncedSharedBorrowInput: string;
  /** USD vs token interpretation of the inputs above. */
  sharedInputMode: ScenarioInputMode;
  /** Merit / Merkl net-position toggle (default `true`). */
  meritMerklNetPosition: boolean;
  setMeritMerklNetPosition: Dispatch<SetStateAction<boolean>>;
  /** Mobile-only collapsed state for the "advanced controls" sheet. */
  mobileNetOpen: boolean;
  /** Flip `mobileNetOpen`. */
  handleMobileNetToggle: () => void;
  /** Bulk setter wired to ScenarioControls `onDebouncedChange`. */
  handleScenarioChange: (supply: string, borrow: string, mode: ScenarioInputMode) => void;
  /** Push a corrected supply value back into the imperative handle. */
  handleCorrectSupplyInput: (correctedValue: string) => void;
  /** Push a corrected borrow value back into the imperative handle. */
  handleCorrectBorrowInput: (correctedValue: string) => void;
}

/**
 * Owns the shared scenario input surface: the debounced supply/borrow
 * strings, the USD/token mode flag, the Merit/Merkl net-position toggle,
 * the mobile sheet open/close state, plus the callbacks the
 * `ScenarioControls` instances bind to.
 */
export function useSharedScenarioInputs(
  { scenarioControlsRef }: UseSharedScenarioInputsOptions,
): UseSharedScenarioInputsResult {
  const [debouncedSharedSupplyInput, setDebouncedSharedSupplyInput] = useState('');
  const [debouncedSharedBorrowInput, setDebouncedSharedBorrowInput] = useState('');
  const [sharedInputMode, setSharedInputMode] = useState<ScenarioInputMode>('usd');
  const [meritMerklNetPosition, setMeritMerklNetPosition] = useState(true);
  const [mobileNetOpen, setMobileNetOpen] = useState(false);

  const handleMobileNetToggle = useCallback(() => {
    setMobileNetOpen((prev) => !prev);
  }, []);

  const handleScenarioChange = useCallback(
    (supply: string, borrow: string, mode: ScenarioInputMode) => {
      setDebouncedSharedSupplyInput(supply);
      setDebouncedSharedBorrowInput(borrow);
      setSharedInputMode(mode);
    },
    [],
  );

  const handleCorrectSupplyInput = useCallback(
    (correctedValue: string) => {
      scenarioControlsRef.current?.setSupplyInput(correctedValue);
    },
    [scenarioControlsRef],
  );

  const handleCorrectBorrowInput = useCallback(
    (correctedValue: string) => {
      scenarioControlsRef.current?.setBorrowInput(correctedValue);
    },
    [scenarioControlsRef],
  );

  return {
    debouncedSharedSupplyInput,
    debouncedSharedBorrowInput,
    sharedInputMode,
    meritMerklNetPosition,
    setMeritMerklNetPosition,
    mobileNetOpen,
    handleMobileNetToggle,
    handleScenarioChange,
    handleCorrectSupplyInput,
    handleCorrectBorrowInput,
  };
}
