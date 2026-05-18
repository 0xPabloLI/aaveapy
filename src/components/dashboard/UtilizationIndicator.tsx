import { memo, useId } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipCalloutArrow } from '@/components/ui/tooltip';
import { formatPercent, formatScenarioSize } from '@/lib/formatters';

interface UtilizationIndicatorProps {
  current: number | null;
  optimal: number | null;
  width?: number;
  height?: number;
  onSortUtilization?: () => void;
  isSortUtilizationActive?: boolean;
  utilizationSortOrder?: 'asc' | 'desc';
  onSortOptimal?: () => void;
  isSortOptimalActive?: boolean;
  optimalSortOrder?: 'asc' | 'desc';
  onSortLiquidity?: () => void;
  isSortLiquidityActive?: boolean;
  liquiditySortOrder?: 'asc' | 'desc';
  availableLiquidityUsd?: number | null;
  displayMode?: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
  /** When true, renders only the bar SVG — caller is responsible for the Tooltip. */
  disableTooltip?: boolean;
}

function SortArrowButton({
  onClick,
  isActive,
  sortOrder,
  ariaLabel,
  className,
}: {
  onClick: () => void;
  isActive: boolean;
  sortOrder?: 'asc' | 'desc';
  ariaLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`ml-1 inline-flex items-center transition-colors ${
        isActive ? (className ?? 'text-foreground') : 'text-muted-foreground/60 hover:text-foreground'
      }`}
      aria-label={ariaLabel}
    >
      {isActive ? (
        sortOrder === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
      ) : (
        <ArrowDown className="w-3 h-3 opacity-50" />
      )}
    </button>
  );
}

/** Shared utilization data display — reused by desktop tooltip and mobile bottom sheet. */
export function UtilizationContent({
  current,
  optimal,
  availableLiquidityUsd,
  displayMode,
  tokenPrice,
  tokenSymbol,
  onSortUtilization,
  isSortUtilizationActive,
  utilizationSortOrder,
  onSortLiquidity,
  isSortLiquidityActive,
  liquiditySortOrder,
  onSortOptimal,
  isSortOptimalActive,
  optimalSortOrder,
}: {
  current: number;
  optimal: number;
  availableLiquidityUsd?: number | null;
  displayMode?: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
  onSortUtilization?: () => void;
  isSortUtilizationActive?: boolean;
  utilizationSortOrder?: 'asc' | 'desc';
  onSortLiquidity?: () => void;
  isSortLiquidityActive?: boolean;
  liquiditySortOrder?: 'asc' | 'desc';
  onSortOptimal?: () => void;
  isSortOptimalActive?: boolean;
  optimalSortOrder?: 'asc' | 'desc';
}) {
  const isOverOptimal = current > optimal;

  const utilizationArrow = onSortUtilization
    ? <SortArrowButton onClick={onSortUtilization} isActive={!!isSortUtilizationActive} sortOrder={utilizationSortOrder} ariaLabel="Sort by utilization" className={isOverOptimal ? 'ds-text-amber-600' : 'text-foreground'} />
    : null;

  const optimalArrow = onSortOptimal
    ? <SortArrowButton onClick={onSortOptimal} isActive={!!isSortOptimalActive} sortOrder={optimalSortOrder} ariaLabel="Sort by optimal utilization" className="text-foreground" />
    : null;

  const liquidityArrow = onSortLiquidity && availableLiquidityUsd != null
    ? <SortArrowButton onClick={onSortLiquidity} isActive={!!isSortLiquidityActive} sortOrder={liquiditySortOrder} ariaLabel="Sort by liquidity" className={availableLiquidityUsd < 10000 ? 'ds-text-amber-600' : 'ds-text-purple-600'} />
    : null;

  return (
    <div className="space-y-2 ds-text-12">
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Optimal utilization</span>
        <span className="font-medium tabular-nums">
          {formatPercent(optimal)}
          {optimalArrow}
        </span>
      </div>
      <div className="flex justify-between gap-4 pt-2 border-t border-border/50">
        <span className="text-muted-foreground">Current utilization</span>
        <span className={`font-bold tabular-nums ${isOverOptimal ? 'text-amber-600' : 'text-muted-foreground'}`}>
          {formatPercent(current)}
          {utilizationArrow}
        </span>
      </div>
      {onSortLiquidity && availableLiquidityUsd != null && (
        <div className="flex justify-between gap-4 pt-2 border-t border-border/50">
          <span className="text-muted-foreground">Available liquidity</span>
          <span className={`font-medium tabular-nums ${availableLiquidityUsd < 10000 ? 'ds-text-amber-600' : 'ds-text-purple-600'}`}>
            {formatScenarioSize(availableLiquidityUsd, { inputMode: displayMode, tokenPrice, tokenSymbol })}
            {liquidityArrow}
          </span>
        </div>
      )}
      <div className="pt-2 border-t border-border/50">
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 flex items-center gap-2 ds-text-12 font-mono text-foreground/80">
          <span>Utilization =</span>
          <div className="flex flex-col items-center leading-tight">
            <span className="px-1">borrowed</span>
            <span className="border-t border-foreground/30 w-full min-w-[calc(8ch+0.5rem)]" />
            <span className="px-1">liquidity + borrowed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const UtilizationIndicator = memo(({
  current,
  optimal,
  width = 10,
  height = 24,
  availableLiquidityUsd,
  displayMode,
  tokenPrice,
  tokenSymbol,
  onSortUtilization,
  isSortUtilizationActive,
  utilizationSortOrder,
  onSortLiquidity,
  isSortLiquidityActive,
  liquiditySortOrder,
  onSortOptimal,
  isSortOptimalActive,
  optimalSortOrder,
  disableTooltip,
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

  const bar = (
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
        {/* Above optimal: zone amber-600; dot matches warning label (amber-600) — darker = warning, brighter = critical */}
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
    return bar;
  }

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        {bar}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[var(--ds-ring-tooltip-max-w)] p-3">
        <TooltipCalloutArrow />
        <UtilizationContent
          current={clampedCurrent}
          optimal={clampedOptimal}
          availableLiquidityUsd={availableLiquidityUsd}
          displayMode={displayMode}
          tokenPrice={tokenPrice}
          tokenSymbol={tokenSymbol}
          onSortUtilization={onSortUtilization}
          isSortUtilizationActive={isSortUtilizationActive}
          utilizationSortOrder={utilizationSortOrder}
          onSortLiquidity={onSortLiquidity}
          isSortLiquidityActive={isSortLiquidityActive}
          liquiditySortOrder={liquiditySortOrder}
          onSortOptimal={onSortOptimal}
          isSortOptimalActive={isSortOptimalActive}
          optimalSortOrder={optimalSortOrder}
        />
      </TooltipContent>
    </Tooltip>
  );
});

UtilizationIndicator.displayName = 'UtilizationIndicator';

export default UtilizationIndicator;
