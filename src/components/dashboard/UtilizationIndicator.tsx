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
  width = 6,
  height = 14,
}: UtilizationIndicatorProps) => {
  if (current === null || optimal === null || !Number.isFinite(current) || !Number.isFinite(optimal)) {
    return null;
  }

  const clampedCurrent = Math.max(0, Math.min(100, current));
  const clampedOptimal = Math.max(0, Math.min(100, optimal));
  
  const optimalY = height - (clampedOptimal / 100) * height;
  const currentY = height - (clampedCurrent / 100) * height;
  const isOverOptimal = current > optimal;
  
  const dotRadius = 2;
  const trackWidth = 3;
  const trackX = (width - trackWidth) / 2;

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
            {/* Safe zone: 0 to optimal (bottom portion) */}
            <rect
              x={trackX}
              y={optimalY}
              width={trackWidth}
              height={height - optimalY}
              rx={trackWidth / 2}
              className="fill-secondary/40"
            />
            {/* Over-optimal zone: optimal to 100% (top portion) */}
            <rect
              x={trackX}
              y={0}
              width={trackWidth}
              height={optimalY}
              rx={trackWidth / 2}
              className="fill-warning/40"
            />
            {/* Optimal marker line */}
            <line
              x1={0}
              y1={optimalY}
              x2={width}
              y2={optimalY}
              strokeWidth={1}
              className="stroke-muted-foreground/60"
            />
            {/* Current position dot */}
            <circle
              cx={width / 2}
              cy={currentY}
              r={dotRadius}
              className={isOverOptimal ? 'fill-warning' : 'fill-muted-foreground'}
            />
          </svg>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[180px]">
        <div className="space-y-1 ds-text-12">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Optimal</span>
            <span className="font-medium tabular-nums">{formatPercent(optimal)}</span>
          </div>
          {isOverOptimal && (
            <p className="text-warning ds-text-11 pt-1 border-t border-border/50">
              Above optimal → higher borrow rates
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

UtilizationIndicator.displayName = 'UtilizationIndicator';

export default UtilizationIndicator;
