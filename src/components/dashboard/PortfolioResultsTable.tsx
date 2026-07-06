import { memo } from 'react';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/formatters';
import { getChainIconSrc } from '@/lib/chainIcons';
import { TokenIcon } from '@/components/primitives/TokenIcon';
import type { PortfolioPositionResult, PortfolioReserveEntry } from '@/types/portfolio';

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
  if (value < 0) return `-$${Math.abs(value).toFixed(2)}`;
  if (value > 0) return `+$${value.toFixed(2)}`;
  return '$0.00';
}

const formatDeltaPercent = (value: number | null | undefined): string | null => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (Math.abs(value) < 0.005) return null;
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
};

const BAND_BORDER = 'border-y border-border/40';

const DeltaCell = memo(function DeltaCell({
  value,
  accentClass,
  bandClass,
  isLast,
}: {
  value: string | null;
  accentClass?: string;
  bandClass?: string;
  isLast?: boolean;
}) {
  return (
    <td
      className={cn(
        'px-1.5 py-1.5 text-right tabular-nums ds-text-10 whitespace-nowrap',
        bandClass,
        BAND_BORDER,
        isLast && 'border-r border-border/40',
        value ? (accentClass ?? 'text-foreground/70') : 'text-gray-300 dark:text-muted-foreground/40',
      )}
    >
      {value ?? '—'}
    </td>
  );
});

const COL_COUNT = 9;

const PortfolioResultsTable = memo(function PortfolioResultsTable({
  entries,
  results,
}: PortfolioResultsTableProps) {
  if (results.length === 0) return null;

  const entryMap = new Map(entries.map(e => [e.reserveId, e]));
  const rows: ResultRowData[] = results.map((r) => {
    const entry = entryMap.get(r.reserveId);
    return { ...r, tokenSymbol: entry?.tokenSymbol ?? '?', chainName: entry?.chainName ?? '', chainId: entry?.chainId ?? -1, marketName: entry?.marketName ?? '' };
  });

  const supplyRows = rows.filter((r) => r.side === 'supply');
  const borrowRows = rows.filter((r) => r.side === 'borrow');

  const hasForecastUnavailable = rows.some((r) => (r.forecastUnavailableCampaignCount ?? 0) > 0);

  return (
    <div className="rounded-lg border border-border/50 overflow-x-auto">
      <table className="w-full ds-text-11" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col className="w-[17%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
          <col className="w-[7%]" />
          <col className="w-[11%]" />
          <col className="w-[7%]" />
          <col className="w-[11%]" />
          <col className="w-[7%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead>
          <tr className="bg-muted/40 text-muted-foreground">
            <th className="px-2.5 py-1.5 text-left font-semibold">Token</th>
            <th className="px-2 py-1.5 text-right font-semibold">Amount</th>
            <th className="px-2 py-1.5 text-right font-semibold border-l border-t border-border/40">Native</th>
            <th className="px-1.5 py-1.5 text-right font-normal ds-text-10 text-muted-foreground/70 border-t border-border/40">Δ</th>
            <th className="px-2 py-1.5 text-right font-semibold border-t border-border/40">Incentive</th>
            <th className="px-1.5 py-1.5 text-right font-normal ds-text-10 text-muted-foreground/70 border-t border-border/40">Δ</th>
            <th className="px-2 py-1.5 text-right font-semibold border-t border-border/40">Total</th>
            <th className="px-1.5 py-1.5 text-right font-normal ds-text-10 text-muted-foreground/70 border-t border-r border-border/40">Δ</th>
            <th className="px-2 py-1.5 text-right font-semibold">USD/day</th>
          </tr>
        </thead>
        <tbody>
          {supplyRows.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={COL_COUNT}
                  className="px-2.5 pt-2 pb-0.5 ds-text-10 font-semibold uppercase tracking-wide ds-text-emerald-600 border-l-2 border-emerald-500/60"
                >
                  Supply
                </td>
              </tr>
              {supplyRows.map((r, i) => (
                <ResultRow key={`${r.reserveId}-supply-${i}`} row={r} />
              ))}
            </>
          )}
          {borrowRows.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={COL_COUNT}
                  className="px-2.5 pt-2 pb-0.5 ds-text-10 font-semibold uppercase tracking-wide ds-text-brand-cyan border-l-2 border-cyan-500/60"
                >
                  Borrow
                </td>
              </tr>
              {borrowRows.map((r, i) => (
                <ResultRow key={`${r.reserveId}-borrow-${i}`} row={r} />
              ))}
            </>
          )}
        </tbody>
      </table>
      {hasForecastUnavailable && (
        <p className="ds-text-10 text-muted-foreground px-2.5 py-1.5 border-t border-border/30">
          * No forecast data — using current APR.
        </p>
      )}
    </div>
  );
});

