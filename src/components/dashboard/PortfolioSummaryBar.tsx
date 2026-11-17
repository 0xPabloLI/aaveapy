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
import { getHfColorClass, getHfColorName, getLowestHfBadgeState, getLowestHfDelta } from '@/lib/portfolioCalculator';
import type { PortfolioSummary, PortfolioHealthFactor } from '@/types/portfolio';

interface PortfolioSummaryBarProps {
  summary?: PortfolioSummary;
  healthFactors?: PortfolioHealthFactor[];
}

/** Shared section-header tokens for the Advanced area (design-principles §2: extract before repeating 3+). */
const SECTION_HEADER_CLASS = 'ds-text-10 font-semibold uppercase tracking-wider text-muted-foreground';

function formatHfValue(hf: number | null): string {
  if (hf == null || hf === 0) return '—';
  return hf.toFixed(2);
}

export function PortfolioSummaryBar({ summary, healthFactors }: PortfolioSummaryBarProps) {
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);

  if (!summary) return null;

  const hfs = healthFactors ?? [];
  const badgeState = getLowestHfBadgeState(hfs);
  const minHf = badgeState.kind === 'computed' ? badgeState.hf : null;
  const { direction: hfDirection } = getLowestHfDelta(hfs);
  const hasHealthFactors = hfs.length > 0;
  const hasAnyValidHf = badgeState.kind === 'computed';

  // NE APY display
  const neApyValue = summary.totalSupplyUsd > 0 ? summary.netEffectiveApy : null;
  const neApyIsNegative = neApyValue != null && neApyValue < 0;

  return (
    <div className="border-t border-border/40 px-2 py-1.5 space-y-1">
      {/* Summary bar — always visible */}
      <div data-testid="portfolio-summary-bar" className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={SECTION_HEADER_CLASS}>Lowest HF</span>
          <span
            data-testid="portfolio-min-hf"
            data-hf-state={badgeState.kind}
            data-hf-color={getHfColorName(minHf)}
            className={cn('ds-text-12 font-bold tabular-nums', getHfColorClass(minHf))}
          >
            {formatHfValue(minHf)}
          </span>
          {badgeState.kind === 'no-debt' && (
            <span data-testid="portfolio-hf-empty-hint" className="ds-text-10 text-muted-foreground">
              no debt
            </span>
          )}
          {hfDirection === 'up' && (
            <span
              data-testid="portfolio-hf-delta-arrow"
              className="text-emerald-600 dark:text-emerald-400 ds-text-10 font-bold"
            >
              ↑
            </span>
          )}
          {hfDirection === 'down' && (
            <span
              data-testid="portfolio-hf-delta-arrow"
              className="text-red-500 dark:text-red-400 ds-text-10 font-bold"
            >
              ↓
            </span>
          )}
        </div>
        {hasHealthFactors && (
          <button
            data-testid="portfolio-advanced-toggle"
            onClick={() => setIsAdvancedExpanded((prev) => !prev)}
            className="flex items-center gap-0.5 ds-text-10 font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Advanced
            <ChevronDown className={cn('size-3 transition-transform', isAdvancedExpanded && 'rotate-180')} />
          </button>
        )}
      </div>

      {/* Advanced expandable section */}
      {isAdvancedExpanded && hasHealthFactors && (
        <div data-testid="portfolio-advanced-content" className="space-y-1.5 pt-1">
          {/* HF per-pool detail */}
          {hasAnyValidHf && (
            <div className="space-y-0.5">
              <div className={SECTION_HEADER_CLASS}>Health Factor {hfs.length > 1 ? `(${hfs.length} pools)` : ''}</div>
              {hfs.map((hf) => {
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

          {/* NE APY — label carries the shared section-header tokens (SECTION_HEADER_CLASS, AAV-1304) */}
          <div className="flex items-center justify-between gap-2 ds-text-11">
            <span className={SECTION_HEADER_CLASS}>Net Effective APY</span>
            <span
              data-testid="portfolio-ne-apy"
              className={cn(
                'font-bold tabular-nums',
                neApyValue == null
                  ? 'text-muted-foreground'
                  : neApyIsNegative
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-foreground',
              )}
            >
              {neApyValue == null ? '—' : formatPercent(neApyValue)}
            </span>
          </div>

          {/* Borrow capacity per pool */}
          {hfs.some((hf) => hf.totalBorrowCapacityUsd > 0 || hf.totalDebtUsd > 0) && (
            <div className="space-y-0.5">
              <div className={SECTION_HEADER_CLASS}>Borrow capacity</div>
              {hfs.some((hf) => hf.eModeFallback) && (
                <div
                  data-testid="emode-fallback-notice"
                  role="status"
                  className="ds-text-11 font-medium text-muted-foreground"
                >
                  eMode data refreshing — using base LTV
                </div>
              )}
              {hfs.map((hf) => {
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
                    <span
                      className={cn(
                        // Numeric summary values are bold (design-system rule); status text
                        // ("No borrowing capacity" / "Borrow limit reached") stays medium —
                        // non-numeric status descriptions are excluded from the bold rule.
                        hasNoCapacity || isExhausted ? 'font-medium' : 'font-bold tabular-nums',
                        isExhausted ? 'text-red-500 dark:text-red-400' : 'text-foreground',
                      )}
                    >
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
