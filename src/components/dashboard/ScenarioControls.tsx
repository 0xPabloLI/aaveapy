import { useState, useEffect, memo, forwardRef, useImperativeHandle } from 'react';
import { Trash2 } from 'lucide-react';
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

  /* shared token classes — mobile: h-9 (36px) for max compactness; desktop h-8 */
  const controlH = isMobile ? 'h-9' : 'h-8';
  const fontSize = isMobile ? 'ds-text-11' : 'ds-text-12';
  const inputPx = isMobile ? 'px-2' : 'px-[var(--ds-space-3)]';
  /* min-w on inputs so digits don't get clipped; mobile needs more room for long numbers */
  const inputMinW = isMobile ? 'min-w-[5rem]' : 'min-w-[6rem]';
  const inputBase = `ds-input-surface w-full min-w-0 ${inputMinW} ${controlH} ${inputPx} ${fontSize} tabular-nums placeholder:italic`;
  const clearBtnBase = isMobile
    ? `ds-btn-secondary ${controlH} ${fontSize} inline-flex items-center justify-center px-1.5 min-w-0`
    : `ds-btn-secondary ${controlH} ${fontSize} inline-flex items-center gap-1.5 px-[var(--ds-space-2-5)] min-w-0`;
  const clearBtnState = hasInput
    ? 'border-border bg-muted/80 text-foreground hover:bg-accent hover:border-border shadow-sm'
    : '';

  /* Supply = emerald (green), Borrow = brand-cyan; apply on focus and when filled (mobile + desktop) */
  const supplyInputClasses = `${inputBase} text-muted-foreground/60 placeholder:text-muted-foreground/30 focus:ds-border-emerald-200 focus:ds-bg-emerald-500-10 focus:text-foreground focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ds-ring-emerald-500-15 ${supplyInput.trim() ? 'ds-border-emerald-200 ds-bg-emerald-500-10 ds-text-emerald-500' : ''}`;
  const borrowInputClasses = `${inputBase} text-muted-foreground/60 placeholder:text-muted-foreground/30 focus:ds-border-brand-cyan-20 focus:ds-bg-brand-cyan-10 focus:text-foreground focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ds-ring-brand-cyan-15 ${borrowInput.trim() ? 'ds-border-brand-cyan-20 ds-bg-brand-cyan-10 ds-text-brand-cyan' : ''}`;

  const segmentedSelected = `px-2 py-1 rounded-md ${fontSize} font-semibold bg-card text-foreground shadow-sm border border-border/60 transition-all duration-200`;
  const segmentedUnselected = `px-2 py-1 rounded-md ${fontSize} font-semibold text-muted-foreground hover:text-foreground hover:bg-card/50 transition-all duration-200`;

  /* Label colors: Supply = emerald, Borrow = cyan (always on, so inputs are easy to spot) */
  const supplyLabelMobile = 'text-[9px] font-semibold uppercase tracking-wider ds-text-emerald-500 shrink-0';
  const borrowLabelMobile = 'text-[9px] font-semibold uppercase tracking-wider ds-text-brand-cyan shrink-0';
  const supplyLabelDesktop = `${fontSize} font-medium shrink-0 ds-text-emerald-500`;
  const borrowLabelDesktop = `${fontSize} font-medium shrink-0 ds-text-brand-cyan`;

  if (isMobile) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-1.5 py-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="flex flex-col self-stretch gap-0 rounded-lg bg-muted/60 p-0.5 border border-border/40 shrink-0">
            <button
              type="button"
              onClick={() => handleModeChange('usd')}
              className={`min-h-0 flex-1 ${inputMode === 'usd' ? segmentedSelected : segmentedUnselected}`}
              aria-pressed={inputMode === 'usd'}
              aria-label="USD mode"
            >
              USD
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('token')}
              className={`min-h-0 flex-1 ${inputMode === 'token' ? segmentedSelected : segmentedUnselected}`}
              aria-pressed={inputMode === 'token'}
              aria-label="Token mode"
            >
              Token
            </button>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <span className={`${supplyLabelMobile} w-10 shrink-0`}>Supply</span>
              <input
                value={supplyInput}
                onChange={(event) => setSupplyInput(formatNumberInput(event.target.value))}
                inputMode="decimal"
                placeholder={inputMode === 'usd' ? '100,000' : '50'}
                className={`${supplyInputClasses} flex-1 min-w-0`}
                aria-label="Supply amount"
              />
            </div>
            <div className="flex min-w-0 items-center gap-1">
              <span className={`${borrowLabelMobile} w-10 shrink-0`}>Borrow</span>
              <input
                value={borrowInput}
                onChange={(event) => setBorrowInput(formatNumberInput(event.target.value))}
                inputMode="decimal"
                placeholder={inputMode === 'usd' ? '20,000' : '10'}
                className={`${borrowInputClasses} flex-1 min-w-0`}
                aria-label="Borrow amount"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setSupplyInput(''); setBorrowInput(''); }}
            disabled={!hasInput}
            className={`${clearBtnBase} ${clearBtnState} shrink-0`}
            aria-label="Clear scenario inputs"
          >
            <Trash2 className="size-4 shrink-0" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  /* Desktop: single row */
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-[var(--ds-space-2-5)] py-1">
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
          <span className={supplyLabelDesktop}>Supply</span>
          <input
            value={supplyInput}
            onChange={(event) => setSupplyInput(formatNumberInput(event.target.value))}
            inputMode="decimal"
            placeholder={inputMode === 'usd' ? '100,000' : '50'}
            className={supplyInputClasses}
            aria-label="Supply amount"
          />
        </div>

        <div className="flex items-center gap-[var(--ds-space-1)] flex-1 min-w-0">
          <span className={borrowLabelDesktop}>Borrow</span>
          <input
            value={borrowInput}
            onChange={(event) => setBorrowInput(formatNumberInput(event.target.value))}
            inputMode="decimal"
            placeholder={inputMode === 'usd' ? '20,000' : '10'}
            className={borrowInputClasses}
            aria-label="Borrow amount"
          />
        </div>

        <button
          type="button"
          onClick={() => { setSupplyInput(''); setBorrowInput(''); }}
          disabled={!hasInput}
          className={`${clearBtnBase} ${clearBtnState}`}
          aria-label="Clear scenario inputs"
        >
          <Trash2 className="size-3.5 shrink-0" aria-hidden />
          <span>Clear</span>
        </button>
      </div>
    </div>
  );
}));

ScenarioControls.displayName = 'ScenarioControls';

export default ScenarioControls;
