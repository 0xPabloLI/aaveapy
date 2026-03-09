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

  /* shared token classes */
  const btnBase =
    'inline-flex items-center justify-center shrink-0 rounded-[0.75rem] border border-border/60 bg-background/80 ds-text-11 font-medium transition-all hover:bg-accent/60 hover:border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
  const inputBase =
    'w-full min-w-0 h-[1.75rem] rounded-[0.75rem] border border-border/60 bg-background/80 px-[var(--ds-space-2)] ds-text-11 tabular-nums text-foreground outline-none transition-all placeholder:text-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/40 focus-visible:bg-background';

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-[var(--ds-space-2-5)] py-[var(--ds-space-1-5)] shadow-sm">
      <div className={`flex items-center gap-[var(--ds-space-1-5)] ${isMobile ? 'flex-wrap' : ''}`}>
        {/* Mode toggle — fixed width to prevent resize on switch */}
        <button
          type="button"
          onClick={() => setInputMode(inputMode === 'usd' ? 'token' : 'usd')}
          className={`${btnBase} h-[1.75rem] w-[4.25rem] text-foreground/80`}
          title={inputMode === 'usd' ? 'Switch to token quantity mode' : 'Switch to USD amount mode'}
        >
          {inputMode === 'usd' ? '$ USD' : 'Token'}
        </button>

        {/* Supply input */}
        <div className="flex items-center gap-[var(--ds-space-1)] flex-1 min-w-0">
          <span className="ds-text-11 text-muted-foreground font-medium shrink-0">Supply</span>
          <input
            value={supplyInput}
            onChange={(event) => setSupplyInput(formatNumberInput(event.target.value))}
            inputMode="decimal"
            placeholder={inputMode === 'usd' ? '100,000' : '50'}
            className={inputBase}
          />
        </div>

        {/* Borrow input */}
        <div className="flex items-center gap-[var(--ds-space-1)] flex-1 min-w-0">
          <span className="ds-text-11 text-muted-foreground font-medium shrink-0">Borrow</span>
          <input
            value={borrowInput}
            onChange={(event) => setBorrowInput(formatNumberInput(event.target.value))}
            inputMode="decimal"
            placeholder={inputMode === 'usd' ? '20,000' : '10'}
            className={inputBase}
          />
        </div>

        {/* Clear button */}
        <button
          type="button"
          onClick={() => { setSupplyInput(''); setBorrowInput(''); }}
          disabled={!hasInput}
          className={`${btnBase} h-[1.75rem] px-[var(--ds-space-2)] text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Clear
        </button>
      </div>
    </div>
  );
});

ScenarioControls.displayName = 'ScenarioControls';

export default ScenarioControls;
