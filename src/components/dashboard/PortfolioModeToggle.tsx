/**
 * PortfolioModeToggle — "Batch" toggle switch.
 * Uses an iOS-style sliding toggle to clearly signal a higher-level mode
 * switch (vs. the segmented pills used for USD/Token, APR/APY).
 * On mobile the label stacks below the switch.
 * The position count is rendered inside the toggle thumb to save space.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useIsMobile } from '@/hooks/use-mobile';
import { BATCH_THEME } from './batchTheme';

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
        isMobile && !isPortfolio && 'flex-col gap-0.5',
      )}
    >
      <span
        className={cn(
          isMobile ? 'ds-text-10' : 'ds-text-12',
          'font-semibold transition-colors duration-200',
          isPortfolio ? BATCH_THEME.text : 'text-muted-foreground',
        )}
      >
        Batch
      </span>
      <Switch
        checked={isPortfolio}
        onCheckedChange={(checked) =>
          onModeChange(checked ? 'portfolio' : 'single')
        }
        className={`${BATCH_THEME.switchCheckedBg} data-[state=unchecked]:bg-muted-foreground/30`}
        thumbContent={
          positionCount > 0 ? (
            <span className="ds-text-9 font-bold leading-none tabular-nums text-foreground">
              {positionCount}
            </span>
          ) : undefined
        }
      />
    </label>
  );
});

export default PortfolioModeToggle;
