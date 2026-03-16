import { memo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatReserveSizeUsd } from '@/lib/formatters';

interface CapProgressRingProps {
  size: number | null | undefined;
  cap: number | null | undefined;
  ringSize?: number;
  strokeWidth?: number;
  /** When true, only the ring SVG is rendered (no tooltip). Use with parent Popover for click-to-open. */
  disableTooltip?: boolean;
}

const CapProgressRing = memo(({
  size,
  cap,
  ringSize = 12,
  strokeWidth = 1.5,
  disableTooltip = false,
}: CapProgressRingProps) => {
  if (cap == null || !Number.isFinite(cap) || cap <= 0) {
    return null;
  }

  const currentSize = size ?? 0;
  const percentage = Math.min((currentSize / cap) * 100, 100);
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getProgressColor = () => {
    if (percentage >= 95) return 'rgb(var(--ds-amber-600-rgb, 217 119 6))';
    if (percentage >= 80) return 'rgb(var(--ds-amber-500-rgb, 245 158 11))';
    return 'rgb(var(--ds-emerald-600-rgb, 5 150 105))';
  };

  const getProgressColorClass = () => {
    if (percentage >= 95) return 'text-amber-600';
    if (percentage >= 80) return 'text-amber-500';
    return 'ds-text-emerald-600';
  };

  const ringNode = (
    <div className="inline-flex items-center p-0.5 -m-0.5 rounded-full transition-all duration-150 hover:bg-muted/70 hover:scale-[1.12] cursor-auto">
      <svg
            width={ringSize}
            height={ringSize}
            viewBox={`0 0 ${ringSize} ${ringSize}`}
            className="transform -rotate-90"
          >
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-muted-foreground/15"
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke={getProgressColor()}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-300"
            />
          </svg>
        </div>
  );

  if (disableTooltip) {
    return ringNode;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {ringNode}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px]">
        <div className="space-y-1 ds-text-12">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Total supplied</span>
            <span className="font-medium tabular-nums ds-text-emerald-600">{formatReserveSizeUsd(currentSize)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Supply cap</span>
            <span className="font-medium tabular-nums ds-text-emerald-600">{formatReserveSizeUsd(cap)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Available to supply</span>
            <span className="font-medium tabular-nums ds-text-emerald-600">{formatReserveSizeUsd(Math.max(0, cap - currentSize))}</span>
          </div>
          <div className="flex justify-between gap-3 pt-1 border-t border-border/50">
            <span className="text-muted-foreground">% of cap</span>
            <span className={`font-bold tabular-nums ${getProgressColorClass()}`}>
              {percentage.toFixed(1)}%
            </span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

CapProgressRing.displayName = 'CapProgressRing';

export default CapProgressRing;
