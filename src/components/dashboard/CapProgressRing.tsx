import { memo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatReserveSizeUsd } from '@/lib/formatters';

interface CapProgressRingProps {
  size: number | null | undefined;
  cap: number | null | undefined;
  ringSize?: number;
  strokeWidth?: number;
}

const CapProgressRing = memo(({
  size,
  cap,
  ringSize = 12,
  strokeWidth = 1.5,
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
    return 'currentColor';
  };

  const getProgressColorClass = () => {
    if (percentage >= 95) return 'text-amber-600';
    if (percentage >= 80) return 'text-amber-500';
    return 'text-foreground';
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
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
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        <div className="space-y-1 ds-text-12">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Total supplied</span>
            <span className="font-medium tabular-nums">{formatReserveSizeUsd(currentSize)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Supply cap</span>
            <span className="font-medium tabular-nums">{formatReserveSizeUsd(cap)}</span>
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
