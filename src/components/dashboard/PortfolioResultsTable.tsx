/**
 * PortfolioResultsTable — per-token breakdown of simulation results.
 * Shows each position's amount, native/incentive/total APY, and estimated USD/day.
 * When delta metrics are available, inline delta is shown after the after value.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/formatters';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import type { PortfolioPositionResult, PortfolioReserveEntry, PortfolioSimulationMetric } from '@/types/portfolio';

interface PortfolioResultsTableProps {
  entries: PortfolioReserveEntry[];
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

const formatDeltaPercent = (value: number | null | undefined): string | null => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (Math.abs(value) < 0.005) return null;
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
};

const formatDeltaUsdDay = (value: number | null | undefined): string | null => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (Math.abs(value) < 0.005) return null;
  const prefix = value > 0 ? '+' : '';
  return `${prefix}$${Math.abs(value).toFixed(2)}`;
};

const InlineDelta = memo(function InlineDelta({
  value,
  accentClass,
}: {
  value: string | null;
  accentClass: string;
}) {
  if (!value) return null;
  return (
    <span className={cn('ds-text-10 tabular-nums whitespace-nowrap ml-1', accentClass)}>
      {value}
    </span>
  );
});

const PortfolioResultsTable = memo(function PortfolioResultsTable({
  entries,
  results,
}: PortfolioResultsTableProps) {
  if (results.length === 0) return null;

  const entryMap = new Map(entries.map(e => [e.reserveId, e]));
  const rows = results.map((r) => {
    const entry = entryMap.get(r.reserveId);
    return { ...r, tokenSymbol: entry?.tokenSymbol ?? '?', chainName: entry?.chainName ?? '', marketName: entry?.marketName ?? '' };
  });

  const supplyRows = rows.filter((r) => r.side === 'supply');
  const borrowRows = rows.filter((r) => r.side === 'borrow');
  const colCount = 6;

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
                  colSpan={colCount}
                  className="px-2.5 pt-2 pb-0.5 ds-text-10 font-semibold uppercase tracking-wide ds-text-emerald-600"
                >
                  Supply
                </td>
              </tr>
              {supplyRows.map((r, i) => (
                <ResultRow key={`${r.reserveId}-supply-${i}`} row={r} accentClass="ds-text-emerald-600" />
              ))}
            </>
          )}
          {borrowRows.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={colCount}
                  className="px-2.5 pt-2 pb-0.5 ds-text-10 font-semibold uppercase tracking-wide ds-text-brand-cyan"
                >
                  Borrow
                </td>
              </tr>
              {borrowRows.map((r, i) => (
                <ResultRow key={`${r.reserveId}-borrow-${i}`} row={r} accentClass="ds-text-brand-cyan" />
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
});

interface ResultRowData extends PortfolioPositionResult {
  tokenSymbol: string;
  chainName: string;
  marketName: string;
}

const ResultRow = memo(function ResultRow({
  row,
  accentClass,
}: {
  row: ResultRowData;
  accentClass: string;
}) {
  const isBorrow = row.side === 'borrow';
  const dayColor = row.usdPerDay > 0 ? 'ds-text-emerald-600' : row.usdPerDay < 0 ? 'text-destructive' : 'text-muted-foreground';

  const nativeDelta = formatDeltaPercent(row.nativeMetric?.delta ?? null);
  const incentiveDelta = formatDeltaPercent(row.incentiveMetric?.delta ?? null);
  const totalDelta = formatDeltaPercent(row.totalMetric?.delta ?? null);
  const usdPerDayDelta = formatDeltaUsdDay(row.usdPerDayMetric?.delta ?? null);

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
      <td className="px-2 py-1.5 text-right tabular-nums text-foreground whitespace-nowrap">
        {formatPercent(row.nativePercent)}
        <InlineDelta value={nativeDelta} accentClass={accentClass} />
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-foreground whitespace-nowrap">
        {row.incentivePercent > 0 ? formatPercent(row.incentivePercent) : '-'}
        <InlineDelta value={incentiveDelta} accentClass={accentClass} />
      </td>
      <td className={cn('px-2 py-1.5 text-right tabular-nums font-bold whitespace-nowrap', isBorrow ? 'ds-text-brand-cyan' : 'ds-text-emerald-600')}>
        {formatPercent(row.totalPercent)}
        <InlineDelta value={totalDelta} accentClass={accentClass} />
      </td>
      <td className={cn('px-2.5 py-1.5 text-right tabular-nums font-semibold whitespace-nowrap', dayColor)}>
        {formatUsdDay(row.usdPerDay)}
        <InlineDelta value={usdPerDayDelta} accentClass={accentClass} />
      </td>
    </tr>
  );
});

export default PortfolioResultsTable;
