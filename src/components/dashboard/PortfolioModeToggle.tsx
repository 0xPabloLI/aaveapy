/**
 * PortfolioModeToggle — segmented "Single / Portfolio" toggle.
 * Matches AprApyToggle sizing and spec (DESIGN-SYSTEM-REFERENCE.md §5.1).
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';

export type SimulationMode = 'single' | 'portfolio';

interface PortfolioModeToggleProps {
  mode: SimulationMode;
  onModeChange: (mode: SimulationMode) => void;
  positionCount?: number;
}

const PortfolioModeToggle = memo(function PortfolioModeToggle({
  mode,
  onModeChange,
  positionCount = 0,
}: PortfolioModeToggleProps) {
  const segBase =
    'px-3 py-1 rounded-md ds-text-12 font-semibold transition-all duration-200';
  const segSelected =
    'bg-card text-foreground shadow-sm border border-border/60';
  const segUnselected =
    'text-muted-foreground hover:text-foreground hover:bg-card/50';

  return (
    <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5 border border-border/40">
      <button
        type="button"
        onClick={() => onModeChange('single')}
        className={cn(segBase, mode === 'single' ? segSelected : segUnselected)}
        aria-pressed={mode === 'single'}
      >
        Single
      </button>
      <button
        type="button"
        onClick={() => onModeChange('portfolio')}
        className={cn(
          segBase,
          mode === 'portfolio' ? segSelected : segUnselected,
          'relative',
        )}
        aria-pressed={mode === 'portfolio'}
      >
        Portfolio
        {positionCount > 0 && (
          <span
            className={cn(
              'ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 ds-text-10 font-bold tabular-nums',
              mode === 'portfolio'
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {positionCount}
          </span>
        )}
      </button>
    </div>
  );
});

export default PortfolioModeToggle;
