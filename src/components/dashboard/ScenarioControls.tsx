import { useState, useEffect, memo } from 'react';
import { formatNumberInput } from '@/lib/numberFormat';
import { useIsMobile } from '@/hooks/use-mobile';

const INPUT_DEBOUNCE_MS = 300;

export type ScenarioInputMode = 'usd' | 'token';

interface ScenarioControlsProps {
  onDebouncedChange: (supply: string, borrow: string, mode: ScenarioInputMode) => void;
}

const ScenarioControls = memo(({ onDebouncedChange }: ScenarioControlsProps) => {
  const isMobile = useIsMobile();
  const [supplyInput, setSupplyInput] = useState('');
  const [borrowInput, setBorrowInput] = useState('');
  const [inputMode, setInputMode] = useState<ScenarioInputMode>('usd');

  // Debounce and lift values up
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onDebouncedChange(supplyInput, borrowInput, inputMode);
    }, INPUT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [supplyInput, borrowInput, inputMode, onDebouncedChange]);

  const unitLabel = inputMode === 'usd' ? 'USD' : 'Token';
  const hasInput = supplyInput || borrowInput;

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-[var(--ds-space-2-5)] shadow-sm">
      <div className={`grid gap-[var(--ds-space-2)] ${isMobile ? 'grid-cols-1' : 'grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]'} items-end`}>
        {/* Mode toggle — leftmost */}
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => setInputMode(inputMode === 'usd' ? 'token' : 'usd')}
            className="inline-flex h-[34px] items-center justify-center gap-[var(--ds-space-1)] rounded-lg border border-border/60 bg-background/80 px-[var(--ds-space-3)] ds-text-11 font-medium text-foreground/80 transition-all hover:bg-accent/60 hover:border-border focus-visible:ring-2 focus-visible:ring-[rgb(var(--ds-brand-magenta-rgb)/0.5)] focus-visible:outline-none"
            title={inputMode === 'usd' ? 'Switch to token quantity mode' : 'Switch to USD amount mode'}
          >
            <span className="ds-text-13">{inputMode === 'usd' ? '$' : '#'}</span>
            {inputMode === 'usd' ? 'USD' : 'Token'}
          </button>
        </div>

        {/* Supply input */}
        <label className="block group">
          <span className="ds-text-11 text-muted-foreground font-medium">Supply ({unitLabel})</span>
          <div className="relative mt-[var(--ds-space-0-5)]">
            <span className="absolute left-[var(--ds-space-2)] top-1/2 -translate-y-1/2 ds-text-12 text-muted-foreground/60 pointer-events-none select-none">
              {inputMode === 'usd' ? '$' : '#'}
            </span>
            <input
              value={supplyInput}
              onChange={(event) => setSupplyInput(formatNumberInput(event.target.value))}
              inputMode="decimal"
              placeholder={inputMode === 'usd' ? '100,000' : '50'}
              className="w-full rounded-lg border border-border/70 bg-background/80 pl-[var(--ds-space-6)] pr-[var(--ds-space-2)] py-[var(--ds-space-1-5)] ds-text-13 text-foreground tabular-nums outline-none transition-all placeholder:text-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-[rgb(var(--ds-brand-magenta-rgb)/0.5)] focus-visible:border-[rgb(var(--ds-brand-magenta-rgb)/0.4)] focus-visible:bg-background"
            />
          </div>
        </label>

        {/* Borrow input */}
        <label className="block group">
          <span className="ds-text-11 text-muted-foreground font-medium">Borrow ({unitLabel})</span>
          <div className="relative mt-[var(--ds-space-0-5)]">
            <span className="absolute left-[var(--ds-space-2)] top-1/2 -translate-y-1/2 ds-text-12 text-muted-foreground/60 pointer-events-none select-none">
              {inputMode === 'usd' ? '$' : '#'}
            </span>
            <input
              value={borrowInput}
              onChange={(event) => setBorrowInput(formatNumberInput(event.target.value))}
              inputMode="decimal"
              placeholder={inputMode === 'usd' ? '20,000' : '10'}
              className="w-full rounded-lg border border-border/70 bg-background/80 pl-[var(--ds-space-6)] pr-[var(--ds-space-2)] py-[var(--ds-space-1-5)] ds-text-13 text-foreground tabular-nums outline-none transition-all placeholder:text-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-[rgb(var(--ds-brand-magenta-rgb)/0.5)] focus-visible:border-[rgb(var(--ds-brand-magenta-rgb)/0.4)] focus-visible:bg-background"
            />
          </div>
        </label>

        {/* Clear button */}
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setSupplyInput('');
              setBorrowInput('');
            }}
            disabled={!hasInput}
            className="inline-flex h-[34px] items-center justify-center rounded-lg border border-border/60 bg-background/80 px-[var(--ds-space-3)] ds-text-11 font-medium text-muted-foreground transition-all hover:bg-accent/60 hover:text-foreground hover:border-border disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[rgb(var(--ds-brand-magenta-rgb)/0.5)] focus-visible:outline-none"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
});

ScenarioControls.displayName = 'ScenarioControls';

export default ScenarioControls;
