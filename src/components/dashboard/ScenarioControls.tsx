import { useState, useEffect, memo, forwardRef, useImperativeHandle } from 'react';
import { formatNumberInput } from '@/lib/numberFormat';
import { useIsMobile } from '@/hooks/use-mobile';

const INPUT_DEBOUNCE_MS = 300;

export type ScenarioInputMode = 'usd' | 'token';

export interface ScenarioControlsHandle {
  setSupplyInput: (value: string) => void;
  setBorrowInput: (value: string) => void;
}

interface ScenarioControlsProps {
  onDebouncedChange: (supply: string, borrow: string, mode: ScenarioInputMode) => void;
}

const ScenarioControls = memo(forwardRef<ScenarioControlsHandle, ScenarioControlsProps>(({ onDebouncedChange }, ref) => {
  const isMobile = useIsMobile();
  const [supplyInput, setSupplyInput] = useState('');
  const [borrowInput, setBorrowInput] = useState('');
  const [inputMode, setInputMode] = useState<ScenarioInputMode>('usd');

  useImperativeHandle(ref, () => ({
    setSupplyInput: (value: string) => setSupplyInput(formatNumberInput(value)),
    setBorrowInput: (value: string) => setBorrowInput(formatNumberInput(value)),
  }), []);

  const handleModeChange = (newMode: ScenarioInputMode) => {
    if (newMode !== inputMode) {
      setSupplyInput('');
      setBorrowInput('');
      setInputMode(newMode);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onDebouncedChange(supplyInput, borrowInput, inputMode);
    }, INPUT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [supplyInput, borrowInput, inputMode, onDebouncedChange]);

  const hasInput = supplyInput || borrowInput;

  /* shared token classes — mobile uses 44px min touch targets */
  const controlH = isMobile ? 'h-[2.75rem]' : 'h-8';
  const fontSize = isMobile ? 'ds-text-11' : 'ds-text-12';
  const inputStyles = `ds-input-surface w-full min-w-0 ${controlH} px-[var(--ds-space-3)] ${fontSize} tabular-nums text-muted-foreground/60 placeholder:text-muted-foreground/30 placeholder:italic`;
  const btnStyles = `ds-btn-secondary ${controlH} ${fontSize} px-[var(--ds-space-2)]`;

  const segmentedSelected = `px-2 py-1 rounded-md ${fontSize} font-semibold bg-card text-foreground shadow-sm border border-border/60 transition-all duration-200`;
  const segmentedUnselected = `px-2 py-1 rounded-md ${fontSize} font-semibold text-muted-foreground hover:text-foreground hover:bg-card/50 transition-all duration-200`;

  if (isMobile) {
    /* Mobile: stacked layout — row 1: mode + clear, row 2: supply, row 3: borrow */
    return (
      <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-[var(--ds-space-2-5)] py-[var(--ds-space-1-5)] shadow-sm">
        <div className="flex flex-col gap-[var(--ds-space-1-5)]">
          {/* Row 1: mode toggle + clear */}
          <div className="flex items-center gap-[var(--ds-space-1-5)]">
            <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40">
              <button
                type="button"
                onClick={() => handleModeChange('usd')}
                className={inputMode === 'usd' ? segmentedSelected : segmentedUnselected}
                aria-pressed={inputMode === 'usd'}
              >
                USD
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('token')}
                className={inputMode === 'token' ? segmentedSelected : segmentedUnselected}
                aria-pressed={inputMode === 'token'}
              >
                Token
              </button>
            </div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => { setSupplyInput(''); setBorrowInput(''); }}
              disabled={!hasInput}
              className={btnStyles}
            >
              Clear
            </button>
          </div>
          {/* Row 2: supply */}
          <div className="flex items-center gap-[var(--ds-space-1)] min-w-0">
            <span className={`${fontSize} text-muted-foreground font-medium shrink-0 w-[3rem]`}>Supply</span>
            <input
              value={supplyInput}
              onChange={(event) => setSupplyInput(formatNumberInput(event.target.value))}
              inputMode="decimal"
              placeholder={inputMode === 'usd' ? '100,000' : '50'}
              className={inputStyles}
            />
          </div>
          {/* Row 3: borrow */}
          <div className="flex items-center gap-[var(--ds-space-1)] min-w-0">
            <span className={`${fontSize} text-muted-foreground font-medium shrink-0 w-[3rem]`}>Borrow</span>
            <input
              value={borrowInput}
              onChange={(event) => setBorrowInput(formatNumberInput(event.target.value))}
              inputMode="decimal"
              placeholder={inputMode === 'usd' ? '20,000' : '10'}
              className={inputStyles}
            />
          </div>
        </div>
      </div>
    );
  }

  /* Desktop: single row */
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-[var(--ds-space-2-5)] py-[var(--ds-space-1-5)] shadow-sm">
      <div className="flex items-center gap-[var(--ds-space-1-5)]">
        <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40">
          <button
            type="button"
            onClick={() => handleModeChange('usd')}
            className={inputMode === 'usd' ? segmentedSelected : segmentedUnselected}
            aria-pressed={inputMode === 'usd'}
          >
            USD
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('token')}
            className={inputMode === 'token' ? segmentedSelected : segmentedUnselected}
            aria-pressed={inputMode === 'token'}
          >
            Token
          </button>
        </div>

        <div className="flex items-center gap-[var(--ds-space-1)] flex-1 min-w-0">
          <span className={`${fontSize} text-muted-foreground font-medium shrink-0`}>Supply</span>
          <input
            value={supplyInput}
            onChange={(event) => setSupplyInput(formatNumberInput(event.target.value))}
            inputMode="decimal"
            placeholder={inputMode === 'usd' ? '100,000' : '50'}
            className={inputStyles}
          />
        </div>

        <div className="flex items-center gap-[var(--ds-space-1)] flex-1 min-w-0">
          <span className={`${fontSize} text-muted-foreground font-medium shrink-0`}>Borrow</span>
          <input
            value={borrowInput}
            onChange={(event) => setBorrowInput(formatNumberInput(event.target.value))}
            inputMode="decimal"
            placeholder={inputMode === 'usd' ? '20,000' : '10'}
            className={inputStyles}
          />
        </div>

        <button
          type="button"
          onClick={() => { setSupplyInput(''); setBorrowInput(''); }}
          disabled={!hasInput}
          className={btnStyles}
        >
          Clear
        </button>
      </div>
    </div>
  );
}));

ScenarioControls.displayName = 'ScenarioControls';

export default ScenarioControls;
