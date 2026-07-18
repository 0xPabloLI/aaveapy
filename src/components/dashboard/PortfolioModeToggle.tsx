/**
 * PortfolioModeToggle — "Portfolio" toggle switch.
 * Uses an iOS-style sliding toggle to clearly signal a higher-level mode
 * switch (vs. the segmented pills used for USD/Token, APR/APY).
 * On mobile the label stacks below the switch.
 * The position count is rendered inside the toggle thumb to save space.
 */
import { memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useIsMobile } from '@/hooks/use-mobile';
import { PORTFOLIO_THEME } from './portfolioTheme';
import { prefetchPortfolioPanel } from './portfolioPrefetch';

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

  // Warm up the lazy Portfolio compare chunk as soon as the user signals
  // intent (hover/focus/touch) so flipping the toggle never blocks on
  // network/parse work.
  const handlePrefetch = useCallback(() => {
    prefetchPortfolioPanel();
  }, []);

  return (
    <label
      data-testid="portfolio-mode-toggle"
      className={cn(
        'flex cursor-pointer select-none items-center gap-1.5 min-h-[44px]',
        isMobile && !isPortfolio && 'flex-col gap-0.5',
      )}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      onTouchStart={handlePrefetch}
    >
      <span
        className={cn(
          isMobile ? 'ds-text-10' : 'ds-text-12',
          'font-semibold transition-colors duration-200',
          isPortfolio ? PORTFOLIO_THEME.text : 'text-muted-foreground',
        )}
      >
        Portfolio
      </span>
      <Switch
        checked={isPortfolio}
        onCheckedChange={(checked) => {
          if (checked) prefetchPortfolioPanel();
          onModeChange(checked ? 'portfolio' : 'single');
        }}
        className={`${PORTFOLIO_THEME.switchCheckedBg} data-[state=unchecked]:bg-muted-foreground/30`}
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
