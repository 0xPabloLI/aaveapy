import { memo, useId } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPercent } from '@/lib/formatters';

interface UtilizationIndicatorProps {
  current: number | null;
  optimal: number | null;
  width?: number;
  height?: number;
}

const UtilizationIndicator = memo(({
  current,
  optimal,
  width = 10,
  height = 24,
}: UtilizationIndicatorProps) => {
  const clipId = useId();

  if (current === null || optimal === null || !Number.isFinite(current) || !Number.isFinite(optimal)) {
    return null;
  }

  const clampedCurrent = Math.max(0, Math.min(100, current));
  const clampedOptimal = Math.max(0, Math.min(100, optimal));
  
  const optimalY = height - (clampedOptimal / 100) * height;
  const currentY = height - (clampedCurrent / 100) * height;
  
  const isOverOptimal = current > optimal;
  const isCritical = current >= 95;

  /** Solid dot only (no stroke, no outer glow disc). */
  const dotRadius = 2.5;
  const trackWidth = 4;
  const trackX = (width - trackWidth) / 2;
  const trackRadius = trackWidth / 2;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className="inline-flex items-center cursor-auto"
          style={{ width, height }}
        >
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="overflow-visible"
          >
            <defs>
              <clipPath id={clipId}>
                <rect
                  x={trackX}
                  y={0}
                  width={trackWidth}
                  height={height}
                  rx={trackRadius}
                />
              </clipPath>
            </defs>
            {/* Single continuous track with rounded corners */}
            <rect
              x={trackX}
              y={0}
              width={trackWidth}
              height={height}
              rx={trackRadius}
              className="fill-secondary/40"
            />
            {/* Below optimal: zone = single tinted fill; dot = full brand cyan (same token as Borrow / util copy) */}
            <rect
              x={trackX}
              y={optimalY}
              width={trackWidth}
              height={height - optimalY}
              clipPath={`url(#${clipId})`}
              className="fill-[rgb(var(--ds-brand-cyan-rgb)/0.32)]"
            />
            {/* Above optimal: zone amber-500; dot matches warning label (amber-600) — avoid 500/600/700 mix */}
            <rect
              x={trackX}
              y={0}
              width={trackWidth}
              height={optimalY}
              clipPath={`url(#${clipId})`}
              className={isCritical ? 'fill-amber-600' : 'fill-amber-500'}
            />
            <circle
              cx={width / 2}
              cy={currentY}
              r={dotRadius}
              className={isCritical ? 'fill-amber-600' : isOverOptimal ? 'fill-amber-500' : 'fill-[rgb(var(--ds-brand-cyan-rgb))]'}
            />
          </svg>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px] p-3">
        <div className="space-y-2 ds-text-12">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Optimal</span>
            <span className="font-medium tabular-nums">{formatPercent(optimal)}</span>
          </div>
          {isCritical ? (
            <p className="text-amber-600 ds-text-11 pt-2 border-t border-border/50">
              ⚠️ Critical / High Risk
            </p>
          ) : isOverOptimal ? (
            <p className="text-amber-500 ds-text-11 pt-2 border-t border-border/50">
              ⚠️ Above optimal
            </p>
          ) : (
            <p className="ds-text-brand-cyan ds-text-11 pt-2 border-t border-border/50">
              Below optimal
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

UtilizationIndicator.displayName = 'UtilizationIndicator';

export default UtilizationIndicator;
