import { formatPercent, formatSpread } from '@/lib/formatters';
import { formatNumberInput } from '@/lib/numberFormat';
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
}

const formatDelta = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
};

const deltaClass = (value: number | null, positiveClass: string) => {
  if (value === null || Number.isNaN(value) || value === 0) return 'text-muted-foreground';
  return value > 0 ? positiveClass : 'text-rose-600';
};

const formatMetricValue = (value: number | null, kind: 'rate' | 'spread' = 'rate') =>
  kind === 'spread' ? formatSpread(value) : formatPercent(value);

const hasMeaningfulValue = (value: number | null) =>
  value !== null && Number.isFinite(value) && Math.abs(value) >= 0.005;

const formatScenarioAmount = (value: string) => {
  const normalized = formatNumberInput(value);
  return normalized.trim().length > 0 ? normalized : '—';
};

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
      <span className="ds-text-11 tabular-nums text-right text-muted-foreground">{formatPercent(current)}</span>
      <span className={`ds-text-11 tabular-nums text-right ${after === null ? 'text-muted-foreground' : 'text-foreground'}`}>
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
  compact = false,
}: SimulationSubRowProps) => {
  const rateLabel = isApy ? 'APY' : 'APR';
  const showPriceMissingNotice =
    (simulation.supply.hasInput || simulation.borrow.hasInput) && !simulation.tokenPrice && !simulation.tokenPriceLoading;
  const showEmptyStateNote = !simulation.supply.hasInput && !simulation.borrow.hasInput;

  const aaveUrl = buildAaveReserveUrl({ marketName: reserve.marketName, tokenAddress: reserve.tokenAddress });

  const supplyRows = [
    {
      label: 'Native',
      current: simulation.supply.currentNative,
      after: simulation.supply.afterNative,
      delta: simulation.supply.deltaNative,
      accentClass: 'ds-text-emerald-600',
      href: aaveUrl,
    },
    {
      label: 'Incentive total',
      current: simulation.supply.currentIncentive,
      after: simulation.supply.afterIncentive,
      delta: simulation.supply.deltaIncentive,
      accentClass: 'ds-text-emerald-600',
    },
    {
      label: 'Protocol Incentive',
      current: simulation.supply.sources.protocol.current,
      after: simulation.supply.sources.protocol.after,
      delta: simulation.supply.sources.protocol.delta,
    },
    {
      label: 'ACI',
      current: simulation.supply.sources.merit.current,
      after: simulation.supply.sources.merit.after,
      delta: simulation.supply.sources.merit.delta,
    },
    {
      label: 'Merkl',
      current: simulation.supply.sources.merkl.current,
      after: simulation.supply.sources.merkl.after,
      delta: simulation.supply.sources.merkl.delta,
    },
    {
      label: 'Brevis',
      current: simulation.supply.sources.brevis.current,
      after: simulation.supply.sources.brevis.after,
      delta: simulation.supply.sources.brevis.delta,
    },
  ].filter((row, index) => index < 2 || hasMeaningfulValue(row.current) || hasMeaningfulValue(row.after));

  const borrowRows = [
    {
      label: 'Native',
      current: simulation.borrow.currentNative,
      after: simulation.borrow.afterNative,
      delta: simulation.borrow.deltaNative,
      accentClass: 'ds-text-brand-cyan',
      href: aaveUrl,
    },
    {
      label: 'Incentive total',
      current: simulation.borrow.currentIncentive,
      after: simulation.borrow.afterIncentive,
      delta: simulation.borrow.deltaIncentive,
      accentClass: 'ds-text-brand-cyan',
    },
    {
      label: 'Protocol Incentive',
      current: simulation.borrow.sources.protocol.current,
      after: simulation.borrow.sources.protocol.after,
      delta: simulation.borrow.sources.protocol.delta,
    },
    {
      label: 'ACI',
      current: simulation.borrow.sources.merit.current,
      after: simulation.borrow.sources.merit.after,
      delta: simulation.borrow.sources.merit.delta,
    },
    {
      label: 'Merkl',
      current: simulation.borrow.sources.merkl.current,
      after: simulation.borrow.sources.merkl.after,
      delta: simulation.borrow.sources.merkl.delta,
    },
    {
      label: 'Brevis',
      current: simulation.borrow.sources.brevis.current,
      after: simulation.borrow.sources.brevis.after,
      delta: simulation.borrow.sources.brevis.delta,
    },
  ].filter((row, index) => index < 2 || hasMeaningfulValue(row.current) || hasMeaningfulValue(row.after));

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-[var(--ds-space-3)]">
      <div className={`flex ${compact ? 'flex-col gap-[var(--ds-space-2)]' : 'items-start justify-between gap-[var(--ds-space-3)]'}`}>
        <div>
          <span className="ds-text-13 font-semibold text-foreground">Shared {rateLabel} simulation</span>
          <p className="mt-[var(--ds-space-0-5)] ds-text-11 text-muted-foreground">
            Token: {reserve.tokenSymbol}
          </p>
        </div>
        <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-2'} gap-[var(--ds-space-2)]`}>
          <div className="rounded-lg border border-border/60 bg-background/80 px-[var(--ds-space-2)] py-[var(--ds-space-1-5)]">
            <p className="ds-text-10 uppercase tracking-wide text-muted-foreground">Supply scenario</p>
            <p className="mt-[var(--ds-space-0-5)] ds-text-12 font-semibold text-foreground">{formatScenarioAmount(supplyInput)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/80 px-[var(--ds-space-2)] py-[var(--ds-space-1-5)]">
            <p className="ds-text-10 uppercase tracking-wide text-muted-foreground">Borrow scenario</p>
            <p className="mt-[var(--ds-space-0-5)] ds-text-12 font-semibold text-foreground">{formatScenarioAmount(borrowInput)}</p>
          </div>
        </div>
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
          accentClass="text-amber-600"
          compact={compact}
        />
      </div>

      <div className={`mt-[var(--ds-space-2)] grid ${compact ? 'grid-cols-1' : 'grid-cols-2'} gap-[var(--ds-space-2)]`}>
        <BreakdownCard title="Supply breakdown" rows={supplyRows} />
        <BreakdownCard title="Borrow breakdown" rows={borrowRows} />
      </div>

      <div className="mt-[var(--ds-space-2)] space-y-[var(--ds-space-1)]">
        {showEmptyStateNote && (
          <p className="ds-text-11 text-muted-foreground">
            Enter a shared supply or borrow amount above the table to populate the After and Delta columns.
          </p>
        )}
        {simulation.reserveRateInputLoading && (
          <p className="ds-text-11 text-muted-foreground">Loading rate inputs...</p>
        )}
        {simulation.reserveRateInputError && (
          <p className="ds-text-11 text-amber-600">
            Native simulation unavailable:{' '}
            {simulation.reserveRateInputError instanceof Error
              ? simulation.reserveRateInputError.message
              : 'failed to fetch rate inputs'}
          </p>
        )}
        {!simulation.hasRateInput && !simulation.reserveRateInputLoading && !simulation.reserveRateInputError && (
          <p className="ds-text-11 text-muted-foreground">Native simulation unavailable for this reserve.</p>
        )}
        {simulation.forecastLoading && (
          <p className="ds-text-11 text-muted-foreground">Loading Merkl forecast state...</p>
        )}
        {showPriceMissingNotice && (
          <p className="ds-text-11 text-muted-foreground">
            Price unavailable for {reserve.tokenSymbol}; incentive forecast falls back to current TVL.
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
