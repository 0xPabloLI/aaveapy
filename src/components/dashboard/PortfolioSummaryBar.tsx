/**
 * PortfolioSummaryBar — Summary bar with Min HF badge + Advanced expandable section.
 *
 * Displays below the main table (desktop) or summary card (mobile).
 * Always visible: Min HF badge with color coding.
 * Expandable: HF per-pool detail, Net Effective APY, Borrow capacity.
 *
 * AAV-1252 (P6) — merges P5 (NE APY display) into Summary integration.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercent, formatReserveSizeUsd } from '@/lib/formatters';
import { getHfColorClass, getMinHf, getLowestHfDelta } from '@/lib/portfolioCalculator';
import type { PortfolioSummary, PortfolioHealthFactor } from '@/types/portfolio';

interface PortfolioSummaryBarProps {
  summary?: PortfolioSummary;
  healthFactors?: PortfolioHealthFactor[];
}

function getHfColorName(hf: number | null): string {
  if (hf == null || hf === 0) return 'none';
  if (hf >= 2) return 'green';
  if (hf >= 1.5) return 'yellow';
  if (hf >= 1) return 'orange';
  return 'red';
}

function formatHfValue(hf: number | null): string {
  if (hf == null || hf === 0) return '—';
  return hf.toFixed(2);
}

export function PortfolioSummaryBar({ summary, healthFactors }: PortfolioSummaryBarProps) {
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);

  if (!summary) return null;

  const hfs = healthFactors ?? [];
  const minHf = getMinHf(hfs);
  const { direction: hfDirection } = getLowestHfDelta(hfs);
  const hasHealthFactors = hfs.length > 0;
  const hasAnyValidHf = hfs.some(hf => hf.healthFactor != null && hf.healthFactor > 0);

  // NE APY display
  const neApyValue = summary.totalSupplyUsd > 0 ? summary.netEffectiveApy : null;
  const neApyIsNegative = neApyValue != null && neApyValue < 0;

  return (
    <div className="border-t border-border/40 px-2 py-1.5 space-y-1">
      {/* Summary bar — always visible */}
      <div data-testid="portfolio-summary-bar" className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="ds-text-10 font-semibold uppercase tracking-wider text-muted-foreground">Lowest HF</span>
          <span
            data-testid="portfolio-min-hf"
            data-hf-color={getHfColorName(minHf)}
            className={cn('ds-text-12 font-bold tabular-nums', getHfColorClass(minHf))}
          >
            {formatHfValue(minHf)}
          </span>
          {hfDirection === 'up' && (
            <span data-testid="portfolio-hf-delta-arrow" className="text-emerald-600 dark:text-emerald-400 ds-text-10 font-bold">↑</span>
          )}
          {hfDirection === 'down' && (
            <span data-testid="portfolio-hf-delta-arrow" className="text-red-500 dark:text-red-400 ds-text-10 font-bold">↓</span>
          )}
        </div>
        {hasHealthFactors && (
          <button
            data-testid="portfolio-advanced-toggle"
            onClick={() => setIsAdvancedExpanded(prev => !prev)}
            className="flex items-center gap-0.5 ds-text-10 font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Advanced
            <ChevronDown
              className={cn('size-3 transition-transform', isAdvancedExpanded && 'rotate-180')}
            />
          </button>
        )}
      </div>

      {/* Advanced expandable section */}
      {isAdvancedExpanded && hasHealthFactors && (
        <div data-testid="portfolio-advanced-content" className="space-y-1.5 pt-1">
          {/* HF per-pool detail */}
          {hasAnyValidHf && (
            <div className="space-y-0.5">
              <div className="ds-text-10 font-semibold uppercase tracking-wider text-muted-foreground">
                Health Factor {hfs.length > 1 ? `(${hfs.length} pools)` : ''}
              </div>
              {hfs.map(hf => {
                const poolName = hf.poolKey.split(':')[1] ?? hf.poolKey;
                const remaining = hf.totalBorrowCapacityUsd - hf.totalDebtUsd;
                const hasCurrent = hf.currentHealthFactor != null;
                return (
                  <div
                    key={hf.poolKey}
                    data-testid="portfolio-hf-detail"
                    data-pool-key={hf.poolKey}
                    className="flex items-center justify-between gap-2 ds-text-11"
                  >
                    <span className="text-muted-foreground truncate">{poolName}</span>
                    <span className="flex items-center gap-2">
                      {hasCurrent ? (
                        <>
                          <span className="text-muted-foreground tabular-nums">
                            {formatHfValue(hf.currentHealthFactor)}
                          </span>
                          <span className="text-muted-foreground ds-text-10">→</span>
                        </>
                      ) : null}
                      <span className={cn('font-bold tabular-nums', getHfColorClass(hf.healthFactor))}>
                        {formatHfValue(hf.healthFactor)}
                      </span>
                      <span className="text-muted-foreground tabular-nums ds-text-10">
                        {formatReserveSizeUsd(hf.totalCollateralUsd)} / {formatReserveSizeUsd(hf.totalDebtUsd)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* NE APY */}
          <div className="flex items-center justify-between gap-2 ds-text-11">
            <span className="text-muted-foreground">Net Effective APY</span>
            <span
              data-testid="portfolio-ne-apy"
              className={cn(
                'font-bold tabular-nums',
                neApyValue == null ? 'text-muted-foreground' : neApyIsNegative ? 'text-red-500 dark:text-red-400' : 'text-foreground',
              )}
            >
              {neApyValue == null ? '—' : formatPercent(neApyValue)}
            </span>
          </div>

          {/* Borrow capacity per pool */}
          {hfs.some(hf => hf.totalBorrowCapacityUsd > 0 || hf.totalDebtUsd > 0) && (
            <div className="space-y-0.5">
              <div className="ds-text-10 font-semibold uppercase tracking-wider text-muted-foreground">
                Borrow capacity
              </div>
              {hfs.map(hf => {
                const poolName = hf.poolKey.split(':')[1] ?? hf.poolKey;
                const remaining = hf.totalBorrowCapacityUsd - hf.totalDebtUsd;
                const isExhausted = remaining <= 0 && hf.totalBorrowCapacityUsd > 0;
                const hasNoCapacity = hf.totalBorrowCapacityUsd === 0;
                return (
                  <div
                    key={hf.poolKey}
                    data-testid="portfolio-borrow-capacity"
                    data-pool-key={hf.poolKey}
                    className="flex items-center justify-between gap-2 ds-text-11"
                  >
                    <span className="text-muted-foreground truncate">{poolName}</span>
                    <span className={cn(
                      'font-medium tabular-nums',
                      isExhausted ? 'text-red-500 dark:text-red-400' : 'text-foreground',
                    )}>
                      {hasNoCapacity
                        ? 'No borrowing capacity'
                        : isExhausted
                          ? 'Borrow limit reached'
                          : `${formatReserveSizeUsd(remaining)} remaining`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
