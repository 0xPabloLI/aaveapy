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
  const btnBase =
    `inline-flex items-center justify-center shrink-0 rounded-md border border-border/50 bg-card/50 ${fontSize} font-medium transition-all hover:bg-accent/60 hover:border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${controlH}`;
  const inputBase =
    `w-full min-w-0 ${controlH} rounded-md border border-border/50 bg-card/50 px-[var(--ds-space-3)] ${fontSize} tabular-nums text-muted-foreground/60 outline-none transition-all placeholder:text-muted-foreground/30 placeholder:italic focus:text-foreground focus:border-[rgb(var(--ds-brand-magenta-rgb))] focus-visible:ring-0 focus-visible:ring-offset-0`;

  if (isMobile) {
    /* Mobile: stacked layout — row 1: mode + clear, row 2: supply, row 3: borrow */
    return (
      <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-[var(--ds-space-2-5)] py-[var(--ds-space-1-5)] shadow-sm">
        <div className="flex flex-col gap-[var(--ds-space-1-5)]">
          {/* Row 1: mode toggle + clear */}
          <div className="flex items-center gap-[var(--ds-space-1-5)]">
            <button
              type="button"
              onClick={() => setInputMode(inputMode === 'usd' ? 'token' : 'usd')}
              className={`${btnBase} w-[4.25rem] text-foreground/80`}
              title={inputMode === 'usd' ? 'Switch to token quantity mode' : 'Switch to USD amount mode'}
            >
              {inputMode === 'usd' ? '$ USD' : 'Token'}
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => { setSupplyInput(''); setBorrowInput(''); }}
              disabled={!hasInput}
              className={`${btnBase} px-[var(--ds-space-2)] text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Clear
            </button>
          </div>
          {/* Row 2: supply */}
          <div className="flex items-center gap-[var(--ds-space-1)] min-w-0">
            <span className="ds-text-11 text-muted-foreground font-medium shrink-0 w-[3rem]">Supply</span>
            <div className="relative flex-1 min-w-0">
              <input
                value={supplyInput}
                onChange={(event) => setSupplyInput(formatNumberInput(event.target.value))}
                inputMode="decimal"
                placeholder={inputMode === 'usd' ? '100,000' : '50'}
                className={inputBase}
              />
              <span className="absolute right-[var(--ds-space-2)] top-1/2 -translate-y-1/2 ds-text-10 text-muted-foreground/40 pointer-events-none select-none">
                {inputMode === 'usd' ? 'USD' : 'Qty'}
              </span>
            </div>
          </div>
          {/* Row 3: borrow */}
          <div className="flex items-center gap-[var(--ds-space-1)] min-w-0">
            <span className="ds-text-11 text-muted-foreground font-medium shrink-0 w-[3rem]">Borrow</span>
            <div className="relative flex-1 min-w-0">
              <input
                value={borrowInput}
                onChange={(event) => setBorrowInput(formatNumberInput(event.target.value))}
                inputMode="decimal"
                placeholder={inputMode === 'usd' ? '20,000' : '10'}
                className={inputBase}
              />
              <span className="absolute right-[var(--ds-space-2)] top-1/2 -translate-y-1/2 ds-text-10 text-muted-foreground/40 pointer-events-none select-none">
                {inputMode === 'usd' ? 'USD' : 'Qty'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* Desktop: single row */
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-[var(--ds-space-2-5)] py-[var(--ds-space-1-5)] shadow-sm">
      <div className="flex items-center gap-[var(--ds-space-1-5)]">
        <button
          type="button"
          onClick={() => setInputMode(inputMode === 'usd' ? 'token' : 'usd')}
          className={`${btnBase} w-[4.25rem] text-foreground/80`}
          title={inputMode === 'usd' ? 'Switch to token quantity mode' : 'Switch to USD amount mode'}
        >
          {inputMode === 'usd' ? '$ USD' : 'Token'}
        </button>

        <div className="flex items-center gap-[var(--ds-space-1)] flex-1 min-w-0">
          <span className="ds-text-12 text-muted-foreground font-medium shrink-0">Supply</span>
          <div className="relative flex-1 min-w-0">
            <input
              value={supplyInput}
              onChange={(event) => setSupplyInput(formatNumberInput(event.target.value))}
              inputMode="decimal"
              placeholder={inputMode === 'usd' ? '100,000' : '50'}
              className={inputBase}
            />
            <span className="absolute right-[var(--ds-space-2)] top-1/2 -translate-y-1/2 ds-text-11 text-muted-foreground/40 pointer-events-none select-none">
              {inputMode === 'usd' ? 'USD' : 'Qty'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-[var(--ds-space-1)] flex-1 min-w-0">
          <span className="ds-text-12 text-muted-foreground font-medium shrink-0">Borrow</span>
          <div className="relative flex-1 min-w-0">
            <input
              value={borrowInput}
              onChange={(event) => setBorrowInput(formatNumberInput(event.target.value))}
              inputMode="decimal"
              placeholder={inputMode === 'usd' ? '20,000' : '10'}
              className={inputBase}
            />
            <span className="absolute right-[var(--ds-space-2)] top-1/2 -translate-y-1/2 ds-text-11 text-muted-foreground/40 pointer-events-none select-none">
              {inputMode === 'usd' ? 'USD' : 'Qty'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { setSupplyInput(''); setBorrowInput(''); }}
          disabled={!hasInput}
          className={`${btnBase} px-[var(--ds-space-2)] text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Clear
        </button>
      </div>
    </div>
  );
});

ScenarioControls.displayName = 'ScenarioControls';

export default ScenarioControls;
