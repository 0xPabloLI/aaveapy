import { AlertTriangle } from 'lucide-react';
import { formatPercent, formatSpread, formatReserveSizeUsd } from '@/lib/formatters';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import type { RateSimulationResult } from '@/hooks/useRateSimulation';
import type { ReserveWithSpread } from '@/types/aave';

const SOURCE_LINKS: Record<string, string> = {
  ACI: 'https://apps.aavechan.com/',
  Merkl: 'https://app.merkl.xyz/',
  Brevis: 'https://incentra.brevis.network/',
  'Protocol Incentive': 'https://app.aave.com/',
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

const deltaClass = (value: number | null, accentClass: string) => {
  if (value === null || Number.isNaN(value)) return 'text-muted-foreground';
  return accentClass;
};

const formatMetricValue = (value: number | null, kind: 'rate' | 'spread' = 'rate') =>
  kind === 'spread' ? formatSpread(value) : formatPercent(value);

const hasMeaningfulValue = (value: number | null) =>
  value !== null && Number.isFinite(value) && Math.abs(value) >= 0.005;

const MarketMetricCard = ({
  title,
  current,
  after,
  delta,
  accentClass,
  compact = false,
}: {
  title: string;
  current: number | null;
  after: number | null;
  delta: number | null;
  accentClass: string;
  compact?: boolean;
}) => (
  <div className="rounded-lg border border-border/60 bg-background/80 px-[var(--ds-space-3)] py-[var(--ds-space-2)]">
    <div className={`flex ${compact ? 'flex-col gap-[var(--ds-space-1)]' : 'items-end justify-between'}`}>
      <span className="ds-text-11 uppercase tracking-wide text-muted-foreground">{title}</span>
      <span className={`ds-text-11 font-semibold tabular-nums ${deltaClass(delta, accentClass)}`}>
        {formatUsdDelta(delta)}
      </span>
    </div>
    <div className={`mt-[var(--ds-space-1)] grid ${compact ? 'grid-cols-1 gap-[var(--ds-space-1)]' : 'grid-cols-2 gap-[var(--ds-space-2)]'}`}>
      <div>
        <p className="ds-text-10 text-muted-foreground">Current</p>
        <p className={`ds-text-14 font-bold tabular-nums ${accentClass}`}>{formatReserveSizeUsd(current)}</p>
      </div>
      <div>
        <p className="ds-text-10 text-muted-foreground">After</p>
        <p className={`ds-text-14 font-bold tabular-nums ${after === null ? 'text-muted-foreground' : accentClass}`}>
          {after === null ? '—' : formatReserveSizeUsd(after)}
        </p>
      </div>
    </div>
  </div>
);

const StaticMetricCard = ({
  title,
  value,
  unit = '',
  accentClass = 'text-foreground',
  warning = false,
  subtitle,
}: {
  title: string;
  value: number | null;
  unit?: string;
  accentClass?: string;
  warning?: boolean;
  subtitle?: string;
}) => (
  <div className={`rounded-lg border px-[var(--ds-space-3)] py-[var(--ds-space-2)] ${
    warning 
      ? 'border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20' 
      : 'border-border/60 bg-background/80'
  }`}>
    <p className={`ds-text-10 uppercase tracking-wide ${warning ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
      {title}
    </p>
    <p className={`mt-[var(--ds-space-0-5)] ds-text-14 font-bold tabular-nums ${warning ? 'text-amber-700 dark:text-amber-400' : accentClass}`}>
      {value !== null ? (unit === '$' ? formatReserveSizeUsd(value) : `${value.toFixed(2)}%`) : '—'}
    </p>
    {subtitle && (
      <p className={`ds-text-10 ${warning ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}`}>
        {subtitle}
      </p>
    )}
  </div>
);

const ValueCard = ({
  title,
  current,
  after,
  delta,
  accentClass,
  compact = false,
  kind = 'rate',
}: {
  title: string;
  current: number | null;
  after: number | null;
  delta: number | null;
  accentClass: string;
  compact?: boolean;
  kind?: 'rate' | 'spread';
}) => (
  <div className="rounded-lg border border-border/60 bg-background/80 px-[var(--ds-space-3)] py-[var(--ds-space-2)]">
    <div className={`flex ${compact ? 'flex-col gap-[var(--ds-space-1)]' : 'items-end justify-between'}`}>
      <span className="ds-text-11 uppercase tracking-wide text-muted-foreground">{title}</span>
      <span className={`ds-text-11 font-semibold ${deltaClass(delta, accentClass)}`}>{formatDelta(delta)}</span>
    </div>
    <div className={`mt-[var(--ds-space-1)] grid ${compact ? 'grid-cols-1 gap-[var(--ds-space-1)]' : 'grid-cols-2 gap-[var(--ds-space-2)]'}`}>
      <div>
        <p className="ds-text-10 text-muted-foreground">Current</p>
        <p className={`ds-text-14 font-bold ${accentClass}`}>{formatMetricValue(current, kind)}</p>
      </div>
      <div>
        <p className="ds-text-10 text-muted-foreground">After</p>
        <p className={`ds-text-14 font-bold ${after === null ? 'text-muted-foreground' : accentClass}`}>
          {formatMetricValue(after, kind)}
        </p>
      </div>
    </div>
  </div>
);

const BreakdownRow = ({
  label,
  current,
  after,
  delta,
  accentClass,
  href,
}: {
  label: string;
  current: number | null;
  after: number | null;
  delta: number | null;
  accentClass?: string;
  href?: string | null;
}) => {
  const link = href ?? SOURCE_LINKS[label];
  return (
    <div className="grid grid-cols-[1fr_5rem_5rem_5rem] items-center gap-[var(--ds-space-1)] py-[var(--ds-space-1)]">
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`ds-text-11 truncate hover:underline underline-offset-2 transition-colors ${accentClass ?? 'text-muted-foreground'} hover:opacity-80`}
          title={`Open ${label}`}
        >
          {label}
        </a>
      ) : (
        <span className={`ds-text-11 truncate ${accentClass ?? 'text-muted-foreground'}`}>{label}</span>
      )}
      <span className={`ds-text-11 tabular-nums text-right ${accentClass ?? 'text-muted-foreground'}`}>{formatPercent(current)}</span>
      <span className={`ds-text-11 tabular-nums text-right ${after === null ? 'text-muted-foreground' : (accentClass ?? 'text-foreground')}`}>
        {formatPercent(after)}
      </span>
      <span className={`ds-text-11 tabular-nums text-right ${deltaClass(delta, accentClass ?? 'text-foreground')}`}>{formatDelta(delta)}</span>
    </div>
  );
};

const BreakdownCard = ({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    label: string;
    current: number | null;
    after: number | null;
    delta: number | null;
    accentClass?: string;
    href?: string | null;
  }>;
}) => (
  <div className="rounded-lg border border-border/60 bg-background/80 px-[var(--ds-space-3)] py-[var(--ds-space-2)]">
    <div className="grid grid-cols-[1fr_5rem_5rem_5rem] items-center gap-[var(--ds-space-1)] border-b border-border/60 pb-[var(--ds-space-1)]">
      <span className="ds-text-11 font-semibold uppercase tracking-wide text-foreground">{title}</span>
      <span className="ds-text-10 text-right text-muted-foreground">Current</span>
      <span className="ds-text-10 text-right text-muted-foreground">After</span>
      <span className="ds-text-10 text-right text-muted-foreground">Delta</span>
    </div>
    <div className="divide-y divide-border/40">
      {rows.map((row) => (
        <BreakdownRow key={row.label} {...row} />
      ))}
    </div>
  </div>
);

const SimulationSubRow = ({
  reserve,
  simulation,
  isApy,
  supplyInput,
  borrowInput,
  inputMode = 'usd',
  compact = false,
  onCorrectSupplyInput,
}: SimulationSubRowProps) => {
  const rateLabel = isApy ? 'APY' : 'APR';
  const showPriceMissingNotice =
    inputMode === 'token' &&
    (simulation.supply.hasInput || simulation.borrow.hasInput) &&
    !simulation.tokenPrice &&
    !simulation.tokenPriceLoading;
  const showEmptyStateNote = !simulation.supply.hasInput && !simulation.borrow.hasInput;

  const aaveUrl = buildAaveReserveUrl({ marketName: reserve.marketName, tokenAddress: reserve.tokenAddress });

  const { supplyCapExceeded, availableSupplyRoomUsd, supplyCapExceededByUsd } = simulation.marketMetrics;

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

  const { supplyCapUsd } = simulation.marketMetrics;
  const currentSupplySizeUsd =
    reserve.reserveSizeUsd != null && Number.isFinite(reserve.reserveSizeUsd) ? reserve.reserveSizeUsd : null;
  
  // Cap the after size at supply cap when input exceeds available room
  const rawAfterSupplySizeUsd =
    currentSupplySizeUsd !== null && simulation.supply.inputUsd > 0
      ? currentSupplySizeUsd + simulation.supply.inputUsd
      : null;
  const afterSupplySizeUsd =
    rawAfterSupplySizeUsd !== null && supplyCapUsd !== null && supplyCapUsd > 0
      ? Math.min(rawAfterSupplySizeUsd, supplyCapUsd)
      : rawAfterSupplySizeUsd;
  
  // Calculate capped supply input for liquidity calculation
  const cappedSupplyInputUsd =
    supplyCapExceeded && availableSupplyRoomUsd !== null
      ? availableSupplyRoomUsd
      : simulation.supply.inputUsd;
  
  // Recalculate liquidity with capped input
  const cappedLiquidityAfter =
    simulation.marketMetrics.availableLiquidityUsd !== null && simulation.supply.hasInput
      ? simulation.marketMetrics.availableLiquidityUsd + cappedSupplyInputUsd - simulation.borrow.inputUsd
      : simulation.marketMetrics.availableLiquidityUsdAfter;
  const cappedLiquidityDelta =
    cappedLiquidityAfter !== null && simulation.marketMetrics.availableLiquidityUsd !== null
      ? cappedLiquidityAfter - simulation.marketMetrics.availableLiquidityUsd
      : null;

  // Build supply incentive sources list
  const supplyIncentiveSources = [
    { label: 'Protocol Incentive', ...simulation.supply.sources.protocol },
    { label: 'ACI Incentive', ...simulation.supply.sources.merit },
    { label: 'Merkl Incentive', ...simulation.supply.sources.merkl },
    { label: 'Brevis Incentive', ...simulation.supply.sources.brevis },
  ].filter((src) => hasMeaningfulValue(src.current) || hasMeaningfulValue(src.after));

  // If only one incentive source, show it directly instead of "Incentive total"
  const supplyIncentiveRow = supplyIncentiveSources.length === 1
    ? { ...supplyIncentiveSources[0], accentClass: 'ds-text-emerald-600' }
    : {
        label: 'Incentive total',
        current: simulation.supply.currentIncentive,
        after: simulation.supply.afterIncentive,
        delta: simulation.supply.deltaIncentive,
        accentClass: 'ds-text-emerald-600',
      };

  const supplyRows = [
    {
      label: 'Native',
      current: simulation.supply.currentNative,
      after: simulation.supply.afterNative,
      delta: simulation.supply.deltaNative,
      accentClass: 'ds-text-emerald-600',
      href: aaveUrl,
    },
    // Only show incentive row if there's meaningful incentive data
    ...(hasMeaningfulValue(simulation.supply.currentIncentive) || hasMeaningfulValue(simulation.supply.afterIncentive)
      ? [supplyIncentiveRow]
      : []),
    // Show individual sources only if showing "Incentive total" (multiple sources)
    ...(supplyIncentiveSources.length > 1 ? supplyIncentiveSources : []),
  ];

  // Build borrow incentive sources list
  const borrowIncentiveSources = [
    { label: 'Protocol Incentive', ...simulation.borrow.sources.protocol },
    { label: 'ACI Incentive', ...simulation.borrow.sources.merit },
    { label: 'Merkl Incentive', ...simulation.borrow.sources.merkl },
    { label: 'Brevis Incentive', ...simulation.borrow.sources.brevis },
  ].filter((src) => hasMeaningfulValue(src.current) || hasMeaningfulValue(src.after));

  // If only one incentive source, show it directly instead of "Incentive total"
  const borrowIncentiveRow = borrowIncentiveSources.length === 1
    ? { ...borrowIncentiveSources[0], accentClass: 'ds-text-brand-cyan' }
    : {
        label: 'Incentive total',
        current: simulation.borrow.currentIncentive,
        after: simulation.borrow.afterIncentive,
        delta: simulation.borrow.deltaIncentive,
        accentClass: 'ds-text-brand-cyan',
      };

  const borrowRows = [
    {
      label: 'Native',
      current: simulation.borrow.currentNative,
      after: simulation.borrow.afterNative,
      delta: simulation.borrow.deltaNative,
      accentClass: 'ds-text-brand-cyan',
      href: aaveUrl,
    },
    // Only show incentive row if there's meaningful incentive data
    ...(hasMeaningfulValue(simulation.borrow.currentIncentive) || hasMeaningfulValue(simulation.borrow.afterIncentive)
      ? [borrowIncentiveRow]
      : []),
    // Show individual sources only if showing "Incentive total" (multiple sources)
    ...(borrowIncentiveSources.length > 1 ? borrowIncentiveSources : []),
  ];

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-[var(--ds-space-3)]">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="ds-text-13 font-semibold text-foreground">Shared {rateLabel} simulation</span>
        {showEmptyStateNote && (
          <span className="ds-text-11 text-muted-foreground">
            Enter a shared supply or borrow amount above the table to populate the After and Delta columns.
          </span>
        )}
      </div>

      {/* Supply Cap Exceeded Warning */}
      {supplyCapExceeded && (
        <div className="mt-[var(--ds-space-2)] flex items-center gap-[var(--ds-space-2)] rounded-lg border border-amber-400/60 bg-amber-50/80 dark:bg-amber-950/30 px-[var(--ds-space-3)] py-[var(--ds-space-2)]">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="ds-text-12 font-medium text-amber-800 dark:text-amber-300">
              Input exceeds available room by {formatReserveSizeUsd(supplyCapExceededByUsd)}
            </p>
            <p className="ds-text-11 text-amber-700 dark:text-amber-400">
              Max suppliable: {formatReserveSizeUsd(availableSupplyRoomUsd)}
            </p>
          </div>
          {onCorrectSupplyInput && availableSupplyRoomUsd !== null && availableSupplyRoomUsd > 0 && (
            <button
              type="button"
              onClick={handleCorrectToMaxSupply}
              className="shrink-0 px-[var(--ds-space-2)] py-[var(--ds-space-1)] rounded-md border border-amber-500/50 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 ds-text-11 font-medium hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
            >
              Adjust to max
            </button>
          )}
        </div>
      )}

      {/* Market Metrics Section */}
      <div className={`mt-[var(--ds-space-3)] grid ${compact ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'} gap-[var(--ds-space-2)]`}>
        <MarketMetricCard
          title="Supply Size"
          current={currentSupplySizeUsd}
          after={afterSupplySizeUsd}
          delta={afterSupplySizeUsd !== null && currentSupplySizeUsd !== null ? afterSupplySizeUsd - currentSupplySizeUsd : null}
          accentClass="ds-text-emerald-600"
          compact={compact}
        />
        <MarketMetricCard
          title="Liquidity"
          current={simulation.marketMetrics.availableLiquidityUsd}
          after={cappedLiquidityAfter}
          delta={cappedLiquidityDelta}
          accentClass="ds-text-purple-600"
          compact={compact}
        />
        <MarketMetricCard
          title="Total Borrowed"
          current={simulation.marketMetrics.totalBorrowedUsd}
          after={simulation.marketMetrics.totalBorrowedUsdAfter}
          delta={simulation.marketMetrics.totalBorrowedUsdDelta}
          accentClass="ds-text-brand-cyan"
          compact={compact}
        />
        <StaticMetricCard
          title="Supply Cap"
          value={simulation.marketMetrics.supplyCapUsd}
          unit="$"
          accentClass="text-muted-foreground"
          warning={supplyCapExceeded}
          subtitle={supplyCapExceeded ? `Exceeded by ${formatReserveSizeUsd(supplyCapExceededByUsd)}` : undefined}
        />
      </div>

      <div className={`mt-[var(--ds-space-3)] grid ${compact ? 'grid-cols-1' : 'grid-cols-4'} gap-[var(--ds-space-2)]`}>
        <ValueCard
          title="Supply"
          current={simulation.supply.currentTotal}
          after={simulation.supply.afterTotal}
          delta={simulation.supply.deltaTotal}
          accentClass="ds-text-emerald-600"
          compact={compact}
        />
        <ValueCard
          title="Spread"
          current={simulation.spread.current}
          after={simulation.spread.after}
          delta={simulation.spread.delta}
          accentClass="ds-text-purple-600"
          compact={compact}
          kind="spread"
        />
        <ValueCard
          title="Borrow"
          current={simulation.borrow.currentTotal}
          after={simulation.borrow.afterTotal}
          delta={simulation.borrow.deltaTotal}
          accentClass="ds-text-brand-cyan"
          compact={compact}
        />
        <ValueCard
          title="Utilization"
          current={simulation.utilization.current}
          after={simulation.utilization.after}
          delta={simulation.utilization.delta}
          accentClass="text-foreground"
          compact={compact}
        />
      </div>

      <div className={`mt-[var(--ds-space-2)] grid ${compact ? 'grid-cols-1' : 'grid-cols-2'} gap-[var(--ds-space-2)]`}>
        <BreakdownCard title="Supply breakdown" rows={supplyRows} />
        <BreakdownCard title="Borrow breakdown" rows={borrowRows} />
      </div>

      {/* Reserve Parameters */}
      {(simulation.marketMetrics.reserveFactor !== null || simulation.marketMetrics.optimalUtilization !== null) && (
        <div className={`mt-[var(--ds-space-2)] grid ${compact ? 'grid-cols-1' : 'grid-cols-4'} gap-[var(--ds-space-2)]`}>
          <StaticMetricCard
            title="Reserve Factor"
            value={simulation.marketMetrics.reserveFactor}
            accentClass="text-muted-foreground"
          />
          <StaticMetricCard
            title="Optimal Utilization"
            value={simulation.marketMetrics.optimalUtilization}
            accentClass="text-amber-600"
          />
        </div>
      )}

      <div className="mt-[var(--ds-space-2)] space-y-[var(--ds-space-1)]">
        {simulation.reserveRateInputLoading && !showEmptyStateNote && (
          <p className="ds-text-11 text-muted-foreground">Loading rate inputs...</p>
        )}
        {simulation.reserveRateInputError && !showEmptyStateNote && (
          <p className="ds-text-11 text-amber-600">
            Native simulation unavailable:{' '}
            {simulation.reserveRateInputError instanceof Error
              ? simulation.reserveRateInputError.message
              : 'failed to fetch rate inputs'}
          </p>
        )}
        {!showEmptyStateNote &&
          !simulation.hasRateInput &&
          !simulation.reserveRateInputLoading &&
          !simulation.reserveRateInputError && (
          <p className="ds-text-11 text-muted-foreground">Native simulation unavailable for this reserve.</p>
        )}
        
        {simulation.forecastLoading && (
          <p className="ds-text-11 text-muted-foreground">Loading Merkl forecast state...</p>
        )}
        {showPriceMissingNotice && (
          <p className="ds-text-11 text-muted-foreground">
            Price unavailable for {reserve.tokenSymbol}; incentive forecast falls back to current supply.
          </p>
        )}
        {!simulation.forecastLoading && simulation.forecastUnavailableCampaignCount > 0 && (
          <p className="ds-text-11 text-muted-foreground">
            Some Merkl campaigns have no forecast state; those parts keep current APR.
          </p>
        )}
      </div>
    </div>
  );
};

export default SimulationSubRow;
