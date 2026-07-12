/**
 * PortfolioSummaryCard — aggregated portfolio metrics rendered as a fixed-layout
 * table that shares the same colgroup as PortfolioResultsTable. Each summary
 * value sits in the same column as the corresponding per-position value below
 * so the eye can trace a value vertically across the two tables:
 *
 *   Totals cell         → Token + Amount (188px)
 *   Native cluster      → blank (Native + Δ)
 *   Incentive cluster   → blank (Incentive + Δ)
 *   Total APY cluster   → Supply / Borrow weighted APY (Total + Δ)
 *   USD/day             → Net Daily Earn
 *
 * Total Supply / Total Borrow 是绝对总量（含 manual + wallet + delta 的合并 amount），
 * 不显示 delta——delta 是"当前 amount vs 钱包快照"的差，只对单个 wallet position 行有语义。
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/formatters';
import type { PortfolioSummary } from '@/types/portfolio';
import { PortfolioColgroup, PF_VALUE_CELL } from './portfolioColumns';

interface PortfolioSummaryCardProps {
  summary: PortfolioSummary;
}

function formatUsd(value: number): string {
  if (value === 0) return '$0';
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatUsdPerDay(value: number): string {
  if (value < 0) return `-$${Math.abs(value).toFixed(2)}/day`;
  if (value > 0) return `+$${value.toFixed(2)}/day`;
  return '$0.00/day';
}

const LABEL_CLASS = 'ds-text-10 text-muted-foreground font-medium';
const VALUE_CLASS = 'ds-text-13 font-bold tabular-nums leading-tight';

const PortfolioSummaryCard = memo(function PortfolioSummaryCard({
  summary,
}: PortfolioSummaryCardProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 overflow-x-auto">
      <table className="w-full ds-text-11" style={{ tableLayout: 'fixed' }}>
        <PortfolioColgroup />
        <tbody>
          <tr>
            {/* Totals — spans Token + Amount (2 cols) */}
            <td colSpan={2} className="px-2.5 py-2 align-top">
              <div className="flex flex-col gap-0.5">
                <span className={LABEL_CLASS}>Total Supply / Borrow</span>
                <span className={VALUE_CLASS}>
                  <span className="ds-text-emerald-600">{formatUsd(summary.totalSupplyUsd)}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="ds-text-brand-cyan">{formatUsd(summary.totalBorrowUsd)}</span>
                </span>
              </div>
            </td>

            {/* Native cluster — blank */}
            <td colSpan={2} />

            {/* Incentive cluster — blank */}
            <td colSpan={2} />

            {/* Total APY cluster — Supply / Borrow weighted APY */}
            <td colSpan={2} className={cn(PF_VALUE_CELL, 'align-top py-2')}>
              <div className="flex flex-col gap-0.5 items-end">
                <span className={LABEL_CLASS}>Weighted APY</span>
                <span className={VALUE_CLASS}>
                  <span className="ds-text-emerald-600">{formatPercent(summary.supplyWeightedApy)}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="ds-text-brand-cyan">{formatPercent(summary.borrowWeightedApy)}</span>
                </span>
              </div>
            </td>

            {/* USD/day — Net Daily Earn */}
            <td className={cn(PF_VALUE_CELL, 'align-top py-2')}>
              <div className="flex flex-col gap-0.5 items-end">
                <span className={LABEL_CLASS}>Net Daily Earn</span>
                <span className={cn(VALUE_CLASS, 'text-foreground')}>
                  {formatUsdPerDay(summary.netUsdPerDay)}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});

export default PortfolioSummaryCard;
