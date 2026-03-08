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

  return (
    <div className="rounded-xl border border-border/70 bg-card/80 p-[var(--ds-space-3)]">
      <div className={`grid gap-[var(--ds-space-2)] ${isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]'}`}>
        <label className="block">
          <span className="ds-text-11 text-muted-foreground">Supply amount ({unitLabel})</span>
          <input
            value={supplyInput}
            onChange={(event) => setSupplyInput(formatNumberInput(event.target.value))}
            inputMode="decimal"
            placeholder={inputMode === 'usd' ? 'e.g. 100,000' : 'e.g. 50'}
            className="mt-[var(--ds-space-1)] w-full rounded-md border border-border bg-background px-[var(--ds-space-2)] py-[var(--ds-space-1-5)] ds-text-13 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="block">
          <span className="ds-text-11 text-muted-foreground">Borrow amount ({unitLabel})</span>
          <input
            value={borrowInput}
            onChange={(event) => setBorrowInput(formatNumberInput(event.target.value))}
            inputMode="decimal"
            placeholder={inputMode === 'usd' ? 'e.g. 20,000' : 'e.g. 10'}
            className="mt-[var(--ds-space-1)] w-full rounded-md border border-border bg-background px-[var(--ds-space-2)] py-[var(--ds-space-1-5)] ds-text-13 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <div className={`flex ${isMobile ? 'justify-start' : 'justify-end'} items-end`}>
          <button
            type="button"
            onClick={() => setInputMode(inputMode === 'usd' ? 'token' : 'usd')}
            className="inline-flex h-[38px] items-center justify-center rounded-md border border-border/70 bg-background px-[var(--ds-space-3)] ds-text-12 font-medium text-foreground transition-colors hover:bg-muted/40"
            title={inputMode === 'usd' ? 'Switch to token quantity mode' : 'Switch to USD amount mode'}
          >
            {inputMode === 'usd' ? '$ USD' : '⟠ Token'}
          </button>
        </div>
        <div className={`flex ${isMobile ? 'justify-start' : 'justify-end'} items-end`}>
          <button
            type="button"
            onClick={() => {
              setSupplyInput('');
              setBorrowInput('');
            }}
            disabled={!supplyInput && !borrowInput}
            className="inline-flex h-[38px] items-center justify-center rounded-md border border-border/70 bg-background px-[var(--ds-space-3)] ds-text-12 text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear scenario
          </button>
        </div>
      </div>
    </div>
  );
});

ScenarioControls.displayName = 'ScenarioControls';

export default ScenarioControls;
