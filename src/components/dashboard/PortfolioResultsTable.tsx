/**
 * PortfolioResultsTable — per-token breakdown of simulation results.
 * Shows each position's amount, native/incentive/total APY, and estimated USD/day.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/formatters';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import type { PortfolioPositionResult , PortfolioPosition } from '@/types/portfolio';

interface PortfolioResultsTableProps {
  positions: PortfolioPosition[];
  results: PortfolioPositionResult[];
}

function formatUsdCompact(value: number): string {
  if (value === 0) return '$0';
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatUsdDay(value: number): string {
  const prefix = value > 0 ? '+' : value < 0 ? '' : '';
  return `${prefix}$${Math.abs(value).toFixed(2)}`;
}

const PortfolioResultsTable = memo(function PortfolioResultsTable({
  positions,
  results,
}: PortfolioResultsTableProps) {
  if (results.length === 0) return null;

  // Merge position display info with results
  const rows = results.map((r) => {
    const pos = positions.find((p) => p.positionId === r.positionId);
    return { ...r, tokenSymbol: pos?.tokenSymbol ?? '?', chainName: pos?.chainName ?? '', marketName: pos?.marketName ?? '' };
  });

  const supplyRows = rows.filter((r) => r.side === 'supply');
  const borrowRows = rows.filter((r) => r.side === 'borrow');

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <table className="w-full ds-text-11">
        <thead>
          <tr className="bg-muted/40 text-muted-foreground">
            <th className="px-2.5 py-1.5 text-left font-semibold">Token</th>
            <th className="px-2 py-1.5 text-right font-semibold">Amount</th>
            <th className="px-2 py-1.5 text-right font-semibold">Native</th>
            <th className="px-2 py-1.5 text-right font-semibold">Incentive</th>
            <th className="px-2 py-1.5 text-right font-semibold">Total</th>
            <th className="px-2.5 py-1.5 text-right font-semibold">USD/day</th>
          </tr>
        </thead>
        <tbody>
          {supplyRows.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={6}
                  className="px-2.5 pt-2 pb-0.5 ds-text-10 font-semibold uppercase tracking-wide ds-text-emerald-600"
                >
                  Supply
                </td>
              </tr>
              {supplyRows.map((r) => (
                <ResultRow key={r.positionId} row={r} />
              ))}
            </>
          )}
          {borrowRows.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={6}
                  className="px-2.5 pt-2 pb-0.5 ds-text-10 font-semibold uppercase tracking-wide ds-text-brand-cyan"
                >
                  Borrow
                </td>
              </tr>
              {borrowRows.map((r) => (
                <ResultRow key={r.positionId} row={r} />
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
});

interface ResultRowData {
  positionId: string;
  tokenSymbol: string;
  chainName: string;
  marketName: string;
  side: 'supply' | 'borrow';
  amountUsd: number;
  nativePercent: number;
  incentivePercent: number;
  totalPercent: number;
  usdPerDay: number;
}

const ResultRow = memo(function ResultRow({ row }: { row: ResultRowData }) {
  const isBorrow = row.side === 'borrow';
  const dayColor = row.usdPerDay > 0 ? 'ds-text-emerald-600' : row.usdPerDay < 0 ? 'text-destructive' : 'text-muted-foreground';

  return (
    <tr className="border-t border-border/30 transition-colors hover:bg-muted/20">
      <td className="px-2.5 py-1.5">
        <div className="flex items-center gap-1.5">
          <TokenIcon symbol={row.tokenSymbol} size={16} />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-foreground truncate">{row.tokenSymbol}</span>
            <span className="ds-text-10 text-muted-foreground truncate">{row.chainName}</span>
          </div>
        </div>
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-foreground font-medium">
        {formatUsdCompact(row.amountUsd)}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-foreground">
        {formatPercent(row.nativePercent)}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-foreground">
        {row.incentivePercent > 0 ? formatPercent(row.incentivePercent) : '-'}
      </td>
      <td className={cn('px-2 py-1.5 text-right tabular-nums font-bold', isBorrow ? 'ds-text-brand-cyan' : 'ds-text-emerald-600')}>
        {formatPercent(row.totalPercent)}
      </td>
      <td className={cn('px-2.5 py-1.5 text-right tabular-nums font-semibold', dayColor)}>
        {formatUsdDay(row.usdPerDay)}
      </td>
    </tr>
  );
});

export default PortfolioResultsTable;
