import { memo } from 'react';
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
  height = 18,
}: UtilizationIndicatorProps) => {
  if (current === null || optimal === null || !Number.isFinite(current) || !Number.isFinite(optimal)) {
    return null;
  }

  const clampedCurrent = Math.max(0, Math.min(100, current));
  const clampedOptimal = Math.max(0, Math.min(100, optimal));
  
  const optimalY = height - (clampedOptimal / 100) * height;
  const currentY = height - (clampedCurrent / 100) * height;
  const isOverOptimal = current > optimal;
  
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
              <clipPath id="trackClip">
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
              className="fill-secondary/70"
            />
            {/* Amber overlay for over-optimal zone, clipped to track shape */}
            <rect
              x={trackX}
              y={0}
              width={trackWidth}
              height={optimalY}
              clipPath="url(#trackClip)"
              className="fill-amber-500/60"
            />
            {/* Current position dot */}
            <circle
              cx={width / 2}
              cy={currentY}
              r={dotRadius}
              className={isOverOptimal ? 'fill-amber-600' : 'fill-foreground/80'}
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
          {isOverOptimal && (
            <p className="text-amber-600 ds-text-11 pt-2 border-t border-border/50">
              ⚠️ Above optimal
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

UtilizationIndicator.displayName = 'UtilizationIndicator';

export default UtilizationIndicator;