interface ResultRowData extends PortfolioPositionResult {
  tokenSymbol: string;
  chainName: string;
  chainId: number;
  marketName: string;
}

const SUPPLY_ACCENT = 'ds-text-emerald-600';
const BORROW_ACCENT = 'ds-text-brand-cyan';
const SUPPLY_BAND = 'bg-emerald-500/8 dark:bg-emerald-500/10 group-hover:bg-emerald-500/15';
const BORROW_BAND = 'bg-cyan-500/8 dark:bg-cyan-500/10 group-hover:bg-cyan-500/15';

const ResultRow = memo(function ResultRow({
  row,
}: {
  row: ResultRowData;
}) {
  const accentClass = row.side === 'supply' ? SUPPLY_ACCENT : BORROW_ACCENT;
  const bandClass = row.side === 'supply' ? SUPPLY_BAND : BORROW_BAND;
  const nativeDelta = formatDeltaPercent(row.nativeMetric?.delta ?? null);
  const incentiveDelta = formatDeltaPercent(row.incentiveMetric?.delta ?? null);
  const totalDelta = formatDeltaPercent(row.totalMetric?.delta ?? null);

  return (
    <tr className="group border-t border-border/30 transition-colors hover:bg-muted/10">
      <td className="px-2.5 py-1.5">
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <TokenIcon symbol={row.tokenSymbol} size={16} />
            {row.chainId > 0 && getChainIconSrc(row.chainId) && (
              <img
                src={getChainIconSrc(row.chainId)}
                alt=""
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
              />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className={cn('font-semibold truncate', accentClass)}>{row.tokenSymbol}</span>
            <span className="ds-text-10 text-muted-foreground truncate">{row.chainName}</span>
          </div>
        </div>
      </td>
      <td className={cn('px-2 py-1.5 text-right tabular-nums font-medium', accentClass)}>
        {formatUsdCompact(row.amountUsd)}
      </td>
      <td className={cn('px-2 py-1.5 text-right tabular-nums whitespace-nowrap border-l border-border/40', BAND_BORDER, bandClass, accentClass)}>
        {formatPercent(row.nativePercent)}
      </td>
      <DeltaCell value={nativeDelta} accentClass={accentClass} bandClass={bandClass} />
      <td className={cn('px-2 py-1.5 text-right tabular-nums whitespace-nowrap', BAND_BORDER, bandClass, accentClass)}>
        {formatPercent(row.incentivePercent)}
        {row.forecastUnavailableCampaignCount != null && row.forecastUnavailableCampaignCount > 0 && (
          <span className="ds-text-9 text-muted-foreground ml-0.5" title="No forecast data — using current APR">*</span>
        )}
      </td>
      <DeltaCell value={incentiveDelta} accentClass={accentClass} bandClass={bandClass} />
      <td className={cn('px-2 py-1.5 text-right tabular-nums font-bold whitespace-nowrap', BAND_BORDER, bandClass, accentClass)}>
        {formatPercent(row.totalPercent)}
      </td>
      <DeltaCell value={totalDelta} accentClass={accentClass} bandClass={bandClass} isLast />
      <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-foreground whitespace-nowrap">
        {formatUsdDay(row.usdPerDay)}
      </td>
    </tr>
  );
});

export default PortfolioResultsTable;
