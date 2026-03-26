import { useRef, useState, useEffect } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { formatPercent, formatScenarioSize, formatScenarioSizeDelta, formatSpread } from '@/lib/formatters';
import { buildAaveReserveUrl } from '@/lib/aaveLinks';
import { externalLinkTabProps } from '@/lib/externalNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import type { RateSimulationResult, SimulationCampaignDetail, SimulationSourceDetail } from '@/hooks/useRateSimulation';
import type { ReserveWithSpread, MeritIncentive, MerklOpportunityGroup, BrevisIncentive } from '@/types/aave';
import { ETHEREUM_MARKET_NAMES } from '@/types/aave';

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
  /** When true, compact layout has no top border radius so it visually attaches to the card above. */
  embeddedFromTop?: boolean;
  onCorrectSupplyInput?: (correctedValue: string) => void;
  onCorrectBorrowInput?: (correctedValue: string) => void;
}

const formatDelta = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
};

const hasMeaningfulValue = (value: number | null) =>
  value !== null && Number.isFinite(value) && Math.abs(value) >= 0.005;

type RowType = 'usd' | 'rate' | 'spread';

interface TableRow {
  rowKey: string;
  label: string;
  current: number | null;
  after: number | null;
  delta: number | null;
  type: RowType;
  cap?: number | null;
  href?: string | null;
  isBreakdown?: boolean;
  /** Nested under ACI / Merkl / Brevis aggregate when per-campaign rows exist */
  isSubBreakdown?: boolean;
  capNote?: string;
  capWarning?: boolean;
  warning?: boolean;
}

interface IncentiveSourceRow extends SimulationSourceDetail {
  label: string;
  href: string | null;
  /** When one campaign, merge into the source row so capNote shows under the main label (Brevis cap/duration). */
  mergeSingleCampaignRow?: boolean;
}

function incentiveSourceToTableRows(src: IncentiveSourceRow, sourceIndex: number, side: 'supply' | 'borrow'): TableRow[] {
  const prefix = `${side}-${sourceIndex}`;
  const main: TableRow = {
    rowKey: `${prefix}-agg`,
    label: src.label,
    current: src.current,
    after: src.after,
    delta: src.delta,
    type: 'rate',
    href: src.href,
    isBreakdown: true,
  };
  const campaigns = src.campaigns;
  if (!campaigns?.length) return [main];
  if (campaigns.length === 1 && src.mergeSingleCampaignRow) {
    const c = campaigns[0];
    return [
      {
        rowKey: `${prefix}-merged`,
        label: src.label,
        current: src.current,
        after: src.after,
        delta: src.delta,
        type: 'rate',
        href: c.href ?? src.href,
        isBreakdown: true,
        capNote: c.capNote,
        capWarning: c.capWarning,
      },
    ];
  }
  return [
    main,
    ...campaigns.map((c: SimulationCampaignDetail, ci: number) => ({
      rowKey: `${prefix}-c-${ci}-${c.id}`,
      label: c.label,
      current: c.current,
      after: c.after,
      delta: c.delta,
      type: 'rate' as RowType,
      href: c.href ?? null,
      isBreakdown: true,
      isSubBreakdown: true,
      capNote: c.capNote,
      capWarning: c.capWarning,
    })),
  ];
}

