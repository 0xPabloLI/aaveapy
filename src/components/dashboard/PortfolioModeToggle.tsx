/**
 * PortfolioModeToggle — icon + label toggle switch for Single ↔ Portfolio mode.
 * Visually distinct from segmented pills (USD/Token, APR/APY) to signal
 * that it's a higher-level mode switch that changes the entire input bar.
 */
import { memo } from 'react';
import { Layers } from 'lucide-react';
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
  const isPortfolio = mode === 'portfolio';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPortfolio}
      aria-label="Toggle portfolio mode"
      onClick={() => onModeChange(isPortfolio ? 'single' : 'portfolio')}
      className={cn(
        'group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ds-text-12 font-semibold transition-all duration-200',
        'border',
        isPortfolio
          ? 'border-primary/40 bg-primary/10 text-primary shadow-sm shadow-primary/10'
          : 'border-border/40 bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40',
      )}
    >
      <Layers
        className={cn(
          'size-3.5 transition-colors duration-200',
          isPortfolio ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
        )}
        aria-hidden
      />
      <span>Portfolio</span>
      {positionCount > 0 && (
        <span
          className={cn(
            'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 ds-text-10 font-bold tabular-nums',
            isPortfolio
              ? 'bg-primary/20 text-primary'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {positionCount}
        </span>
      )}
    </button>
  );
});

export default PortfolioModeToggle;
