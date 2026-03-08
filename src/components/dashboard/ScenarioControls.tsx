import { useState, useEffect, memo } from 'react';
import { formatNumberInput } from '@/lib/numberFormat';
import { useIsMobile } from '@/hooks/use-mobile';

const INPUT_DEBOUNCE_MS = 300;

interface ScenarioControlsProps {
  onDebouncedChange: (supply: string, borrow: string) => void;
}

const ScenarioControls = memo(({ onDebouncedChange }: ScenarioControlsProps) => {
  const isMobile = useIsMobile();
  const [supplyInput, setSupplyInput] = useState('');
  const [borrowInput, setBorrowInput] = useState('');

  // Debounce and lift values up
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onDebouncedChange(supplyInput, borrowInput);
    }, INPUT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [supplyInput, borrowInput, onDebouncedChange]);

  return (
    <div className="rounded-xl border border-border/70 bg-card/80 p-[var(--ds-space-3)]">
      <div className={`grid gap-[var(--ds-space-2)] ${isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'}`}>
        <label className="block">
          <span className="ds-text-11 text-muted-foreground">Supply amount for all reserves</span>
          <input
            value={supplyInput}
            onChange={(event) => setSupplyInput(formatNumberInput(event.target.value))}
            inputMode="decimal"
            placeholder="e.g. 100,000"
            className="mt-[var(--ds-space-1)] w-full rounded-md border border-border bg-background px-[var(--ds-space-2)] py-[var(--ds-space-1-5)] ds-text-13 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="block">
          <span className="ds-text-11 text-muted-foreground">Borrow amount for all reserves</span>
          <input
            value={borrowInput}
            onChange={(event) => setBorrowInput(formatNumberInput(event.target.value))}
            inputMode="decimal"
            placeholder="e.g. 20,000"
            className="mt-[var(--ds-space-1)] w-full rounded-md border border-border bg-background px-[var(--ds-space-2)] py-[var(--ds-space-1-5)] ds-text-13 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
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
      <p className="mt-[var(--ds-space-2)] ds-text-11 text-muted-foreground">
        Shared scenario applies to every reserve row, sorting mode, and expanded breakdown.
      </p>
    </div>
  );
});

ScenarioControls.displayName = 'ScenarioControls';

export default ScenarioControls;
