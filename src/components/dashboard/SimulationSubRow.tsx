import { AlertTriangle, ExternalLink } from 'lucide-react';
import { formatPercent, formatSpread, formatReserveSizeUsd } from '@/lib/formatters';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import type { RateSimulationResult } from '@/hooks/useRateSimulation';
import type { ReserveWithSpread, MeritIncentive, MerklOpportunityGroup, BrevisIncentive } from '@/types/aave';

const getFirstMeritLink = (merits?: MeritIncentive[]): string | null => {
  if (!merits || !Array.isArray(merits)) return null;
  const now = Date.now();
  for (const merit of merits) {
    const start = Date.parse(merit.startDate);
    const end = Date.parse(merit.endDate);
    if (!Number.isNaN(start) && !Number.isNaN(end) && now >= start && now <= end && merit.link) {
      return merit.link;
    }
  }
  return null;
};

const getFirstMerklLink = (opportunities?: MerklOpportunityGroup[]): string | null => {
  if (!opportunities || !Array.isArray(opportunities)) return null;
  const now = Date.now();
  for (const opp of opportunities) {
    const link = opp.link || opp.opportunityLink;
    if (!link) continue;
    const hasActive = opp.breakdowns?.some((bd) => {
      const start = Date.parse(bd.campaignStartedAt);
      const end = Date.parse(bd.campaignEndedAt);
      return !Number.isNaN(start) && !Number.isNaN(end) && now >= start && now <= end;
    });
    if (hasActive) return link;
  }
  return null;
};

const getFirstBrevisLink = (brevis?: BrevisIncentive[]): string | null => {
  if (!brevis || !Array.isArray(brevis)) return null;
  const now = Date.now();
  for (const b of brevis) {
    const start = Date.parse(b.startDate);
    const end = Date.parse(b.endDate);
    if (!Number.isNaN(start) && !Number.isNaN(end) && now >= start && now <= end && b.link) {
      return b.link;
    }
  }
  return null;
};

interface SimulationSubRowProps {
  reserve: ReserveWithSpread;
  simulation: RateSimulationResult;
  isApy: boolean;
  supplyInput: string;
  borrowInput: string;
  inputMode?: 'usd' | 'token';
  compact?: boolean;
  onCorrectSupplyInput?: (correctedValue: string) => void;
  onCorrectBorrowInput?: (correctedValue: string) => void;
}

const formatDelta = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
};

