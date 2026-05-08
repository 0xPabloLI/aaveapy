import { memo, useId } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipCalloutArrow } from '@/components/ui/tooltip';
import { formatPercent } from '@/lib/formatters';

interface UtilizationIndicatorProps {
  current: number | null;
  optimal: number | null;
  width?: number;
  height?: number;
  disableTooltip?: boolean;
}

const UtilizationIndicator = memo(({
  current,
  optimal,
  width = 10,
  height = 24,
  disableTooltip = false,
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

  /** Solid dot only (no stroke, no outer glow disc). */
  const dotRadius = 2.5;
  const trackWidth = 4;
  const trackX = (width - trackWidth) / 2;
  const trackRadius = trackWidth / 2;

  const svgNode = (
    <div
      className="inline-flex items-center cursor-default"
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
        <rect
          x={trackX}
          y={0}
          width={trackWidth}
          height={height}
          rx={trackRadius}
          className="fill-secondary/40"
        />
        <rect
          x={trackX}
          y={optimalY}
          width={trackWidth}
          height={height - optimalY}
          clipPath={`url(#${clipId})`}
          className="fill-[rgb(var(--ds-brand-cyan-rgb)/0.32)]"
        />
        <rect
          x={trackX}
          y={0}
          width={trackWidth}
          height={optimalY}
          clipPath={`url(#${clipId})`}
          className="fill-[rgb(var(--ds-amber-600-rgb))]"
        />
        <circle
          cx={width / 2}
          cy={currentY}
          r={dotRadius}
          className={isOverOptimal ? 'fill-[rgb(var(--ds-amber-600-rgb))]' : 'fill-[rgb(var(--ds-brand-cyan-rgb))]'}
        />
      </svg>
    </div>
  );

  if (disableTooltip) {
    return svgNode;
  }

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        {svgNode}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] p-3">
        <TooltipCalloutArrow />
        <div className="space-y-2 ds-text-12">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Optimal utilization</span>
            <span className="font-medium tabular-nums">{formatPercent(optimal)}</span>
          </div>
          <div className="flex justify-between gap-4 pt-2 border-t border-border/50">
            <span className="text-muted-foreground">Current utilization</span>
            <span className={`font-bold tabular-nums ${isOverOptimal ? 'text-amber-600' : 'text-muted-foreground'}`}>{formatPercent(current)}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

UtilizationIndicator.displayName = 'UtilizationIndicator';

export default UtilizationIndicator;
