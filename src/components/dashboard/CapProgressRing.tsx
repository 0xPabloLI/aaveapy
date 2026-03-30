import type { ReactNode } from 'react';
import { memo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatScenarioSize } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface CapProgressRingProps {
  size: number | null | undefined;
  cap: number | null | undefined;
  displayMode?: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
  ringSize?: number;
  strokeWidth?: number;
  /** When true, only the ring SVG is rendered (no tooltip). Use with parent Popover for click-to-open. */
  disableTooltip?: boolean;
  /** When set with a valid cap, the tooltip trigger spans this node plus the ring (desktop Size column). */
  label?: ReactNode;
  /** Classes for the combined label+ring trigger (e.g. supply color). */
  triggerClassName?: string;
  /** Accessible name when `label` wraps the trigger. */
  triggerAriaLabel?: string;
}

const CapProgressRing = memo(({
  size,
  cap,
  displayMode = 'usd',
  tokenPrice,
  tokenSymbol,
  ringSize = 12,
  strokeWidth = 1.5,
  disableTooltip = false,
  label,
  triggerClassName,
  triggerAriaLabel,
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
    return 'rgb(var(--ds-emerald-500-rgb, 16 185 129))';
  };

  const getProgressColorClass = () => {
    if (percentage >= 95) return 'text-amber-600';
    if (percentage >= 80) return 'text-amber-500';
    return 'ds-text-emerald-500';
  };

  const tooltipContent = (
    <TooltipContent side="top" className="max-w-[220px]">
      <div className="space-y-1 ds-text-12">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Total supplied</span>
          <span className="font-medium tabular-nums ds-text-emerald-500">
            {formatScenarioSize(currentSize, { inputMode: displayMode, tokenPrice, tokenSymbol })}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Supply cap</span>
          <span className="font-medium tabular-nums ds-text-emerald-500">
            {formatScenarioSize(cap, { inputMode: displayMode, tokenPrice, tokenSymbol })}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Available to supply</span>
          <span className="font-medium tabular-nums ds-text-emerald-500">
            {formatScenarioSize(Math.max(0, cap - currentSize), { inputMode: displayMode, tokenPrice, tokenSymbol })}
          </span>
        </div>
        <div className="flex justify-between gap-3 pt-1 border-t border-border/50">
          <span className="text-muted-foreground">% of cap</span>
          <span className={`font-bold tabular-nums ${getProgressColorClass()}`}>
            {percentage.toFixed(1)}%
          </span>
        </div>
      </div>
    </TooltipContent>
  );

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
    if (label != null) {
      return (
        <span className={cn('inline-flex items-center justify-center gap-[var(--ds-space-1-5)]', triggerClassName)}>
          {label}
          {ringNode}
        </span>
      );
    }
    return ringNode;
  }

  if (label != null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center gap-[var(--ds-space-1-5)] cursor-default text-left',
              'rounded-md py-0.5 pl-1 pr-0.5 -my-0.5 transition-colors hover:bg-muted/50',
              triggerClassName,
            )}
            aria-label={triggerAriaLabel}
            onClick={(event) => event.stopPropagation()}
          >
            {label}
            {ringNode}
          </button>
        </TooltipTrigger>
        {tooltipContent}
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {ringNode}
      </TooltipTrigger>
      {tooltipContent}
    </Tooltip>
  );
});

CapProgressRing.displayName = 'CapProgressRing';

export default CapProgressRing;