const formatUsdDelta = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatReserveSizeUsd(value)}`;
};

const hasMeaningfulValue = (value: number | null) =>
  value !== null && Number.isFinite(value) && Math.abs(value) >= 0.005;

type RowType = 'usd' | 'rate' | 'spread';

interface TableRow {
  label: string;
  current: number | null;
  after: number | null;
  delta: number | null;
  type: RowType;
  cap?: number | null;
  href?: string | null;
  isBreakdown?: boolean;
  warning?: boolean;
}

const SimulationSubRow = ({
  reserve,
  simulation,
  isApy,
  inputMode = 'usd',
  compact = false,
  onCorrectSupplyInput,
  onCorrectBorrowInput,
}: SimulationSubRowProps) => {
  const rateLabel = isApy ? 'APY' : 'APR';
  const showPriceMissingNotice =
    inputMode === 'token' &&
    (simulation.supply.hasInput || simulation.borrow.hasInput) &&
    !simulation.tokenPrice &&
    !simulation.tokenPriceLoading;
  const showEmptyStateNote = !simulation.supply.hasInput && !simulation.borrow.hasInput;

  const aaveUrl = buildAaveReserveUrl({ marketName: reserve.marketName, tokenAddress: reserve.tokenAddress });

  const { supplyCapExceeded, availableSupplyRoomUsd, supplyCapExceededByUsd, supplyCapUsd } = simulation.marketMetrics;

  const handleCorrectToMaxSupply = () => {
    if (!onCorrectSupplyInput || availableSupplyRoomUsd === null) return;
    if (inputMode === 'usd') {
      const corrected = Math.max(0, Math.floor(availableSupplyRoomUsd));
      onCorrectSupplyInput(corrected.toLocaleString('en-US'));
    } else if (simulation.tokenPrice && simulation.tokenPrice > 0) {
      const correctedTokens = Math.max(0, availableSupplyRoomUsd / simulation.tokenPrice);
      const formatted = correctedTokens >= 1
        ? correctedTokens.toLocaleString('en-US', { maximumFractionDigits: 2 })
        : correctedTokens.toPrecision(4);
      onCorrectSupplyInput(formatted);
    }
  };

  const { borrowCapExceeded, availableBorrowRoomUsd, borrowCapExceededByUsd, borrowCapUsd, borrowLimitedByLiquidity } = simulation.marketMetrics;

  const handleCorrectToMaxBorrow = () => {
    if (!onCorrectBorrowInput || availableBorrowRoomUsd === null) return;
    if (inputMode === 'usd') {
      const corrected = Math.max(0, Math.floor(availableBorrowRoomUsd));
      onCorrectBorrowInput(corrected.toLocaleString('en-US'));
    } else if (simulation.tokenPrice && simulation.tokenPrice > 0) {
      const correctedTokens = Math.max(0, availableBorrowRoomUsd / simulation.tokenPrice);
      const formatted = correctedTokens >= 1
        ? correctedTokens.toLocaleString('en-US', { maximumFractionDigits: 2 })
        : correctedTokens.toPrecision(4);
      onCorrectBorrowInput(formatted);
    }
  };

  const currentSupplySizeUsd =
    reserve.reserveSizeUsd != null && Number.isFinite(reserve.reserveSizeUsd) ? reserve.reserveSizeUsd : null;
  const afterSupplySizeUsd =
    currentSupplySizeUsd !== null && simulation.supply.inputUsd > 0
      ? currentSupplySizeUsd + simulation.supply.inputUsd
      : null;

  const supplyMeritLink = getFirstMeritLink(reserve.meritSupplys);
  const supplyMerklLink = getFirstMerklLink(reserve.merklSupplys);
  const supplyBrevisLink = getFirstBrevisLink(reserve.brevisSupplys);

  const borrowMeritLink = getFirstMeritLink(reserve.meritBorrows);
  const borrowMerklLink = getFirstMerklLink(reserve.merklBorrows);
  const borrowBrevisLink = getFirstBrevisLink(reserve.brevisBorrows);

  const supplyIncentiveSources = [
    { label: 'Protocol Incentive', ...simulation.supply.sources.protocol, href: aaveUrl },
    { label: 'ACI Incentive', ...simulation.supply.sources.merit, href: supplyMeritLink },
    { label: 'Merkl Incentive', ...simulation.supply.sources.merkl, href: supplyMerklLink },
    { label: 'Brevis Incentive', ...simulation.supply.sources.brevis, href: supplyBrevisLink },
  ].filter((src) => hasMeaningfulValue(src.current) || hasMeaningfulValue(src.after));

  const borrowIncentiveSources = [
    { label: 'Protocol Incentive', ...simulation.borrow.sources.protocol, href: aaveUrl },
    { label: 'ACI Incentive', ...simulation.borrow.sources.merit, href: borrowMeritLink },
    { label: 'Merkl Incentive', ...simulation.borrow.sources.merkl, href: borrowMerklLink },
    { label: 'Brevis Incentive', ...simulation.borrow.sources.brevis, href: borrowBrevisLink },
  ].filter((src) => hasMeaningfulValue(src.current) || hasMeaningfulValue(src.after));

  const supplyRows: TableRow[] = [
    {
      label: 'Total Supplied',
      current: currentSupplySizeUsd,
      after: afterSupplySizeUsd,
      delta: afterSupplySizeUsd !== null && currentSupplySizeUsd !== null ? afterSupplySizeUsd - currentSupplySizeUsd : null,
      type: 'usd',
      cap: supplyCapUsd,
      warning: supplyCapExceeded,
    },
    {
      label: rateLabel,
      current: simulation.supply.currentTotal,
      after: simulation.supply.afterTotal,
      delta: simulation.supply.deltaTotal,
      type: 'rate',
    },
    {
      label: 'Native',
      current: simulation.supply.currentNative,
      after: simulation.supply.afterNative,
      delta: simulation.supply.deltaNative,
      type: 'rate',
      href: aaveUrl,
      isBreakdown: true,
    },
    ...supplyIncentiveSources.map((src) => ({
      label: src.label,
      current: src.current,
      after: src.after,
      delta: src.delta,
      type: 'rate' as RowType,
      href: src.href,
      isBreakdown: true,
    })),
  ];

  const borrowRows: TableRow[] = [
    {
      label: 'Total Borrowed',
      current: simulation.marketMetrics.totalBorrowedUsd,
      after: simulation.marketMetrics.totalBorrowedUsdAfter,
      delta: simulation.marketMetrics.totalBorrowedUsdDelta,
      type: 'usd',
      cap: borrowCapUsd,
      warning: borrowCapExceeded && !borrowLimitedByLiquidity,
    },
    {
      label: rateLabel,
      current: simulation.borrow.currentTotal,
      after: simulation.borrow.afterTotal,
      delta: simulation.borrow.deltaTotal,
      type: 'rate',
    },
    {
      label: 'Native',
      current: simulation.borrow.currentNative,
      after: simulation.borrow.afterNative,
      delta: simulation.borrow.deltaNative,
      type: 'rate',
      href: aaveUrl,
      isBreakdown: true,
    },
    ...borrowIncentiveSources.map((src) => ({
      label: src.label,
      current: src.current,
      after: src.after,
      delta: src.delta,
      type: 'rate' as RowType,
      href: src.href,
      isBreakdown: true,
    })),
  ];

  const formatValue = (value: number | null, type: RowType) => {
    if (type === 'usd') return formatReserveSizeUsd(value);
    if (type === 'spread') return formatSpread(value);
    return formatPercent(value);
  };

  const formatDeltaValue = (value: number | null, type: RowType) => {
    if (type === 'usd') return formatUsdDelta(value);
    return formatDelta(value);
  };

  const renderRow = (row: TableRow, accentClass: string) => {
    const deltaColorClass = row.delta === null || Number.isNaN(row.delta) ? 'text-muted-foreground' : accentClass;
    const isBreakdownItem = row.isBreakdown;

    return (
      <tr key={row.label} className={row.warning ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
        <td className="py-1.5 pl-4 pr-3">
          <div className={`flex items-baseline gap-1.5 ${isBreakdownItem ? 'ml-2 pl-2 border-l border-border' : ''}`}>
            {row.href ? (
              <a
                href={row.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`ds-text-12 flex items-center gap-1 hover:underline underline-offset-2 ${row.warning ? 'text-amber-700 dark:text-amber-400' : isBreakdownItem ? 'text-muted-foreground hover:text-foreground' : accentClass}`}
              >
                <span className="truncate">{row.label}</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
              </a>
            ) : (
              <span className={`ds-text-12 ${row.warning ? 'text-amber-700 dark:text-amber-400 font-medium' : isBreakdownItem ? 'text-muted-foreground' : accentClass}`}>
                {row.label}
              </span>
            )}
            {row.cap !== null && row.cap !== undefined && (
              <span className={`ds-text-11 tabular-nums flex-shrink-0 ${row.warning ? 'text-amber-600' : 'text-muted-foreground/70'}`}>
                Cap {formatReserveSizeUsd(row.cap)}
              </span>
            )}
          </div>
        </td>
        <td className="py-1.5 px-3 text-right">
          <span className={`ds-text-12 tabular-nums ${isBreakdownItem ? 'text-muted-foreground' : accentClass}`}>
            {formatValue(row.current, row.type)}
          </span>
        </td>
        <td className="py-1.5 px-3 text-right">
          <span className={`ds-text-12 tabular-nums ${row.after === null ? 'text-muted-foreground' : isBreakdownItem ? 'text-muted-foreground' : accentClass}`}>
            {formatValue(row.after, row.type)}
          </span>
        </td>
        <td className="py-1.5 pl-3 pr-4 text-right">
          <span className={`ds-text-12 tabular-nums ${isBreakdownItem ? 'text-muted-foreground' : deltaColorClass}`}>
            {formatDeltaValue(row.delta, row.type)}
          </span>
        </td>
      </tr>
    );
  };

  const renderTable = (title: string, rows: TableRow[], accentClass: string, borderClass: string) => (
    <div className={`rounded-lg border ${borderClass} bg-background/80`}>
      <table className="w-full">
        <colgroup>
          <col />
          <col className="w-[76px]" />
          <col className="w-[76px]" />
          <col className="w-[76px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border/50">
            <th className="px-4 py-2 text-left">
              <span className={`ds-text-13 font-semibold ${accentClass}`}>{title}</span>
            </th>
            <th className="px-3 py-2 text-right">
              <span className="ds-text-11 text-muted-foreground">Current</span>
            </th>
            <th className="px-3 py-2 text-right">
              <span className="ds-text-11 text-muted-foreground">After</span>
            </th>
            <th className="px-4 py-2 text-right">
              <span className="ds-text-11 text-muted-foreground">Delta</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => renderRow(row, accentClass))}
        </tbody>
      </table>
    </div>
  );

  // Middle column (Spread + Liquidity) - no title
  const renderMiddleColumn = () => (
    <div className="rounded-lg border border-purple-500/40 bg-background/80">
      <table className="w-full">
        <colgroup>
          <col />
          <col className="w-[76px]" />
          <col className="w-[76px]" />
          <col className="w-[76px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border/50">
            <th className="px-4 py-2 text-left">
              {/* Empty title cell for alignment */}
            </th>
            <th className="px-3 py-2 text-right">
              <span className="ds-text-11 text-muted-foreground">Current</span>
            </th>
            <th className="px-3 py-2 text-right">
              <span className="ds-text-11 text-muted-foreground">After</span>
            </th>
            <th className="px-4 py-2 text-right">
              <span className="ds-text-11 text-muted-foreground">Delta</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Spread first */}
          <tr>
            <td className="py-1.5 pl-4 pr-3">
              <span className="ds-text-12 ds-text-purple-600">Spread</span>
            </td>
            <td className="py-1.5 px-3 text-right">
              <span className="ds-text-12 tabular-nums ds-text-purple-600">{formatSpread(simulation.spread.current)}</span>
            </td>
            <td className="py-1.5 px-3 text-right">
              <span className={`ds-text-12 tabular-nums ${simulation.spread.after === null ? 'text-muted-foreground' : 'ds-text-purple-600'}`}>
                {formatSpread(simulation.spread.after)}
              </span>
            </td>
            <td className="py-1.5 pl-3 pr-4 text-right">
              <span className={`ds-text-12 tabular-nums ${simulation.spread.delta === null ? 'text-muted-foreground' : 'ds-text-purple-600'}`}>
                {formatDelta(simulation.spread.delta)}
              </span>
            </td>
          </tr>
          {/* Liquidity second */}
          <tr className={borrowCapExceeded && borrowLimitedByLiquidity ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
            <td className="py-1.5 pl-4 pr-3">
              <span className={`ds-text-12 ${borrowCapExceeded && borrowLimitedByLiquidity ? 'text-amber-700 dark:text-amber-400 font-medium' : 'ds-text-purple-600'}`}>
                Liquidity
              </span>
            </td>
            <td className="py-1.5 px-3 text-right">
              <span className="ds-text-12 tabular-nums ds-text-purple-600">
                {formatReserveSizeUsd(simulation.marketMetrics.availableLiquidityUsd)}
              </span>
            </td>
            <td className="py-1.5 px-3 text-right">
              <span className={`ds-text-12 tabular-nums ${simulation.marketMetrics.availableLiquidityUsdAfter === null ? 'text-muted-foreground' : 'ds-text-purple-600'}`}>
                {formatReserveSizeUsd(simulation.marketMetrics.availableLiquidityUsdAfter)}
              </span>
            </td>
            <td className="py-1.5 pl-3 pr-4 text-right">
              <span className={`ds-text-12 tabular-nums ${simulation.marketMetrics.availableLiquidityUsdDelta === null ? 'text-muted-foreground' : 'ds-text-purple-600'}`}>
                {formatUsdDelta(simulation.marketMetrics.availableLiquidityUsdDelta)}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-3">
        <span className="ds-text-14 font-semibold text-foreground">Shared {rateLabel} simulation</span>
        {showEmptyStateNote && (
          <span className="ds-text-12 text-muted-foreground">
            Enter supply or borrow amount above to see simulated values.
          </span>
        )}
      </div>

      {/* Warnings */}
      {supplyCapExceeded && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-amber-400/60 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="flex-1 ds-text-12 text-amber-800 dark:text-amber-300">
            Supply exceeds cap by {formatReserveSizeUsd(supplyCapExceededByUsd)}
          </p>
          {onCorrectSupplyInput && availableSupplyRoomUsd !== null && availableSupplyRoomUsd > 0 && (
            <button type="button" onClick={handleCorrectToMaxSupply} className="ds-btn-warning ds-text-11 px-3 py-1">
              Adjust to max
            </button>
          )}
        </div>
      )}

      {borrowCapExceeded && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-amber-400/60 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="flex-1 ds-text-12 text-amber-800 dark:text-amber-300">
            Borrow exceeds {borrowLimitedByLiquidity ? 'liquidity' : 'cap'} by {formatReserveSizeUsd(borrowCapExceededByUsd)}
          </p>
          {onCorrectBorrowInput && availableBorrowRoomUsd !== null && availableBorrowRoomUsd > 0 && (
            <button type="button" onClick={handleCorrectToMaxBorrow} className="ds-btn-warning ds-text-11 px-3 py-1">
              Adjust to max
            </button>
          )}
        </div>
      )}

      {/* 3-column layout: Supply | (Spread/Liquidity) | Borrow */}
      <div className={`grid ${compact ? 'grid-cols-1 gap-3' : 'grid-cols-3 gap-2'}`}>
        {renderTable('Supply', supplyRows, 'ds-text-emerald-600', 'border-emerald-500/40')}
        {renderMiddleColumn()}
        {renderTable('Borrow', borrowRows, 'ds-text-brand-cyan', 'border-[rgb(var(--ds-brand-cyan-rgb))]/40')}
      </div>

      {/* Footer notes */}
      {(simulation.reserveRateInputLoading || simulation.reserveRateInputError || simulation.forecastLoading || showPriceMissingNotice || simulation.forecastUnavailableCampaignCount > 0) && (
        <div className="mt-3 space-y-1 px-1">
          {simulation.reserveRateInputLoading && !showEmptyStateNote && (
            <p className="ds-text-11 text-muted-foreground">Loading rate inputs...</p>
          )}
          {simulation.reserveRateInputError && !showEmptyStateNote && (
            <p className="ds-text-11 text-amber-600">
              Native simulation unavailable: {simulation.reserveRateInputError instanceof Error ? simulation.reserveRateInputError.message : 'failed to fetch'}
            </p>
          )}
          {!showEmptyStateNote && !simulation.hasRateInput && !simulation.reserveRateInputLoading && !simulation.reserveRateInputError && (
            <p className="ds-text-11 text-muted-foreground">Native simulation unavailable for this reserve.</p>
          )}
          {simulation.forecastLoading && <p className="ds-text-11 text-muted-foreground">Loading Merkl forecast...</p>}
          {showPriceMissingNotice && (
            <p className="ds-text-11 text-muted-foreground">Price unavailable for {reserve.tokenSymbol}; using current supply for forecast.</p>
          )}
          {!simulation.forecastLoading && simulation.forecastUnavailableCampaignCount > 0 && (
            <p className="ds-text-11 text-muted-foreground">Some Merkl campaigns have no forecast; using current APR.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SimulationSubRow;