const SimulationSubRow = ({
  reserve,
  simulation,
  isApy,
  inputMode = 'usd',
  compact = false,
  embeddedFromTop = false,
  onCorrectSupplyInput,
  onCorrectBorrowInput,
}: SimulationSubRowProps) => {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [containerNarrow, setContainerNarrow] = useState(false);
  const tryExpandRef = useRef<number | null>(null);
  const tryExpandThrottleMs = 150;

  /** Minimum container width (px) for the 3-column layout.
   *  Below this we switch to compact unconditionally to avoid clipping. */
  const MIN_THREE_COL_WIDTH = 900;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const checkOverflow = () => {
      // Width-based check first (fast), then pixel-level overflow check
      if (el.clientWidth < MIN_THREE_COL_WIDTH) {
        setContainerNarrow(true);
        return;
      }
      const grid = gridRef.current;
      if (grid && grid.scrollWidth > grid.clientWidth + 1) {
        setContainerNarrow(true);
      }
    };
    const ro = new ResizeObserver(() => {
      if (containerNarrow) {
        // Container grew – try expanding back
        if (el.clientWidth >= MIN_THREE_COL_WIDTH) {
          if (tryExpandRef.current != null) window.clearTimeout(tryExpandRef.current);
          tryExpandRef.current = window.setTimeout(() => {
            tryExpandRef.current = null;
            setContainerNarrow(false);
          }, tryExpandThrottleMs);
        }
      } else {
        checkOverflow();
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (tryExpandRef.current != null) {
        window.clearTimeout(tryExpandRef.current);
        tryExpandRef.current = null;
      }
    };
  }, [containerNarrow]);

  useEffect(() => {
    if (compact || containerNarrow) return;
    const id = requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el && el.clientWidth < MIN_THREE_COL_WIDTH) {
        setContainerNarrow(true);
        return;
      }
      const grid = gridRef.current;
      if (grid && grid.scrollWidth > grid.clientWidth + 1) {
        setContainerNarrow(true);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [compact, containerNarrow]);

  const effectiveCompact = compact || containerNarrow;
  const rateLabel = isApy ? 'APY' : 'APR';
  const showPriceMissingNotice =
    inputMode === 'token' &&
    (simulation.supply.hasInput || simulation.borrow.hasInput) &&
    !simulation.tokenPrice &&
    !simulation.tokenPriceLoading;
  const showEmptyStateNote = !simulation.supply.hasInput && !simulation.borrow.hasInput;

  const aaveUrl = buildAaveReserveUrl({ marketName: reserve.marketName, tokenAddress: reserve.tokenAddress });

  const tokenOnChainLabel =
    reserve.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[reserve.marketName]
      ? `${reserve.tokenSymbol} · ${ETHEREUM_MARKET_NAMES[reserve.marketName]}`
      : `${reserve.tokenSymbol} · ${reserve.chainName}`;

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

  const incentiveLabel = (full: string, short: string) => (effectiveCompact ? short : full);
  const supplyMerklHasCampaigns = !!simulation.supply.sources.merkl.campaigns?.length;
  const supplyIncentiveSources: IncentiveSourceRow[] = [
    { label: incentiveLabel('Protocol Incentive', 'Protocol'), ...simulation.supply.sources.protocol, href: aaveUrl },
    { label: incentiveLabel('ACI Incentive', 'ACI'), ...simulation.supply.sources.merit, href: supplyMeritLink },
    // If we have per-campaign rows, the more specific campaign rows should own the link.
    { label: incentiveLabel('Merkl Incentive', 'Merkl'), ...simulation.supply.sources.merkl, href: supplyMerklHasCampaigns ? null : supplyMerklLink },
    {
      label: incentiveLabel('Brevis Incentive', 'Brevis'),
      ...simulation.supply.sources.brevis,
      href: supplyBrevisLink,
      mergeSingleCampaignRow: true,
    },
  ].filter((src) => hasMeaningfulValue(src.current) || hasMeaningfulValue(src.after));

  const borrowMerklHasCampaigns = !!simulation.borrow.sources.merkl.campaigns?.length;
  const borrowIncentiveSources: IncentiveSourceRow[] = [
    { label: incentiveLabel('Protocol Incentive', 'Protocol'), ...simulation.borrow.sources.protocol, href: aaveUrl },
    { label: incentiveLabel('ACI Incentive', 'ACI'), ...simulation.borrow.sources.merit, href: borrowMeritLink },
    { label: incentiveLabel('Merkl Incentive', 'Merkl'), ...simulation.borrow.sources.merkl, href: borrowMerklHasCampaigns ? null : borrowMerklLink },
    {
      label: incentiveLabel('Brevis Incentive', 'Brevis'),
      ...simulation.borrow.sources.brevis,
      href: borrowBrevisLink,
      mergeSingleCampaignRow: true,
    },
  ].filter((src) => hasMeaningfulValue(src.current) || hasMeaningfulValue(src.after));

  // If only Native (no incentives), put link on APY row directly; otherwise show breakdown
  const hasSupplyIncentives = supplyIncentiveSources.length > 0;
  const hasBorrowIncentives = borrowIncentiveSources.length > 0;

  const supplyRows: TableRow[] = [
    {
      rowKey: 'supply-size',
      label: effectiveCompact ? 'Total supplied' : 'Total',
      current: currentSupplySizeUsd,
      after: afterSupplySizeUsd,
      delta: afterSupplySizeUsd !== null && currentSupplySizeUsd !== null ? afterSupplySizeUsd - currentSupplySizeUsd : null,
      type: 'usd',
      cap: supplyCapUsd,
      warning: supplyCapExceeded,
    },
    {
      rowKey: 'supply-total-rate',
      label: effectiveCompact ? `Supply ${rateLabel}` : rateLabel,
      current: simulation.supply.currentTotal,
      after: simulation.supply.afterTotal,
      delta: simulation.supply.deltaTotal,
      type: 'rate',
      // If no incentives, APY = Native, so put link here directly
      href: hasSupplyIncentives ? null : aaveUrl,
    },
    // Only show Native breakdown row if there are incentives to break down
    ...(hasSupplyIncentives
      ? [
          {
            rowKey: 'supply-native',
            label: 'Native',
            current: simulation.supply.currentNative,
            after: simulation.supply.afterNative,
            delta: simulation.supply.deltaNative,
            type: 'rate' as RowType,
            href: aaveUrl,
            isBreakdown: true,
          },
        ]
      : []),
    ...supplyIncentiveSources.flatMap((src, i) => incentiveSourceToTableRows(src, i, 'supply')),
  ];

  const borrowRows: TableRow[] = [
    {
      rowKey: 'borrow-size',
      label: effectiveCompact ? 'Total borrowed' : 'Total',
      current: simulation.marketMetrics.totalBorrowedUsd,
      after: simulation.marketMetrics.totalBorrowedUsdAfter,
      delta: simulation.marketMetrics.totalBorrowedUsdDelta,
      type: 'usd',
      cap: borrowCapUsd,
      warning: borrowCapExceeded && !borrowLimitedByLiquidity,
    },
    {
      rowKey: 'borrow-total-rate',
      label: effectiveCompact ? `Borrow ${rateLabel}` : rateLabel,
      current: simulation.borrow.currentTotal,
      after: simulation.borrow.afterTotal,
      delta: simulation.borrow.deltaTotal,
      type: 'rate',
      // If no incentives, APY = Native, so put link here directly
      href: hasBorrowIncentives ? null : aaveUrl,
    },
    // Only show Native breakdown row if there are incentives to break down
    ...(hasBorrowIncentives
      ? [
          {
            rowKey: 'borrow-native',
            label: 'Native',
            current: simulation.borrow.currentNative,
            after: simulation.borrow.afterNative,
            delta: simulation.borrow.deltaNative,
            type: 'rate' as RowType,
            href: aaveUrl,
            isBreakdown: true,
          },
        ]
      : []),
    ...borrowIncentiveSources.flatMap((src, i) => incentiveSourceToTableRows(src, i, 'borrow')),
  ];

  const formatValue = (value: number | null, type: RowType) => {
    if (type === 'usd') {
      return formatScenarioSize(value, {
        inputMode,
        tokenPrice: simulation.tokenPrice,
      });
    }
    if (type === 'spread') return formatSpread(value);
    return formatPercent(value);
  };

  const formatDeltaValue = (value: number | null, type: RowType) => {
    if (type === 'usd') {
      return formatScenarioSizeDelta(value, {
        inputMode,
        tokenPrice: simulation.tokenPrice,
      });
    }
    return formatDelta(value);
  };

  const renderRow = (row: TableRow, accentClass: string, borderColorClass: string, tight = false) => {
    const deltaColorClass = row.delta === null || Number.isNaN(row.delta) ? 'text-muted-foreground' : accentClass;
    const isBreakdownItem = row.isBreakdown;
    const isSubBreakdown = row.isSubBreakdown === true;
    const breakdownIndentClass = isSubBreakdown ? 'ml-4 pl-2 border-l' : isBreakdownItem ? 'ml-2 pl-2 border-l' : '';
    const cellPy = tight ? 'py-1' : 'py-1.5';
    const metricCellPx = tight ? 'px-3' : 'px-4';
    const valueCellPx = tight ? 'px-2.5' : 'px-3';
    const deltaCellPx = tight ? 'px-3' : 'px-4';
    // Supply = green, Borrow = cyan; breakdown rows (Native + Incentive) use same section color
    const rowAccentClass = accentClass;

    /** Align cap note with label text start; note sits outside nested ml/pl so it can use full column width (wraps later). */
    const capNoteAlignClass = isSubBreakdown ? 'pl-6' : isBreakdownItem ? 'pl-4' : '';

    return (
      <tr key={row.rowKey} className={row.warning ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
        <td className={`${cellPy} ${metricCellPx} min-w-0 align-top`}>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className={`min-w-0 ${isBreakdownItem ? `${breakdownIndentClass} ${borderColorClass}` : ''}`}>
              <div className="flex flex-wrap items-start gap-x-1.5 gap-y-0.5 min-w-0">
                {row.href ? (
                  <a
                    href={row.href}
                    {...externalLinkTabProps(isMobile)}
                    onClick={(e) => e.stopPropagation()}
                    className={`ds-text-12 flex items-center gap-1 min-w-0 break-words ${row.warning ? 'text-amber-700 dark:text-amber-400' : isBreakdownItem ? `${rowAccentClass} hover:opacity-90` : accentClass}`}
                  >
                    <span className="break-words">{row.label}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                  </a>
                ) : (
                  <span
                    className={`ds-text-12 break-words ${row.warning ? 'text-amber-700 dark:text-amber-400 font-medium' : isBreakdownItem ? rowAccentClass : accentClass}`}
                  >
                    {row.label}
                  </span>
                )}
                {row.cap !== null && row.cap !== undefined && (
                  <span className={`ds-text-11 tabular-nums flex-shrink-0 ${row.warning ? 'text-amber-600' : 'text-muted-foreground/70'}`}>
                    / Cap {formatScenarioSize(row.cap, { inputMode, tokenPrice: simulation.tokenPrice })}
                  </span>
                )}
              </div>
            </div>
            {row.capNote ? (
              <p
                className={`ds-text-11 max-w-none leading-snug text-pretty break-normal ${capNoteAlignClass} ${row.capWarning ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
              >
                {row.capNote}
              </p>
            ) : null}
          </div>
        </td>
        <td className={`${cellPy} ${valueCellPx} text-right`}>
          <span className={`ds-text-12 tabular-nums ${rowAccentClass}`}>
            {formatValue(row.current, row.type)}
          </span>
        </td>
        <td className={`${cellPy} ${valueCellPx} text-right`}>
          <span className={`ds-text-12 tabular-nums ${row.after === null ? 'text-muted-foreground' : rowAccentClass}`}>
            {formatValue(row.after, row.type)}
          </span>
        </td>
        <td className={`${cellPy} ${deltaCellPx} text-right`}>
          <span className={`ds-text-12 tabular-nums ${deltaColorClass}`}>
            {formatDeltaValue(row.delta, row.type)}
          </span>
        </td>
      </tr>
    );
  };

  const renderCompactLayout = () => {
    const compactCellPy = 'py-1';
    const compactMetricCell = 'px-3';
    const compactNumCell = 'px-2.5';
    const compactDeltaCell = 'pl-2.5 pr-3';
    /** Parent card/panel already provides the outer border when embedded; inner borders misalign with thead lines. */
    return (
    <div
      className={`overflow-hidden ${
        embeddedFromTop
          ? 'rounded-none bg-transparent dark:bg-transparent'
          : 'bg-card/50 dark:bg-background/80 border border-border/60 rounded-xl'
      }`}
    >
      <table className="w-full min-w-0 table-fixed">
        <colgroup>
          {/* Wide label column: cap notes sit outside nested indent so they use full width (later wrap). */}
          <col style={{ width: '46%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr className="bg-muted/30 border-b border-border/50">
            <th className={`${compactCellPy} ${compactMetricCell} text-left`}>
              <span className="ds-text-11 text-muted-foreground font-medium">{tokenOnChainLabel}</span>
            </th>
            <th className={`${compactCellPy} ${compactNumCell} text-right`}>
              <span className="ds-text-11 text-muted-foreground font-medium">Current</span>
            </th>
            <th className={`${compactCellPy} ${compactNumCell} text-right`}>
              <span className="ds-text-11 text-muted-foreground font-medium">After</span>
            </th>
            <th className={`${compactCellPy} ${compactDeltaCell} text-right`}>
              <span className="ds-text-11 text-muted-foreground font-medium">Δ</span>
            </th>
          </tr>
        </thead>
        <tbody className="ds-text-12 [&>tr:last-child>td]:pb-2">
          {supplyRows.map((row) => renderRow(row, 'ds-text-emerald-600', 'border-l-[rgb(var(--ds-emerald-500-rgb))]', true))}
          <tr className={middleColumnWarning ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
            <td className={`${compactCellPy} ${compactMetricCell}`}>
              <span className="ds-text-12 ds-text-purple-600">Spread</span>
            </td>
            <td className={`${compactCellPy} ${compactNumCell} text-right`}>
              <span className="ds-text-12 tabular-nums ds-text-purple-600">{formatSpread(simulation.spread.current)}</span>
            </td>
            <td className={`${compactCellPy} ${compactNumCell} text-right`}>
              <span className={`ds-text-12 tabular-nums ${simulation.spread.after === null ? 'text-muted-foreground' : 'ds-text-purple-600'}`}>
                {formatSpread(simulation.spread.after)}
              </span>
            </td>
            <td className={`${compactCellPy} ${compactDeltaCell} text-right`}>
              <span className={`ds-text-12 tabular-nums ${simulation.spread.delta === null ? 'text-muted-foreground' : 'ds-text-purple-600'}`}>
                {formatDelta(simulation.spread.delta)}
              </span>
            </td>
          </tr>
          <tr className={borrowCapExceeded && borrowLimitedByLiquidity ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
            <td className={`${compactCellPy} ${compactMetricCell}`}>
              <span className={`ds-text-12 ${borrowCapExceeded && borrowLimitedByLiquidity ? 'text-amber-700 dark:text-amber-400 font-medium' : 'ds-text-purple-600'}`}>
                Liquidity
              </span>
            </td>
            <td className={`${compactCellPy} ${compactNumCell} text-right`}>
              <span className="ds-text-12 tabular-nums ds-text-purple-600">
                {formatScenarioSize(simulation.marketMetrics.availableLiquidityUsd, { inputMode, tokenPrice: simulation.tokenPrice })}
              </span>
            </td>
            <td className={`${compactCellPy} ${compactNumCell} text-right`}>
              <span className={`ds-text-12 tabular-nums ${simulation.marketMetrics.availableLiquidityUsdAfter === null ? 'text-muted-foreground' : 'ds-text-purple-600'}`}>
                {formatScenarioSize(simulation.marketMetrics.availableLiquidityUsdAfter, { inputMode, tokenPrice: simulation.tokenPrice })}
              </span>
            </td>
            <td className={`${compactCellPy} ${compactDeltaCell} text-right`}>
              <span className={`ds-text-12 tabular-nums ${simulation.marketMetrics.availableLiquidityUsdDelta === null ? 'text-muted-foreground' : 'ds-text-purple-600'}`}>
                {formatScenarioSizeDelta(simulation.marketMetrics.availableLiquidityUsdDelta, { inputMode, tokenPrice: simulation.tokenPrice })}
              </span>
            </td>
          </tr>
          {borrowRows.map((row) => renderRow(row, 'ds-text-brand-cyan', 'border-l-[rgb(var(--ds-brand-cyan-rgb))]', true))}
        </tbody>
      </table>
    </div>
    );
  };

  const renderTable = (title: string, rows: TableRow[], accentClass: string, borderClass: string, indentBorderClass: string, isWarning?: boolean) => (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <table className="w-full min-w-0 table-fixed">
        <colgroup>
          <col style={{ width: '46%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr className="bg-muted/30 border-b border-border/50">
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
        <tbody className="[&>tr:last-child>td]:pb-2.5">
          {rows.map((row) => renderRow(row, accentClass, indentBorderClass))}
        </tbody>
      </table>
    </div>
  );

  // Middle column (Spread + Liquidity) - amber border when borrow limited by liquidity
  const middleColumnWarning = borrowCapExceeded && borrowLimitedByLiquidity;
  const renderMiddleColumn = () => (
    <div className="flex min-h-0 flex-1 flex-col min-w-0">
      <table className="w-full min-w-0 table-fixed">
        <colgroup>
          <col style={{ width: '26%' }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '26%' }} />
        </colgroup>
        <thead>
          <tr className="bg-muted/30 border-b border-border/50">
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
        <tbody className="[&>tr:last-child>td]:pb-2.5">
          {/* Spread first */}
          <tr>
            <td className="py-1.5 px-4">
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
            <td className="py-1.5 px-4 text-right">
              <span className={`ds-text-12 tabular-nums ${simulation.spread.delta === null ? 'text-muted-foreground' : 'ds-text-purple-600'}`}>
                {formatDelta(simulation.spread.delta)}
              </span>
            </td>
          </tr>
          {/* Liquidity second */}
          <tr className={borrowCapExceeded && borrowLimitedByLiquidity ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
            <td className="py-1.5 px-4">
              <span className={`ds-text-12 ${borrowCapExceeded && borrowLimitedByLiquidity ? 'text-amber-700 dark:text-amber-400 font-medium' : 'ds-text-purple-600'}`}>
                Liquidity
              </span>
            </td>
            <td className="py-1.5 px-3 text-right">
              <span className="ds-text-12 tabular-nums ds-text-purple-600">
                {formatScenarioSize(simulation.marketMetrics.availableLiquidityUsd, { inputMode, tokenPrice: simulation.tokenPrice })}
              </span>
            </td>
            <td className="py-1.5 px-3 text-right">
              <span className={`ds-text-12 tabular-nums ${simulation.marketMetrics.availableLiquidityUsdAfter === null ? 'text-muted-foreground' : 'ds-text-purple-600'}`}>
                {formatScenarioSize(simulation.marketMetrics.availableLiquidityUsdAfter, { inputMode, tokenPrice: simulation.tokenPrice })}
              </span>
            </td>
            <td className="py-1.5 px-4 text-right">
              <span className={`ds-text-12 tabular-nums ${simulation.marketMetrics.availableLiquidityUsdDelta === null ? 'text-muted-foreground' : 'ds-text-purple-600'}`}>
                {formatScenarioSizeDelta(simulation.marketMetrics.availableLiquidityUsdDelta, { inputMode, tokenPrice: simulation.tokenPrice })}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const showHeaderBlock = showEmptyStateNote;

  return (
    <div ref={containerRef} className={`min-w-0 ${effectiveCompact ? 'p-0' : 'p-0'}`}>
      {showHeaderBlock && (
        <div
        className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${
          effectiveCompact ? (embeddedFromTop ? 'mb-2 px-0' : 'mb-2 px-1') : 'mb-3 px-1'
        }`}
      >
          <span className="ds-text-12 text-muted-foreground">
            Enter supply or borrow amount above to see simulated values.
          </span>
        </div>
      )}

      {/* Warnings */}
      {supplyCapExceeded && (
        <div className={`flex items-center gap-3 rounded-lg border border-amber-400/60 bg-amber-50/80 dark:bg-amber-950/30 ${effectiveCompact ? 'mb-2 px-3 py-1.5' : 'mb-3 px-4 py-2'}`}>
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="flex-1 ds-text-12 text-amber-800 dark:text-amber-300">
            Supply exceeds cap by {formatScenarioSize(supplyCapExceededByUsd, { inputMode, tokenPrice: simulation.tokenPrice })}
          </p>
          {onCorrectSupplyInput && availableSupplyRoomUsd !== null && availableSupplyRoomUsd > 0 && (
            <button type="button" onClick={handleCorrectToMaxSupply} className="ds-btn-warning ds-text-11 px-3 py-1">
              Adjust to max
            </button>
          )}
        </div>
      )}

      {borrowCapExceeded && (
        <div className={`flex items-center gap-3 rounded-lg border border-amber-400/60 bg-amber-50/80 dark:bg-amber-950/30 ${effectiveCompact ? 'mb-2 px-3 py-1.5' : 'mb-3 px-4 py-2'}`}>
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="flex-1 ds-text-12 text-amber-800 dark:text-amber-300">
            Borrow exceeds {borrowLimitedByLiquidity ? 'liquidity' : 'cap'} by {formatScenarioSize(borrowCapExceededByUsd, { inputMode, tokenPrice: simulation.tokenPrice })}
          </p>
          {onCorrectBorrowInput && availableBorrowRoomUsd !== null && availableBorrowRoomUsd > 0 && (
            <button type="button" onClick={handleCorrectToMaxBorrow} className="ds-btn-warning ds-text-11 px-3 py-1">
              Adjust to max
            </button>
          )}
        </div>
      )}

      {/* Layout: compact = single table; desktop = 3 columns. Switch to compact when grid overflows (adaptive). */}
      {effectiveCompact ? (
        renderCompactLayout()
      ) : (
        <div ref={gridRef} className="grid grid-cols-3 gap-2 min-w-0 items-stretch overflow-hidden">
          <div className="flex min-w-0 flex-col overflow-hidden">
            {renderTable('Supply', supplyRows, 'ds-text-emerald-600', 'border-emerald-500/40', 'border-l-[rgb(var(--ds-emerald-500-rgb))]', supplyCapExceeded)}
          </div>
          <div className="flex min-w-0 flex-col overflow-hidden">
            {renderMiddleColumn()}
          </div>
          <div className="flex min-w-0 flex-col overflow-hidden">
            {renderTable('Borrow', borrowRows, 'ds-text-brand-cyan', 'border-[rgb(var(--ds-brand-cyan-rgb))]/40', 'border-l-[rgb(var(--ds-brand-cyan-rgb))]', borrowCapExceeded)}
          </div>
        </div>
      )}

      {/* Footer notes */}
      {(simulation.reserveRateInputLoading || simulation.reserveRateInputError || simulation.forecastLoading || showPriceMissingNotice || simulation.forecastUnavailableCampaignCount > 0) && (
        <div className={`mt-3 space-y-1 ${effectiveCompact && embeddedFromTop ? 'px-0' : 'px-1'}`}>
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
