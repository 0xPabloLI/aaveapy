import {
  formatPercent,
  formatScenarioSize,
} from '@/lib/formatters';
import { getAvailableToBorrowUsd } from '@/lib/scenarioSize';
import { FrozenStatusContent } from './FrozenStatusBadge';
import { DeficitTooltipBody } from './DeficitLiquidityRing';
import type { DeficitTooltipBodyProps } from './DeficitLiquidityRing';

/** Same content as CapProgressRing tooltip; used in mobile bottom sheet. */
export function SupplyCapSheetContent({
  currentSize,
  cap,
  inputMode,
  tokenPrice,
  tokenSymbol,
}: {
  currentSize: number;
  cap: number;
  inputMode: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
}) {
  const percentage = Math.min((currentSize / cap) * 100, 100);
  const colorClass =
    percentage >= 95 ? 'ds-text-amber-500' : percentage >= 80 ? 'ds-text-amber-600' : 'ds-text-emerald-500';
  return (
    <div className="space-y-1 ds-text-12">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Total supplied</span>
        <span className="font-medium tabular-nums ds-text-emerald-500">
          {formatScenarioSize(currentSize, { inputMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Supply cap</span>
        <span className="font-medium tabular-nums ds-text-emerald-500">
          {formatScenarioSize(cap, { inputMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Available to supply</span>
        <span className="font-medium tabular-nums ds-text-emerald-500">
          {formatScenarioSize(Math.max(0, cap - currentSize), { inputMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3 pt-1 border-t border-border/50">
        <span className="text-muted-foreground">% of cap</span>
        <span className={`font-bold tabular-nums ${colorClass}`}>{percentage.toFixed(1)}%</span>
      </div>
    </div>
  );
}

/** Same content as BorrowCapProgressRing tooltip; used in mobile bottom sheet. */
export function BorrowCapSheetContent({
  borrowed,
  cap,
  availableLiquidityUsd,
  inputMode,
  tokenPrice,
  tokenSymbol,
  borrowDisabled,
}: {
  borrowed: number;
  cap: number;
  availableLiquidityUsd: number;
  inputMode: 'usd' | 'token';
  tokenPrice?: number | null;
  tokenSymbol?: string | null;
  borrowDisabled?: boolean;
}) {
  const percentage = Math.min((borrowed / cap) * 100, 100);
  const availableToBorrow = borrowDisabled
    ? 0
    : getAvailableToBorrowUsd({
        borrowedUsd: borrowed,
        borrowCapUsd: cap,
        availableLiquidityUsd,
      }) ?? 0;
  const colorClass =
    percentage >= 95 ? 'ds-text-amber-500' : percentage >= 80 ? 'ds-text-amber-600' : 'ds-text-brand-cyan';
  return (
    <div className="space-y-1 ds-text-12">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Total borrowed</span>
        <span className="font-medium tabular-nums ds-text-brand-cyan">
          {formatScenarioSize(borrowed, { inputMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Borrow cap</span>
        <span className="font-medium tabular-nums ds-text-brand-cyan">
          {formatScenarioSize(cap, { inputMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Available liquidity</span>
        <span className={`font-medium tabular-nums ${
          availableLiquidityUsd < 10000
            ? 'ds-text-amber-600'
            : 'ds-text-purple-600'
        }`}>
          {formatScenarioSize(availableLiquidityUsd, { inputMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Available to borrow</span>
        <span className="font-medium tabular-nums ds-text-brand-cyan">
          {formatScenarioSize(availableToBorrow, { inputMode, tokenPrice, tokenSymbol })}
        </span>
      </div>
      <div className="flex justify-between gap-3 pt-1 border-t border-border/50">
        <span className="text-muted-foreground">% of cap</span>
        <span className={`font-bold tabular-nums ${colorClass}`}>{percentage.toFixed(1)}%</span>
      </div>
    </div>
  );
}

/** Utilization bottom sheet content */
export function UtilizationSheetContent({ current, optimal }: { current: number; optimal: number }) {
  const isOverOptimal = current > optimal;
  return (
    <div className="space-y-1 ds-text-12">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Optimal</span>
        <span className="font-medium tabular-nums">{formatPercent(optimal)}</span>
      </div>
      <div className="flex justify-between gap-3 pt-1 border-t border-border/50">
        <span className="text-muted-foreground">Current utilization</span>
        <span className={`font-bold tabular-nums ${isOverOptimal ? 'text-amber-600' : 'text-muted-foreground'}`}>{formatPercent(current)}</span>
      </div>
    </div>
  );
}

/** Deficit details bottom sheet content — delegates to shared DeficitTooltipBody. */
export function DeficitSheetContent({
  inputMode,
  ...rest
}: DeficitTooltipBodyProps & { inputMode?: 'usd' | 'token' }) {
  return <DeficitTooltipBody displayMode={inputMode} {...rest} />;
}

/** Frozen/paused status bottom sheet content */
export function FrozenSheetContent({ isFrozen, isPaused }: { isFrozen?: boolean; isPaused?: boolean }) {
  return <FrozenStatusContent isFrozen={isFrozen} isPaused={isPaused} />;
}
