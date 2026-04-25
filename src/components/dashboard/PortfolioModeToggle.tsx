/**
 * PortfolioModeToggle — "Batch" toggle switch.
 * Uses an iOS-style sliding toggle to clearly signal a higher-level mode
 * switch (vs. the segmented pills used for USD/Token, APR/APY).
 * On mobile the label stacks below the switch.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();

  return (
    <label
      className={cn(
        'flex cursor-pointer select-none items-center gap-1.5',
        isMobile && !isPortfolio && 'flex-col gap-1',
      )}
    >
      <Switch
        checked={isPortfolio}
        onCheckedChange={(checked) =>
          onModeChange(checked ? 'portfolio' : 'single')
        }
        className="data-[state=checked]:!bg-[rgb(var(--ds-brand-cyan-rgb))] data-[state=unchecked]:bg-muted-foreground/30"
      />
      <div className="flex items-center gap-1">
        <span
          className={cn(
            isMobile ? 'ds-text-10' : 'ds-text-12',
            'font-semibold transition-colors duration-200',
            isPortfolio ? 'ds-text-brand-cyan' : 'text-muted-foreground',
          )}
        >
          Batch
        </span>
        {positionCount > 0 && (
          <span
            className={cn(
              'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 ds-text-10 font-bold tabular-nums',
              isPortfolio
                ? 'ds-bg-brand-cyan-10 ds-text-brand-cyan'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {positionCount}
          </span>
        )}
      </div>
    </label>
  );
});

export default PortfolioModeToggle;
