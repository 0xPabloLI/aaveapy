import { Fragment, useRef, useState, useEffect } from 'react';
import { AlertTriangle, Ban, ExternalLink, PauseCircle, Snowflake } from 'lucide-react';
import { annualPercentToDailyFraction } from '@/lib/rateCalculations';
import {
  formatPercent,
  formatScenarioSize,
  formatScenarioSizeDelta,
  formatSignedScenarioDailyCashflow,
  formatSpread,
  formatUsd,
} from '@/lib/formatters';
import { formatProtocolCapText } from '@/lib/portfolioCapWarnings';
import { buildAaveUrl } from '@/lib/aaveLinks';
import { externalLinkTabProps } from '@/lib/externalNavigation';
import { convertUsdToInputValue, nativeToUsd } from '@/lib/scenarioSize';
import { getProtocolVersion } from '@/lib/protocolVersion';
import { useIsMobile } from '@/hooks/use-mobile';
import type {
  RateSimulationResult,
  SimulationCampaignDetail,
  SimulationSourceDetail,
} from '@/lib/rateSimulationCalculator';
import {
  hasAnyIncentiveBreakdownHref,
  includeIncentiveSourceInBreakdown,
  incentiveSourceToTableRows,
  resolveFirstIncentiveSourceHref,
  type IncentiveSourceRow,
  type SimulationTableRow,
} from '@/lib/simulationIncentiveTableRows';
import type { ReserveWithSpread, MerklOpportunityGroup, BrevisIncentive } from '@/types/aave';
import { ETHEREUM_MARKET_NAMES } from '@/types/aave';
import { isSupplyDisabled, isBorrowDisabled } from '@/lib/reserveStatus';
import { getFirstActiveBrevisLink } from '@/lib/brevis';
import { getFirstActiveMeritLink } from '@/lib/merit';
import { getFirstActiveMerklLink } from '@/lib/merkl';
import { getIncentiveSources } from '@/lib/incentiveAggregation';

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

const normalizeToAfterPlaceholder = (value: string) => (value === '—' ? '-' : value);
const SIM_NEUTRAL_PRIMARY = 'text-foreground';
const SIM_NEUTRAL_SECONDARY = 'text-foreground/75';
const SIM_NEUTRAL_MUTED = 'text-foreground/70';
const EARN_NEUTRAL_TEXT_CLASS = 'text-foreground';

const hasMeaningfulValue = (value: number | null): boolean => {
  return value !== null && Number.isFinite(value) && Math.abs(value) > 1e-12;
};

type RowType = 'usd' | 'rate' | 'spread';
type TableRow = SimulationTableRow;
type DesktopAlignBand = 'size' | 'total-rate' | 'native' | 'incentive-total';
type DesktopAlignSegment = 'main' | 'cap' | 'note';

const DESKTOP_BAND_TO_ROW_KEY_SUFFIX: Readonly<Record<DesktopAlignBand, string>> = {
  size: 'size',
  'total-rate': 'total-rate',
  native: 'native',
  'incentive-total': 'incentive-total',
};

const getDesktopAlignBandFromRowKey = (rowKey: string): DesktopAlignBand | null => {
  const normalized = rowKey.startsWith('supply-')
    ? rowKey.slice('supply-'.length)
    : rowKey.startsWith('borrow-')
      ? rowKey.slice('borrow-'.length)
      : rowKey;

  return (Object.entries(DESKTOP_BAND_TO_ROW_KEY_SUFFIX).find(([, suffix]) => normalized === suffix)?.[0] as DesktopAlignBand | undefined) ?? null;
};

const getDesktopAlignKey = (
  band: DesktopAlignBand | null | undefined,
  segment: DesktopAlignSegment,
) => (band ? `${band}:${segment}` : undefined);

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
  const isReserveLocked = Boolean(reserve.isFrozen || reserve.isPaused || reserve.isActive === false);
  const supplyDisabledNotice = reserve.isPaused ? 'Paused'
    : reserve.isActive === false ? 'Inactive'
    : reserve.isFrozen ? 'Frozen'
    : isSupplyDisabled(reserve) ? 'Supply unavailable'
    : null;
  const borrowDisabledNotice = reserve.isPaused ? 'Paused'
    : reserve.isActive === false ? 'Inactive'
    : reserve.isFrozen ? 'Frozen'
    : isBorrowDisabled(reserve) ? 'Borrow unavailable'
    : null;
  const rateLabel = isApy ? 'APY' : 'APR';
  const showPriceMissingNotice =
    inputMode === 'token' &&
    (simulation.supply.hasInput || simulation.borrow.hasInput) &&
    !simulation.tokenPrice &&
    !simulation.tokenPriceLoading;
  const hasScenarioInput = simulation.supply.hasInput || simulation.borrow.hasInput;
  const showEmptyStateNote = !simulation.supply.hasInput && !simulation.borrow.hasInput;

  const supplySideBlocked = isSupplyDisabled(reserve);
  const borrowSideBlocked = isBorrowDisabled(reserve);
  const hasDisabledState = supplySideBlocked || borrowSideBlocked;

  const aaveUrl = buildAaveUrl({ marketName: reserve.marketName, tokenAddress: reserve.tokenAddress, aaveProReserveId: reserve.aaveProReserveId });

  const tokenOnChainLabel = (() => {
    const version = getProtocolVersion(reserve.marketName);
    // V4 and V3 non-Ethereum: extract display name from marketName suffix
    // e.g., "AaveV4EthereumLido" → "Ethereum Lido", "AaveV3Base" → "Base"
    if (version === 'v4' || (reserve.marketName?.startsWith('AaveV3') && reserve.chainName !== 'Ethereum')) {
      const prefix = version === 'v4' ? 'AaveV4' : 'AaveV3';
      const withoutPrefix = reserve.marketName.replace(new RegExp(`^${prefix}`, 'i'), '');
      const marketDisplay = withoutPrefix.replace(/([a-z])([A-Z])/g, '$1 $2');
      return `${reserve.tokenSymbol} · ${marketDisplay}`;
    }
    // V3 Ethereum: keep original logic with canonical names
    if (reserve.chainName === 'Ethereum' && ETHEREUM_MARKET_NAMES[reserve.marketName]) {
      return `${reserve.tokenSymbol} · ${ETHEREUM_MARKET_NAMES[reserve.marketName]}`;
    }
    return `${reserve.tokenSymbol} · ${reserve.chainName}`;
  })();

  const { supplyCapExceeded, availableSupplyRoomUsd, supplyCapExceededByUsd, supplyCapUsd } = simulation.marketMetrics;

  const handleCorrectToMaxSupply = () => {
    if (!onCorrectSupplyInput || availableSupplyRoomUsd === null) return;
    onCorrectSupplyInput(convertUsdToInputValue(availableSupplyRoomUsd, inputMode, simulation.tokenPrice));
  };

  const { borrowCapExceeded, availableBorrowRoomUsd, borrowCapExceededByUsd, borrowCapUsd, borrowLimitedByLiquidity } = simulation.marketMetrics;

  const handleCorrectToMaxBorrow = () => {
    if (!onCorrectBorrowInput || availableBorrowRoomUsd === null) return;
    onCorrectBorrowInput(convertUsdToInputValue(availableBorrowRoomUsd, inputMode, simulation.tokenPrice));
  };

  const currentSupplySizeUsd = (() => {
    const size = nativeToUsd(reserve.supplied, reserve.decimals, reserve.tokenPrice);
    return size != null && Number.isFinite(size) ? size : null;
  })();
  const afterSupplySizeUsd =
    currentSupplySizeUsd !== null && simulation.supply.inputUsd > 0
      ? currentSupplySizeUsd + simulation.supply.inputUsd
      : null;
  const supplyCapBaseExceeded =
    supplyCapUsd !== null && currentSupplySizeUsd !== null && currentSupplySizeUsd > supplyCapUsd;
  const showSupplyCapWarning = (supplyCapExceeded || supplyCapBaseExceeded) && !supplySideBlocked;
  const currentBorrowedSizeUsd =
    simulation.marketMetrics.totalBorrowedUsd != null && Number.isFinite(simulation.marketMetrics.totalBorrowedUsd)
      ? simulation.marketMetrics.totalBorrowedUsd
      : null;
  const borrowCapBaseExceeded =
    borrowCapUsd !== null && currentBorrowedSizeUsd !== null && currentBorrowedSizeUsd > borrowCapUsd;
  const showBorrowCapWarning = (borrowCapExceeded || borrowCapBaseExceeded) && !borrowSideBlocked;

  const supplySources = getIncentiveSources(reserve, 'supply');
  const supplyMeritLink = getFirstActiveMeritLink(supplySources.merit);
  const supplyMerklLink = getFirstActiveMerklLink(supplySources.merkl);
  const supplyBrevisLink = getFirstActiveBrevisLink(supplySources.brevis);

  const borrowSources = getIncentiveSources(reserve, 'borrow');
  const borrowMeritLink = getFirstActiveMeritLink(borrowSources.merit);
  const borrowMerklLink = getFirstActiveMerklLink(borrowSources.merkl);
  const borrowBrevisLink = getFirstActiveBrevisLink(borrowSources.brevis);

  const incentiveLabel = (full: string, short: string) => (effectiveCompact ? short : full);
  const supplyIncentiveSources: IncentiveSourceRow[] = [
    {
      label: incentiveLabel('Protocol Incentive', 'Protocol'),
      ...simulation.supply.sources.protocol,
      href: aaveUrl,
      hideAggregateWhenCampaigns: true,
    },
    {
      label: incentiveLabel('ACI Incentive', 'ACI'),
      ...simulation.supply.sources.merit,
      href: supplyMeritLink,
      hideAggregateWhenCampaigns: true,
    },
    {
      label: incentiveLabel('Merkl Incentive', 'Merkl'),
      ...simulation.supply.sources.merkl,
      href: supplyMerklLink,
      hideAggregateWhenCampaigns: true,
    },
    {
      label: incentiveLabel('Brevis Incentive', 'Brevis'),
      ...simulation.supply.sources.brevis,
      href: supplyBrevisLink,
      mergeSingleCampaignRow: true,
      hideAggregateWhenCampaigns: true,
    },
  ].filter(includeIncentiveSourceInBreakdown);

  const borrowIncentiveSources: IncentiveSourceRow[] = [
    {
      label: incentiveLabel('Protocol Incentive', 'Protocol'),
      ...simulation.borrow.sources.protocol,
      href: aaveUrl,
      hideAggregateWhenCampaigns: true,
    },
    {
      label: incentiveLabel('ACI Incentive', 'ACI'),
      ...simulation.borrow.sources.merit,
      href: borrowMeritLink,
      hideAggregateWhenCampaigns: true,
    },
    {
      label: incentiveLabel('Merkl Incentive', 'Merkl'),
      ...simulation.borrow.sources.merkl,
      href: borrowMerklLink,
      hideAggregateWhenCampaigns: true,
    },
    {
      label: incentiveLabel('Brevis Incentive', 'Brevis'),
      ...simulation.borrow.sources.brevis,
      href: borrowBrevisLink,
      mergeSingleCampaignRow: true,
      hideAggregateWhenCampaigns: true,
    },
  ].filter(includeIncentiveSourceInBreakdown);

  const supplyIncentiveJumpHref = resolveFirstIncentiveSourceHref(supplyIncentiveSources, aaveUrl);
  const borrowIncentiveJumpHref = resolveFirstIncentiveSourceHref(borrowIncentiveSources, aaveUrl);
  const earnCostIncentiveJumpHref = (() => {
    const fromSupply = resolveFirstIncentiveSourceHref(supplyIncentiveSources, '');
    return fromSupply || resolveFirstIncentiveSourceHref(borrowIncentiveSources, aaveUrl);
  })();
  const hasSupplyBreakdownLevelHref = hasAnyIncentiveBreakdownHref(supplyIncentiveSources);
  const hasBorrowBreakdownLevelHref = hasAnyIncentiveBreakdownHref(borrowIncentiveSources);

  // If only Native (no incentives), put link on APY row directly; otherwise show breakdown
  const hasSupplyIncentives = supplyIncentiveSources.length > 0;
  const hasBorrowIncentives = borrowIncentiveSources.length > 0;

  const supplyRows: TableRow[] = [
    {
      rowKey: 'supply-size',
      label: effectiveCompact ? 'Supplied' : 'Total',
      current: currentSupplySizeUsd,
      after: afterSupplySizeUsd,
      delta: afterSupplySizeUsd !== null && currentSupplySizeUsd !== null ? afterSupplySizeUsd - currentSupplySizeUsd : null,
      type: 'usd',
      cap: supplyCapUsd,
      warning: showSupplyCapWarning,
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
          {
            rowKey: 'supply-incentive-total',
            label: 'Incentive',
            current: simulation.supply.currentIncentive,
            after: simulation.supply.afterIncentive,
            delta: simulation.supply.deltaIncentive,
            type: 'rate' as RowType,
            isBreakdown: true,
            href: hasSupplyBreakdownLevelHref ? null : supplyIncentiveJumpHref,
          },
          // AAV-1167: Headline reference value (pure market advertised rate).
          {
            rowKey: 'supply-incentive-headline',
            label: 'Headline',
            current: simulation.supply.headlineIncentive,
            after: null,
            delta: null,
            type: 'rate' as RowType,
            isSubBreakdown: true,
          },
        ]
      : []),
    ...supplyIncentiveSources.flatMap((src, i) => incentiveSourceToTableRows(src, i, 'supply', true)),
  ];

  const borrowRows: TableRow[] = [
    {
      rowKey: 'borrow-size',
      label: effectiveCompact ? 'Borrowed' : 'Total',
      current: simulation.marketMetrics.totalBorrowedUsd,
      after: simulation.marketMetrics.totalBorrowedUsdAfter,
      delta: simulation.marketMetrics.totalBorrowedUsdDelta,
      type: 'usd',
      cap: borrowCapUsd,
      warning: showBorrowCapWarning && !borrowLimitedByLiquidity,
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
          {
            rowKey: 'borrow-incentive-total',
            label: 'Incentive',
            current: simulation.borrow.currentIncentive,
            after: simulation.borrow.afterIncentive,
            delta: simulation.borrow.deltaIncentive,
            type: 'rate' as RowType,
            isBreakdown: true,
            href: hasBorrowBreakdownLevelHref ? null : borrowIncentiveJumpHref,
          },
          // AAV-1167: Headline reference value (pure market advertised rate).
          {
            rowKey: 'borrow-incentive-headline',
            label: 'Headline',
            current: simulation.borrow.headlineIncentive,
            after: null,
            delta: null,
            type: 'rate' as RowType,
            isSubBreakdown: true,
          },
        ]
      : []),
    ...borrowIncentiveSources.flatMap((src, i) => incentiveSourceToTableRows(src, i, 'borrow', true)),
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
      return normalizeToAfterPlaceholder(formatScenarioSizeDelta(value, {
        inputMode,
        tokenPrice: simulation.tokenPrice,
      }));
    }
    return formatSpread(value);
  };

  const renderRow = (
    row: TableRow,
    accentClass: string,
    borderColorClass: string,
    tight = false,
    peerCapInfo?: { hasCapBar: boolean; hasCapNote: boolean; capNoteText?: string },
    alignBand?: DesktopAlignBand | null,
    disabled = false,
  ) => {
    // When the side is frozen/paused/disabled, mask After + Delta so the
    // simulation does not appear to react to user input.
    if (disabled) {
      row = { ...row, after: null, delta: null, notes: undefined, warning: false };
    }
    const deltaColorClass = row.delta === null || Number.isNaN(row.delta) ? SIM_NEUTRAL_MUTED : accentClass;
    const isBreakdownItem = row.isBreakdown;
    const isSubBreakdown = row.isSubBreakdown === true;
    const isNestedUnderIncentive = row.nestedUnderIncentive === true;
    const breakdownIndentClass = isSubBreakdown
      ? 'ml-4 pl-2 border-l'
      : isBreakdownItem
        ? isNestedUnderIncentive
          ? 'ml-3 pl-2 border-l'
          : 'ml-2 pl-2 border-l'
        : '';
    const cellPy = tight ? 'py-0.5' : 'py-1';
    /** Compact cell padding: only the outer edges (left of label, right of delta) keep
     *  visual breathing room; inter-column gaps are squeezed to ~2px so numeric values
     *  get the maximum width inside their fixed-width columns. */
    const metricCellPx = tight ? 'pl-2 pr-0.5' : 'px-4';
    const valueCellPx = tight ? 'px-0.5' : 'px-3';
    const deltaCellPx = tight ? 'pl-0.5 pr-2' : 'px-4';
    /** Numeric values stay nowrap; in compact (tight) mode we drop one tier in font size
     *  so K/M/B-formatted values reliably fit within the table-fixed column widths. */
    const numericFontClass = tight ? 'ds-text-11' : 'ds-text-12';
    // Supply = green, Borrow = cyan; breakdown rows (Native + Incentive) use same section color
    const rowAccentClass = accentClass;

    /** Indent cap note to match label column hierarchy; row uses colspan so note can use full table width. */
    const capNoteAlignClass = isSubBreakdown ? 'pl-6' : isBreakdownItem ? 'pl-4' : '';
    const labelCellPy = row.notes?.length ? `${tight ? 'pt-0.5 pb-0' : 'pt-1 pb-0'}` : cellPy;
    const valueCellPy = row.notes?.length ? `${tight ? 'pt-0.5 pb-0' : 'pt-1 pb-0'}` : cellPy;
    const capRowPb = tight ? 'pb-0.5' : 'pb-1';
    const resolvedAlignBand = alignBand ?? getDesktopAlignBandFromRowKey(row.rowKey);
    const mainAlignKey = getDesktopAlignKey(resolvedAlignBand, 'main');
    const capAlignKey = getDesktopAlignKey(resolvedAlignBand, 'cap');
    const noteAlignKey = getDesktopAlignKey(resolvedAlignBand, 'note');

    const mainRow = (
      <tr data-align-key={mainAlignKey} data-disabled={disabled ? 'true' : undefined} className={`group ${row.warning ? 'ds-bg-warning-row' : ''}`}>
        <td className={`${labelCellPy} ${metricCellPx} min-w-0 align-top`}>
          <div className={`min-w-0 ${isBreakdownItem ? `${breakdownIndentClass} ${borderColorClass}` : ''}`}>
            {/* Label + cap use `flex-wrap` so the cap text drops to a second line
                when the label cell cannot fit both on one line, instead of bleeding
                into the right-aligned Current column's whitespace (AAV-1084).
                Each span keeps `whitespace-nowrap` so individual tokens are never
                broken. Matches the compact layout's flex-wrap pattern. */}
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              {row.href ? (
                <a
                  href={row.href}
                  {...externalLinkTabProps(isMobile)}
                  onClick={(e) => e.stopPropagation()}
                  className={`ds-text-12 flex items-center gap-1 whitespace-nowrap ${row.warning ? 'text-amber-700 dark:text-amber-400' : `${accentClass} hover:opacity-90`}`}
                >
                  <span className="break-words">{row.label}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                </a>
              ) : (
                <span
                  title={typeof row.label === 'string' ? row.label : undefined}
                  className={`ds-text-12 whitespace-nowrap ${row.warning ? 'text-amber-700 dark:text-amber-400 font-medium' : `${accentClass}`}`}
                >
                  {row.label}
                </span>
              )}
              {row.cap !== null && row.cap !== undefined && (
                <span className={`ds-text-11 tabular-nums whitespace-nowrap ${row.warning ? 'text-amber-600' : SIM_NEUTRAL_SECONDARY}`}>
                  / Cap {formatScenarioSize(row.cap, { inputMode, tokenPrice: simulation.tokenPrice })}
                </span>
              )}
            </div>
          </div>
        </td>
        <td className={`${valueCellPy} ${valueCellPx} text-right align-top whitespace-nowrap`}>
          <span className={`${numericFontClass} tabular-nums whitespace-nowrap ${accentClass}`}>
            {formatValue(row.current, row.type)}
          </span>
        </td>
        <td className={`${valueCellPy} ${valueCellPx} text-right align-top whitespace-nowrap`}>
          <span className={`${numericFontClass} tabular-nums whitespace-nowrap ${row.after === null ? SIM_NEUTRAL_MUTED : rowAccentClass}`}>
            {formatValue(row.after, row.type)}
          </span>
        </td>
        <td className={`${valueCellPy} ${deltaCellPx} text-right align-top whitespace-nowrap`}>
          <span className={`${numericFontClass} tabular-nums whitespace-nowrap ${deltaColorClass}`}>
            {formatDeltaValue(row.delta, row.type)}
          </span>
        </td>
      </tr>
    );

    const capProgressBar = (() => {
      if (row.cap == null || row.type !== 'usd') return null;
      const currentVal = row.current ?? 0;
      const afterVal = row.after;
      const capVal = row.cap;
      const currentPct = Math.min((currentVal / capVal) * 100, 100);
      const afterPct = afterVal != null ? Math.min((afterVal / capVal) * 100, 100) : null;
      const barColorClass = row.warning
        ? 'bg-[rgb(var(--ds-amber-600-rgb))]'
        : accentClass.includes('emerald') ? 'bg-emerald-500' : 'bg-[rgb(var(--ds-brand-cyan-rgb))]';
      const afterBarColorClass = row.warning
        ? 'bg-[rgb(var(--ds-amber-500-rgb)/0.5)]'
        : accentClass.includes('emerald') ? 'bg-emerald-400/40' : 'bg-[rgb(var(--ds-brand-cyan-rgb))]/40';
      return (
        <tr data-align-key={capAlignKey} data-disabled={disabled ? 'true' : undefined} className={`group ${row.warning ? 'ds-bg-warning-row' : ''}`}>
          <td colSpan={4} className={`pt-0 pb-1 ${deltaCellPx}`}>
            <div className="relative h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${barColorClass} transition-all duration-300`}
                style={{ width: `${currentPct}%` }}
              />
              {afterPct != null && afterPct > currentPct && (
                <div
                  className={`absolute inset-y-0 rounded-full ${afterBarColorClass} transition-all duration-300`}
                  style={{ left: `${currentPct}%`, width: `${afterPct - currentPct}%` }}
                />
              )}
            </div>
          </td>
        </tr>
      );
    })();

    /* When the peer side (Supply↔Borrow) has a cap bar but this side doesn't,
       render an invisible placeholder bar to keep row heights aligned. */
    const capBarPlaceholder = !capProgressBar && peerCapInfo?.hasCapBar ? (
      <tr data-align-key={capAlignKey} aria-hidden>
        <td colSpan={4} className={`pt-0 pb-1 ${deltaCellPx}`}>
          <div className="relative h-1.5 w-full rounded-full bg-muted/40 opacity-0" />
        </td>
      </tr>
    ) : null;

    const capNotePlaceholder = !row.notes?.length && peerCapInfo?.hasCapNote ? (
      <tr data-align-key={noteAlignKey} aria-hidden>
        <td colSpan={4} className={`pt-0 ${capRowPb} ${metricCellPx} min-w-0 align-top`}>
          <p className="ds-text-11 min-w-0 w-full max-w-none whitespace-normal break-words leading-snug text-transparent select-none">
            {peerCapInfo.capNoteText ?? '.'}
          </p>
        </td>
      </tr>
    ) : null;

    return (
      <Fragment key={row.rowKey}>
        {mainRow}
        {capProgressBar ?? capBarPlaceholder}
        {row.notes?.map((note, ni) => (
          <tr key={`${row.rowKey}-note-${ni}`} data-align-key={noteAlignKey} className={note.color === 'amber' ? 'ds-bg-warning-row' : ''}>
            <td colSpan={4} className={`pt-0 ${capRowPb} ${metricCellPx} min-w-0 align-top`}>
              <p
                className={`ds-text-11 min-w-0 w-full max-w-none whitespace-normal break-words leading-snug ${capNoteAlignClass} ${note.color === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
              >
                {note.text}
              </p>
            </td>
          </tr>
        )) ?? capNotePlaceholder}
      </Fragment>
    );
  };

  /**
   * Render one TableRow as Grid cells: 4 main cells + optional cap-progress (col-span-4)
   * + optional cap-note (col-span-4). Used by the mobile compact layout only.
   *
   * Background classes (warning / disabled-section opacity) are applied per-cell because
   * the wrapping `display: contents` row groups do not paint backgrounds.
   */
  const renderCompactGridRow = (
    row: TableRow,
    accentClass: string,
    indentBorderClass: string,
    sectionClass = '',
    disabled = false,
  ) => {
    if (disabled) {
      row = { ...row, after: null, delta: null, notes: undefined, warning: false };
    }
    const deltaColorClass = row.delta === null || Number.isNaN(row.delta) ? SIM_NEUTRAL_MUTED : accentClass;
    const isBreakdownItem = row.isBreakdown;
    const isSubBreakdown = row.isSubBreakdown === true;
    const isNestedUnderIncentive = row.nestedUnderIncentive === true;
    const breakdownIndentClass = isSubBreakdown
      ? 'ml-4 pl-2 border-l'
      : isBreakdownItem
        ? isNestedUnderIncentive
          ? 'ml-3 pl-2 border-l'
          : 'ml-2 pl-2 border-l'
        : '';
    const capNoteAlignClass = isSubBreakdown ? 'pl-6' : isBreakdownItem ? 'pl-4' : '';
    const rowBgClass = row.warning ? 'ds-bg-warning-row' : '';
    const cellBgClass = `${rowBgClass} ${sectionClass}`.trim();
    const labelCellPy = row.notes?.length ? 'pt-0.5 pb-0' : 'py-1';
    const valueCellPy = row.notes?.length ? 'pt-0.5 pb-0' : 'py-1';

    const capProgressBar = (() => {
      if (row.cap == null || row.type !== 'usd') return null;
      const currentVal = row.current ?? 0;
      const afterVal = row.after;
      const capVal = row.cap;
      const currentPct = Math.min((currentVal / capVal) * 100, 100);
      const afterPct = afterVal != null ? Math.min((afterVal / capVal) * 100, 100) : null;
      const barColorClass = row.warning
        ? 'bg-[rgb(var(--ds-amber-600-rgb))]'
        : accentClass.includes('emerald') ? 'bg-emerald-500' : 'bg-[rgb(var(--ds-brand-cyan-rgb))]';
      const afterBarColorClass = row.warning
        ? 'bg-[rgb(var(--ds-amber-500-rgb)/0.5)]'
        : accentClass.includes('emerald') ? 'bg-emerald-400/40' : 'bg-[rgb(var(--ds-brand-cyan-rgb))]/40';
      return (
        <div
          role="row"
          data-disabled={disabled ? 'true' : undefined}
          className={`group col-span-4 pt-0 pb-1 pl-0.5 pr-2 ${cellBgClass}`}
        >
          <div className="relative h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${barColorClass} transition-all duration-300`}
              style={{ width: `${currentPct}%` }}
            />
            {afterPct != null && afterPct > currentPct && (
              <div
                className={`absolute inset-y-0 rounded-full ${afterBarColorClass} transition-all duration-300`}
                style={{ left: `${currentPct}%`, width: `${afterPct - currentPct}%` }}
              />
            )}
          </div>
        </div>
      );
    })();

    return (
      <Fragment key={row.rowKey}>
        {/* Main row: 4 grid cells (label / current / after / delta) */}
        <div role="row" className="contents">
          <div role="cell" data-disabled={disabled ? 'true' : undefined} className={`group ${labelCellPy} pl-2 pr-0.5 min-w-0 ${cellBgClass}`}>
            <div className={`min-w-0 ${isBreakdownItem ? `${breakdownIndentClass} ${indentBorderClass}` : ''}`}>
              {/* flex flex-wrap + whitespace-nowrap children: keeps each token (label / cap)
                  unbroken but lets the flex container wrap between them when the label cell
                  cannot fit both on one line. */}
              <div className="flex flex-wrap items-baseline gap-x-1.5">
                {row.href ? (
                  <a
                    href={row.href}
                    {...externalLinkTabProps(isMobile)}
                    onClick={(e) => e.stopPropagation()}
                    className={`ds-text-12 flex items-center gap-1 whitespace-nowrap ${row.warning ? 'text-amber-700 dark:text-amber-400' : `${accentClass} hover:opacity-90`}`}
                  >
                    <span className="break-words">{row.label}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                  </a>
                ) : (
                  <span
                    title={typeof row.label === 'string' ? row.label : undefined}
                    className={`ds-text-12 whitespace-nowrap ${row.warning ? 'text-amber-700 dark:text-amber-400 font-medium' : `${accentClass}`}`}
                  >
                    {row.label}
                  </span>
                )}
                {row.cap !== null && row.cap !== undefined && (
                  <span className={`ds-text-11 tabular-nums whitespace-nowrap ${row.warning ? 'text-amber-600' : SIM_NEUTRAL_SECONDARY}`}>
                    / Cap {formatScenarioSize(row.cap, { inputMode, tokenPrice: simulation.tokenPrice })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div role="cell" className={`${valueCellPy} px-0.5 text-right whitespace-nowrap ${cellBgClass}`}>
            <span className={`ds-text-11 tabular-nums whitespace-nowrap ${accentClass}`}>
              {formatValue(row.current, row.type)}
            </span>
          </div>
          <div role="cell" className={`${valueCellPy} px-0.5 text-right whitespace-nowrap ${cellBgClass}`}>
            <span className={`ds-text-11 tabular-nums whitespace-nowrap ${row.after === null ? SIM_NEUTRAL_MUTED : accentClass}`}>
              {formatValue(row.after, row.type)}
            </span>
          </div>
          <div role="cell" className={`${valueCellPy} pl-0.5 pr-2 text-right whitespace-nowrap ${cellBgClass}`}>
            <span className={`ds-text-11 tabular-nums whitespace-nowrap ${deltaColorClass}`}>
              {formatDeltaValue(row.delta, row.type)}
            </span>
          </div>
        </div>
        {capProgressBar}
        {row.notes?.map((note, ni) => (
          <div key={`note-${ni}`} role="row" className={`col-span-4 pt-0 pb-0.5 pl-2 pr-0.5 min-w-0 ${note.color === 'amber' ? 'ds-bg-warning-row' : ''}`}>
            <p
              className={`ds-text-11 min-w-0 w-full max-w-none whitespace-normal break-words leading-snug ${capNoteAlignClass} ${note.color === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
            >
              {note.text}
            </p>
          </div>
        ))}
      </Fragment>
    );
  };

  /**
   * Mobile compact layout — CSS Grid with `grid-cols-[1fr_auto_auto_auto]`.
   *
   * Why Grid (not table-fixed): the label column's `1fr` sizing lets `Supplied / Cap $19.50M`
   * naturally wrap onto a second line when both pieces cannot fit in one line, instead of
   * triggering horizontal overflow. Numeric columns use `auto` so they stay just wide enough
   * for K/M/B-formatted values.
   *
   * Each row is a `display: contents` wrapper containing 4 grid cells, optionally followed
   * by `col-span-4` rows for cap-progress bars and cap notes. Backgrounds (warning highlight,
   * section opacity) are applied per-cell because `display: contents` containers do not paint.
   */
  const renderCompactLayout = () => {
    const liquidityWarning = !isReserveLocked && borrowCapExceeded && borrowLimitedByLiquidity;
    const supplySectionClass = '';
    const borrowSectionClass = '';
    const headerCellClass = 'bg-muted/30 border-b border-border/50';
    return (
    <div
      className={`${
        embeddedFromTop
          ? 'rounded-none bg-transparent dark:bg-transparent'
          : 'bg-card/50 dark:bg-background/80 border border-border/60 rounded-xl'
      } overflow-hidden`}
    >
      <div
        role="table"
        aria-label="Simulation breakdown"
        className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-1 w-full min-w-0 ds-text-12 pb-2"
      >
        {/* Header row */}
        <div role="row" className="contents">
          <div role="columnheader" className={`${headerCellClass} py-1 pl-2 pr-0.5 text-left`}>
            <span className="ds-text-11 text-muted-foreground font-medium">{tokenOnChainLabel}</span>
          </div>
          <div role="columnheader" className={`${headerCellClass} py-1 px-0.5 text-right whitespace-nowrap`}>
            <span className="ds-text-11 text-muted-foreground font-medium">Current</span>
          </div>
          <div role="columnheader" className={`${headerCellClass} py-1 px-0.5 text-right whitespace-nowrap`}>
            <span className="ds-text-11 text-muted-foreground font-medium">After</span>
          </div>
          <div role="columnheader" className={`${headerCellClass} py-1 pl-0.5 pr-2 text-right whitespace-nowrap`}>
            <span className="ds-text-11 text-muted-foreground font-medium">Δ</span>
          </div>
        </div>

        {/* Supply section */}
        {supplyRows.map((row) =>
          renderCompactGridRow(
            row,
            'ds-text-emerald-600',
            'border-l-[rgb(var(--ds-emerald-500-rgb))]',
            supplySectionClass,
            Boolean(supplyDisabledNotice),
          ),
        )}

        {/* Spread row */}
        <div role="row" className="contents">
          <div role="cell" className={`py-1 pl-2 pr-0.5 ${!isReserveLocked && middleColumnWarning ? 'ds-bg-warning-row' : ''}`}>
            <span className="ds-text-12 ds-text-purple-600">Spread</span>
          </div>
          <div role="cell" className={`py-1 px-0.5 text-right whitespace-nowrap ${!isReserveLocked && middleColumnWarning ? 'ds-bg-warning-row' : ''}`}>
            <span className="ds-text-11 tabular-nums whitespace-nowrap ds-text-purple-600">{formatSpread(simulation.spread.current)}</span>
          </div>
          <div role="cell" className={`py-1 px-0.5 text-right whitespace-nowrap ${!isReserveLocked && middleColumnWarning ? 'ds-bg-warning-row' : ''}`}>
            <span className={`ds-text-11 tabular-nums whitespace-nowrap ${(isReserveLocked || simulation.spread.after === null) ? 'text-muted-foreground' : 'ds-text-purple-600'}`}>
              {isReserveLocked ? '-' : formatSpread(simulation.spread.after)}
            </span>
          </div>
          <div role="cell" className={`py-1 pl-0.5 pr-2 text-right whitespace-nowrap ${!isReserveLocked && middleColumnWarning ? 'ds-bg-warning-row' : ''}`}>
            {hasScenarioInput && !isReserveLocked ? (
              <span className={`ds-text-11 tabular-nums whitespace-nowrap ${simulation.spread.delta === null ? 'text-muted-foreground' : 'ds-text-purple-600'}`}>
                {formatSpread(simulation.spread.delta)}
              </span>
            ) : null}
          </div>
        </div>

        {/* Liquidity row */}
        <div role="row" className="contents">
          <div role="cell" className={`py-1 pl-2 pr-0.5 ${liquidityWarning ? 'ds-bg-warning-row' : ''}`}>
            <span className={`ds-text-12 ${liquidityWarning ? 'text-amber-700 dark:text-amber-400 font-medium' : 'ds-text-purple-600'}`}>
              Liquidity
            </span>
          </div>
          <div role="cell" className={`py-1 px-0.5 text-right whitespace-nowrap ${liquidityWarning ? 'ds-bg-warning-row' : ''}`}>
            <span className={`ds-text-11 tabular-nums whitespace-nowrap ${liquidityWarning ? 'text-amber-700 dark:text-amber-400' : 'ds-text-purple-600'}`}>
              {formatScenarioSize(simulation.marketMetrics.availableLiquidityUsd, { inputMode, tokenPrice: simulation.tokenPrice })}
            </span>
          </div>
          <div role="cell" className={`py-1 px-0.5 text-right whitespace-nowrap ${liquidityWarning ? 'ds-bg-warning-row' : ''}`}>
            <span className={`ds-text-11 tabular-nums whitespace-nowrap ${
              isReserveLocked || simulation.marketMetrics.availableLiquidityUsdAfter === null
                ? 'text-muted-foreground'
                : liquidityWarning
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'ds-text-purple-600'
            }`}>
              {isReserveLocked ? '-' : formatScenarioSize(simulation.marketMetrics.availableLiquidityUsdAfter, { inputMode, tokenPrice: simulation.tokenPrice })}
            </span>
          </div>
          <div role="cell" className={`py-1 pl-0.5 pr-2 text-right whitespace-nowrap ${liquidityWarning ? 'ds-bg-warning-row' : ''}`}>
            {hasScenarioInput && !isReserveLocked ? (
              <span className={`ds-text-11 tabular-nums whitespace-nowrap ${
                simulation.marketMetrics.availableLiquidityUsdDelta === null
                  ? 'text-muted-foreground'
                  : liquidityWarning
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'ds-text-purple-600'
              }`}>
                {formatScenarioSizeDelta(simulation.marketMetrics.availableLiquidityUsdDelta, { inputMode, tokenPrice: simulation.tokenPrice })}
              </span>
            ) : null}
          </div>
        </div>

        {/* Borrow section */}
        {borrowRows.map((row) =>
          renderCompactGridRow(
            row,
            'ds-text-brand-cyan',
            'border-l-[rgb(var(--ds-brand-cyan-rgb))]',
            borrowSectionClass,
            Boolean(borrowDisabledNotice),
          ),
        )}
      </div>
    </div>
    );
  };

  /** Map rowKey "supply-*" ↔ "borrow-*" to find the corresponding peer row. */
  const findPeerRow = (rowKey: string, peerRows: TableRow[]): TableRow | undefined => {
    const peerKey = rowKey.startsWith('supply-')
      ? rowKey.replace('supply-', 'borrow-')
      : rowKey.startsWith('borrow-')
        ? rowKey.replace('borrow-', 'supply-')
        : null;
    return peerKey ? peerRows.find((r) => r.rowKey === peerKey) : undefined;
  };

  const renderTable = (
    title: string,
    rows: TableRow[],
    accentClass: string,
    borderClass: string,
    indentBorderClass: string,
    isWarning?: boolean,
    peerRows?: TableRow[],
    disabledNotice?: string | null,
  ) => (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/50 bg-card">
      <table className="w-full min-w-0 table-fixed">
        <colgroup>
          <col style={{ width: '44%' }} />
          <col style={{ width: '19%' }} />
          <col style={{ width: '19%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr className="bg-muted/30 border-b border-border/50">
            <th className="px-4 py-1.5 text-left">
              <span className={`ds-text-13 font-semibold ${accentClass}`}>{title}</span>
            </th>
            <th className="px-3 py-1.5 text-right">
              <span className="ds-text-11 text-muted-foreground">Current</span>
            </th>
            <th className="px-3 py-1.5 text-right">
              <span className="ds-text-11 text-muted-foreground">After</span>
            </th>
            <th className="px-4 py-1.5 text-right">
              <span className="ds-text-11 text-muted-foreground">Δ</span>
            </th>
          </tr>
        </thead>
        <tbody className={`[&>tr:last-child>td]:pb-2`}>
          {rows.map((row) => {
            const peer = peerRows ? findPeerRow(row.rowKey, peerRows) : undefined;
            const peerHasCapBar = peer != null && peer.cap != null && peer.type === 'usd';
            const peerHasCapNote = Boolean(peer?.notes?.length);
            const peerCapInfo = peerHasCapBar || peerHasCapNote
              ? { hasCapBar: peerHasCapBar, hasCapNote: peerHasCapNote, capNoteText: peer?.notes?.[0]?.text }
              : undefined;
            return renderRow(row, accentClass, indentBorderClass, false, peerCapInfo, undefined, Boolean(disabledNotice));
          })}
        </tbody>
      </table>
    </div>
  );

  // Middle column warning flag (reused in inline bar)
  const middleColumnWarning = borrowCapExceeded && borrowLimitedByLiquidity;

  const showHeaderBlock = showEmptyStateNote;
  const scenarioAccrual = simulation.scenarioUsdAccrual;
  const supplyDesktopAlignSignature = supplyRows
    .map((row) => `${row.rowKey}:${row.cap != null ? '1' : '0'}:${row.notes?.[0]?.text ?? ''}`)
    .join('|');
  const borrowDesktopAlignSignature = borrowRows
    .map((row) => `${row.rowKey}:${row.cap != null ? '1' : '0'}:${row.notes?.[0]?.text ?? ''}`)
    .join('|');

  useEffect(() => {
    if (effectiveCompact) return;
    const grid = gridRef.current;
    if (!grid) return;

    const clearSyncedHeights = () => {
      grid.querySelectorAll<HTMLTableRowElement>('tr[data-align-key]').forEach((row) => {
        row.style.removeProperty('height');
      });
    };

    const syncDesktopBandHeights = () => {
      const rows = Array.from(grid.querySelectorAll<HTMLTableRowElement>('tr[data-align-key]'));
      if (rows.length === 0) return;

      clearSyncedHeights();

      const byAlignKey = new Map<string, HTMLTableRowElement[]>();
      rows.forEach((row) => {
        const alignKey = row.dataset.alignKey;
        if (!alignKey) return;
        const bucket = byAlignKey.get(alignKey);
        if (bucket) {
          bucket.push(row);
        } else {
          byAlignKey.set(alignKey, [row]);
        }
      });

      byAlignKey.forEach((groupRows) => {
        if (groupRows.length <= 1) return;
        const maxHeight = groupRows.reduce((max, row) => Math.max(max, row.getBoundingClientRect().height), 0);
        if (!Number.isFinite(maxHeight) || maxHeight <= 0) return;
        const rounded = Math.ceil(maxHeight);
        groupRows.forEach((row) => {
          row.style.height = `${rounded}px`;
        });
      });
    };

    let rafId: number | null = null;
    const scheduleSync = () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        syncDesktopBandHeights();
      });
    };

    scheduleSync();
    window.addEventListener('resize', scheduleSync);

    return () => {
      window.removeEventListener('resize', scheduleSync);
      if (rafId != null) cancelAnimationFrame(rafId);
      clearSyncedHeights();
    };
  }, [effectiveCompact, supplyDesktopAlignSignature, borrowDesktopAlignSignature, scenarioAccrual]);

  const renderEarnCostTable = () => {
    // Token price from reserve directly (simulation.tokenPrice is derived from the same source via tokenPrices index)
    const tokenPrice =
      reserve.tokenPrice != null && Number.isFinite(reserve.tokenPrice) && reserve.tokenPrice > 0
        ? reserve.tokenPrice
        : null;
    const fmt = (value: number | null) =>
      formatSignedScenarioDailyCashflow(value, { inputMode, tokenPrice });
    const supplyPrincipal = simulation.supply.inputUsd;
    const borrowPrincipal = simulation.borrow.inputUsd;
    const hasSupply = supplyPrincipal > 0;
    const hasBorrow = borrowPrincipal > 0;
    const accrual = scenarioAccrual;

    interface EarnCostRow {
      key: string;
      label: string;
      earn: number | null;
      cost: number | null;
      isNet?: boolean;
      isTotal?: boolean;
      isBreakdown?: boolean;
      isSubBreakdown?: boolean;
      href?: string | null;
      hasCapSpacer?: boolean;
      hasNoteSpacer?: boolean;
      notePlaceholder?: string;
      capWarning?: boolean;
    }

    const getLongestNote = (notes: Array<string | undefined>) => {
      const valid = notes.filter((note): note is string => Boolean(note && note.trim().length > 0));
      if (valid.length === 0) return undefined;
      return valid.reduce((longest, current) => (current.length > longest.length ? current : longest));
    };

    const supplyRowByKey = new Map(supplyRows.map((row) => [row.rowKey, row]));
    const borrowRowByKey = new Map(borrowRows.map((row) => [row.rowKey, row]));

    const getBandMeta = (supplyKey: string, borrowKey: string) => {
      const supplyRow = supplyRowByKey.get(supplyKey);
      const borrowRow = borrowRowByKey.get(borrowKey);
      return {
        hasCapSpacer: supplyRow?.cap != null || borrowRow?.cap != null,
        hasNoteSpacer: Boolean(supplyRow?.notes?.length || borrowRow?.notes?.length),
        notePlaceholder: getLongestNote([supplyRow?.notes?.[0]?.text, borrowRow?.notes?.[0]?.text]),
        capWarning: Boolean(supplyRow?.warning || borrowRow?.warning),
        maxCap: Math.max(supplyRow?.cap ?? 0, borrowRow?.cap ?? 0),
      };
    };

    const sizeBandMeta = getBandMeta('supply-size', 'borrow-size');
    const amountBandMeta = getBandMeta('supply-total-rate', 'borrow-total-rate');
    const nativeBandMeta = getBandMeta('supply-native', 'borrow-native');
    const incentiveBandMeta = getBandMeta('supply-incentive-total', 'borrow-incentive-total');
    const hasNativeBand = supplyRowByKey.has('supply-native') || borrowRowByKey.has('borrow-native');
    const hasIncentiveBand =
      supplyRowByKey.has('supply-incentive-total') || borrowRowByKey.has('borrow-incentive-total');

    const rows: EarnCostRow[] = [
      {
        key: 'net',
        label: 'Net',
        earn: null,
        cost: null,
        isNet: true,
        hasCapSpacer: sizeBandMeta.hasCapSpacer,
        hasNoteSpacer: sizeBandMeta.hasNoteSpacer,
        notePlaceholder: sizeBandMeta.notePlaceholder,
        capWarning: false,
      },
      {
        key: 'amount',
        label: 'Amount',
        earn: accrual?.supply?.totalUsdPerDay ?? null,
        cost: accrual?.borrow?.totalUsdPerDay ?? null,
        isTotal: true,
        hasCapSpacer: amountBandMeta.hasCapSpacer,
        hasNoteSpacer: amountBandMeta.hasNoteSpacer,
        notePlaceholder: amountBandMeta.notePlaceholder,
        capWarning: amountBandMeta.capWarning,
      },
      ...(hasNativeBand
        ? [
            {
              key: 'native',
              label: 'Native',
              earn: accrual?.supply?.nativeUsdPerDay ?? null,
              cost: accrual?.borrow?.nativeUsdPerDay ?? null,
              isBreakdown: true,
              href: aaveUrl,
              hasCapSpacer: nativeBandMeta.hasCapSpacer,
              hasNoteSpacer: nativeBandMeta.hasNoteSpacer,
              notePlaceholder: nativeBandMeta.notePlaceholder,
              capWarning: nativeBandMeta.capWarning,
            } as EarnCostRow,
          ]
        : []),
      ...(hasIncentiveBand
        ? [
            {
              key: 'incentive',
              label: 'Incentive',
              earn: accrual?.supply?.incentiveUsdPerDay ?? null,
              cost: accrual?.borrow?.incentiveUsdPerDay ?? null,
              isBreakdown: true,
              href: earnCostIncentiveJumpHref,
              hasCapSpacer: incentiveBandMeta.hasCapSpacer,
              hasNoteSpacer: incentiveBandMeta.hasNoteSpacer,
              notePlaceholder: incentiveBandMeta.notePlaceholder,
              capWarning: incentiveBandMeta.capWarning,
            } as EarnCostRow,
          ]
        : []),
    ];

    const sizeCapPlaceholder = formatScenarioSize(sizeBandMeta.maxCap, {
      inputMode,
      tokenPrice: simulation.tokenPrice,
    });

    const cellPy = effectiveCompact ? 'py-0.5' : 'py-1';
    const metricPx = effectiveCompact ? 'px-3' : 'px-4';
    const valuePx = effectiveCompact ? 'px-2.5' : 'px-3';
    const capRowPb = effectiveCompact ? 'pb-0.5' : 'pb-1';

    const rowBandByKey: Readonly<Partial<Record<EarnCostRow['key'], DesktopAlignBand>>> = {
      net: 'size',
      amount: 'total-rate',
      native: 'native',
      incentive: 'incentive-total',
    };

    const renderBandSpacerRows = (row: EarnCostRow, noteIndentClass = '') => {
      const alignBand = rowBandByKey[row.key];
      const capAlignKey = getDesktopAlignKey(alignBand, 'cap');
      const noteAlignKey = getDesktopAlignKey(alignBand, 'note');
      return (
      <>
        {row.hasCapSpacer ? (
          <tr data-align-key={capAlignKey} aria-hidden className={row.capWarning ? 'ds-bg-warning-row' : ''}>
            <td colSpan={3} className={`pt-0 pb-1 ${valuePx}`}>
              <div className="relative h-1.5 w-full rounded-full bg-muted/40 opacity-0" />
              {/* Invisible text placeholder matching note spacer row height (AAV-1121).
                  Uses the same class pattern as the note spacer's <p> so both spacer
                  types have consistent row heights without magic numbers. */}
              <p className={`ds-text-11 min-w-0 w-full max-w-none whitespace-normal break-words leading-snug text-transparent select-none ${noteIndentClass}`}>
                {row.notePlaceholder ?? '.'}
              </p>
            </td>
          </tr>
        ) : null}
        {row.hasNoteSpacer ? (
          <tr data-align-key={noteAlignKey} aria-hidden className={row.capWarning ? 'ds-bg-warning-row' : ''}>
            <td colSpan={3} className={`pt-0 ${capRowPb} ${metricPx} min-w-0 align-top`}>
              <p
                className={`ds-text-11 min-w-0 w-full max-w-none whitespace-normal break-words leading-snug text-transparent select-none ${noteIndentClass}`}
              >
                {row.notePlaceholder ?? '.'}
              </p>
            </td>
          </tr>
        ) : null}
      </>
      );
    };

    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/50 bg-card w-full">
        <table className="w-full min-w-0 table-fixed">
          <colgroup>
            <col style={{ width: '52%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '24%' }} />
          </colgroup>
          <thead>
            <tr className="bg-muted/30 border-b border-border/50">
              <th className="px-4 py-1.5 text-left">
                <span className={`ds-text-13 font-semibold ${EARN_NEUTRAL_TEXT_CLASS} whitespace-nowrap`}>
                  Earn /day
                </span>
              </th>
              <th className="px-3 py-1.5 text-right">
                <span className="ds-text-11 ds-text-emerald-600 font-semibold">Supply</span>
              </th>
              <th className="px-3 py-1.5 text-right">
                <span className="ds-text-11 ds-text-brand-cyan font-semibold">Borrow</span>
              </th>
            </tr>
          </thead>
          <tbody className="ds-text-12 [&>tr:last-child>td]:pb-2">
            {rows.map((row) => {
              const alignBand = rowBandByKey[row.key];
              const mainAlignKey = getDesktopAlignKey(alignBand, 'main');
              // Special: Net row
              if (row.isNet) {
                return (
                  <Fragment key={row.key}>
                    <tr data-align-key={mainAlignKey} className={row.capWarning ? 'ds-bg-warning-row' : ''}>
                      <td className={`${cellPy} ${metricPx} min-w-0 align-middle`}>
                        <div className="grid min-w-0" style={{ gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}>
                          {/* Visible: Net label + value */}
                          <div
                            className={`flex items-baseline gap-x-2 min-w-0 ${row.hasCapSpacer ? 'translate-y-[6px]' : ''}`}
                            style={{ gridArea: '1/1' }}
                          >
                            <span className="ds-text-16 font-bold ds-text-purple-600 break-words">{row.label}</span>
                            <span className="ds-text-16 tabular-nums font-bold ds-text-purple-600 flex-shrink-0">
                              {accrual?.netUsdPerDay != null ? fmt(accrual.netUsdPerDay) : '-'}
                            </span>
                          </div>
                          {/* Invisible height reference: mirrors Supply/Borrow "Total / Cap $X" label to match wrap height */}
                          {row.hasCapSpacer ? (
                            <div className="invisible select-none flex flex-wrap items-start gap-x-1.5 gap-y-0.5 min-w-0" style={{ gridArea: '1/1' }} aria-hidden>
                              <span className="ds-text-12">{row.label}</span>
                              <span className="ds-text-11 tabular-nums flex-shrink-0">
                                / Cap {sizeCapPlaceholder}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className={`${cellPy} ${valuePx}`} />
                      <td className={`${cellPy} ${valuePx}`} />
                    </tr>
                    {renderBandSpacerRows(row)}
                  </Fragment>
                );
              }

              // Data rows: Amount / Native / Incentive
              const indentClass = row.isSubBreakdown
                ? 'ml-4 pl-2 border-l border-l-foreground/80'
                : row.isBreakdown
                  ? 'ml-2 pl-2 border-l border-l-foreground/80'
                  : '';
              const capNoteAlignClass = row.isSubBreakdown ? 'pl-6' : row.isBreakdown ? 'pl-4' : '';
              const fontClass = row.key === 'amount' ? '' : row.isTotal ? 'font-semibold' : row.isBreakdown ? '' : 'font-medium';
              const textClass = EARN_NEUTRAL_TEXT_CLASS;
              const sizeClass = 'ds-text-12';
              const labelCellPy = row.hasNoteSpacer ? `${effectiveCompact ? 'pt-0.5 pb-0' : 'pt-1 pb-0'}` : cellPy;
              const valueCellPy = row.hasNoteSpacer ? `${effectiveCompact ? 'pt-0.5 pb-0' : 'pt-1 pb-0'}` : cellPy;

              return (
                <Fragment key={row.key}>
                  <tr data-align-key={mainAlignKey} className={row.capWarning ? 'ds-bg-warning-row' : ''}>
                    <td className={`${labelCellPy} ${metricPx} min-w-0 align-top`}>
                      <div className={`min-w-0 ${indentClass}`}>
                        {row.href ? (
                          <a
                            href={row.href}
                            {...externalLinkTabProps(isMobile)}
                            onClick={(e) => e.stopPropagation()}
                            className={`${sizeClass} ${fontClass} flex items-center gap-1 break-words ${textClass} hover:opacity-90`}
                          >
                            <span className="break-words">{row.label}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                          </a>
                        ) : (
                          <span className={`${sizeClass} ${fontClass} ${textClass} break-words`}>{row.label}</span>
                        )}
                      </div>
                    </td>
                    <td className={`${valueCellPy} ${valuePx} text-right align-top`}>
                      <span className={`${sizeClass} tabular-nums ${fontClass} ${hasSupply ? 'ds-text-emerald-600' : EARN_NEUTRAL_TEXT_CLASS}`}>
                        {row.earn !== null ? fmt(row.earn) : '-'}
                      </span>
                    </td>
                    <td className={`${valueCellPy} ${valuePx} text-right align-top`}>
                      <span className={`${sizeClass} tabular-nums ${fontClass} ${hasBorrow ? 'ds-text-brand-cyan' : EARN_NEUTRAL_TEXT_CLASS}`}>
                        {row.cost !== null ? fmt(row.cost) : '-'}
                      </span>
                    </td>
                  </tr>
                  {renderBandSpacerRows(row, capNoteAlignClass)}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`min-w-0 ${effectiveCompact ? 'p-0' : 'p-0'}`}>
      {hasDisabledState ? (
        <div className={`flex items-center gap-3 rounded-lg ${
          reserve.isPaused || reserve.isActive === false
            ? 'border border-[rgb(var(--ds-paused-rgb)/0.6)] ds-bg-critical-row'
            : reserve.isFrozen
              ? 'border border-sky-400/60 bg-sky-50/80 dark:bg-sky-950/30'
              : 'border border-muted-foreground/20 bg-muted/40'
        } ${effectiveCompact ? 'mb-2 px-3 py-1.5' : 'mb-3 px-4 py-2'}`}>
          {reserve.isPaused ? (
            <PauseCircle className="w-4 h-4 ds-text-paused shrink-0" />
          ) : reserve.isActive === false ? (
            <Ban className="w-4 h-4 ds-text-paused shrink-0" />
          ) : reserve.isFrozen ? (
            <Snowflake className="w-4 h-4 text-sky-500 shrink-0" />
          ) : (
            <Ban className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <p className={`flex-1 ds-text-12 ${
            reserve.isPaused
              ? 'text-amber-800 dark:text-amber-300'
              : reserve.isActive === false
                ? 'text-amber-800 dark:text-amber-300'
                : reserve.isFrozen
                  ? 'text-sky-800 dark:text-sky-300'
                  : 'text-muted-foreground'
          }`}>
            {reserve.isPaused
              ? 'Paused: all reserve actions are halted.'
              : reserve.isActive === false
                ? 'Inactive: the reserve is not active.'
                : reserve.isFrozen
                  ? 'Frozen: deposits and borrows temporarily disabled; exits allowed.'
                  : supplySideBlocked && borrowSideBlocked
                    ? 'Supply and borrow are disabled for this reserve.'
                    : supplySideBlocked
                      ? 'Supply is disabled for this reserve.'
                      : 'Borrow is disabled for this reserve.'}
          </p>
        </div>
      ) : showHeaderBlock ? (
        <div
        className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${
          effectiveCompact ? (embeddedFromTop ? 'mb-2 px-0' : 'mb-2 px-1') : 'mb-3 px-1'
        }`}
      >
          <span className={`ds-text-12 ${SIM_NEUTRAL_SECONDARY}`}>
            Enter supply or borrow amount above to see simulated values.
          </span>
        </div>
      ) : null}
      {!showEmptyStateNote && (
        <div className={`${effectiveCompact ? 'mb-2' : 'mb-3'} ${effectiveCompact && embeddedFromTop ? 'px-0' : 'px-1'}`}>
          <p className={`ds-text-11 ${SIM_NEUTRAL_SECONDARY}`}>
            {isMobile
              ? 'Simulation only.'
              : 'Simulation is for reference only. Final result depends on on-chain execution.'}
          </p>
        </div>
      )}

      {/* Warnings + Tables */}
          {simulation.supply.hasInput && showSupplyCapWarning && (
        <div className={`flex items-center gap-3 rounded-lg border border-[rgb(var(--ds-amber-500-rgb)/0.6)] ds-bg-critical-row ${effectiveCompact ? 'mb-2 px-3 py-1.5' : 'mb-3 px-4 py-2'}`}>
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="flex-1 ds-text-12 text-amber-800 dark:text-amber-300">
            {simulation.supply.hasInput && supplyCapExceeded ? (
              <>{formatProtocolCapText({ side: 'supply', availableFormatted: formatScenarioSize(availableSupplyRoomUsd, { inputMode, tokenPrice: simulation.tokenPrice }) })}</>
            ) : (
              <>{formatProtocolCapText({ side: 'supply', availableFormatted: formatScenarioSize(availableSupplyRoomUsd, { inputMode, tokenPrice: simulation.tokenPrice }), currentExceeded: true })}</>
            )}
          </p>
          {simulation.supply.hasInput &&
            onCorrectSupplyInput &&
            availableSupplyRoomUsd !== null &&
            availableSupplyRoomUsd >= 0 && (
            <button type="button" onClick={handleCorrectToMaxSupply} className="ds-btn-warning ds-text-11 px-3 py-1">
              Adjust to max
            </button>
            )}
        </div>
      )}

      {simulation.borrow.hasInput && showBorrowCapWarning && (
        <div className={`flex items-center gap-3 rounded-lg border border-[rgb(var(--ds-amber-500-rgb)/0.6)] ds-bg-critical-row ${effectiveCompact ? 'mb-2 px-3 py-1.5' : 'mb-3 px-4 py-2'}`}>
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="flex-1 ds-text-12 text-amber-800 dark:text-amber-300">
            {simulation.borrow.hasInput && borrowCapExceeded ? (
              <>{formatProtocolCapText({ side: 'borrow', availableFormatted: formatScenarioSize(availableBorrowRoomUsd, { inputMode, tokenPrice: simulation.tokenPrice }), limitedByLiquidity: borrowLimitedByLiquidity })}</>
            ) : (
              <>{formatProtocolCapText({ side: 'borrow', availableFormatted: formatScenarioSize(availableBorrowRoomUsd, { inputMode, tokenPrice: simulation.tokenPrice }), limitedByLiquidity: borrowLimitedByLiquidity, currentExceeded: true })}</>
            )}
          </p>
          {simulation.borrow.hasInput &&
            onCorrectBorrowInput &&
            availableBorrowRoomUsd !== null &&
            availableBorrowRoomUsd >= 0 && (
            <button type="button" onClick={handleCorrectToMaxBorrow} className="ds-btn-warning ds-text-11 px-3 py-1">
              Adjust to max
            </button>
          )}
        </div>
      )}

      {/* Layout: compact = single table; desktop = spread/liquidity bar + 3 columns */}
      {effectiveCompact ? (
        renderCompactLayout()
      ) : (
        <>
          {/* Spread + Liquidity summary bar */}
          <div className="flex items-center gap-4 mb-2 px-4 py-1.5 rounded-lg border border-border/50 bg-card">
            <div className="flex items-center gap-1.5">
              <span className="ds-text-12 font-bold ds-text-purple-600">Spread</span>
              <span className="ds-text-12 tabular-nums ds-text-purple-600">
                {formatSpread(simulation.spread.current)}
                {simulation.spread.after !== null && (
                  <>
                    <span className={`${SIM_NEUTRAL_SECONDARY} mx-1`}>→</span>
                    {formatSpread(simulation.spread.after)}
                  </>
                )}
              </span>
              {hasScenarioInput ? (
                <span className="inline-flex items-center gap-1 pl-1">
                  <span className={`ds-text-11 ${SIM_NEUTRAL_SECONDARY}`}>Δ</span>
                  <span className={`ds-text-11 tabular-nums ${simulation.spread.delta === null ? SIM_NEUTRAL_MUTED : 'ds-text-purple-600'}`}>
                    {formatSpread(simulation.spread.delta)}
                  </span>
                </span>
              ) : null}
            </div>
            <div className="w-px h-4 bg-border/60" />
            <div className="flex items-center gap-1.5">
              <span className={`ds-text-12 font-bold ${middleColumnWarning ? 'text-amber-700 dark:text-amber-400' : 'ds-text-purple-600'}`}>Liquidity</span>
              <span className={`ds-text-12 tabular-nums ${middleColumnWarning ? 'text-amber-700 dark:text-amber-400' : 'ds-text-purple-600'}`}>
                {formatScenarioSize(simulation.marketMetrics.availableLiquidityUsd, { inputMode, tokenPrice: simulation.tokenPrice })}
                {simulation.marketMetrics.availableLiquidityUsdAfter !== null && (
                  <>
                    <span className={`${SIM_NEUTRAL_SECONDARY} mx-1`}>→</span>
                    {formatScenarioSize(simulation.marketMetrics.availableLiquidityUsdAfter, { inputMode, tokenPrice: simulation.tokenPrice })}
                  </>
                )}
              </span>
              {hasScenarioInput ? (
                <span className="inline-flex items-center gap-1 pl-1">
                  <span className={`ds-text-11 ${SIM_NEUTRAL_SECONDARY}`}>Δ</span>
                  <span
                    className={`ds-text-11 tabular-nums ${
                      simulation.marketMetrics.availableLiquidityUsdDelta === null
                        ? SIM_NEUTRAL_MUTED
                        : middleColumnWarning
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'ds-text-purple-600'
                    }`}
                  >
                    {normalizeToAfterPlaceholder(
                      formatScenarioSizeDelta(simulation.marketMetrics.availableLiquidityUsdDelta, { inputMode, tokenPrice: simulation.tokenPrice })
                    )}
                  </span>
                </span>
              ) : null}
            </div>
          </div>

          {/* Supply + Borrow + Earn/Cost 3-column grid */}
          <div
            ref={gridRef}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_clamp(14.5rem,24.5vw,18rem)] gap-2 min-w-0 items-stretch overflow-hidden"
          >
            <div data-disabled={supplySideBlocked ? 'true' : undefined} className="group flex min-w-0 flex-col overflow-hidden">
              {renderTable('Supply', supplyRows, 'ds-text-emerald-600', 'border-emerald-500/40', 'border-l-[rgb(var(--ds-emerald-500-rgb))]', showSupplyCapWarning, borrowRows, supplyDisabledNotice)}
            </div>
            <div data-disabled={borrowSideBlocked ? 'true' : undefined} className="group flex min-w-0 flex-col overflow-hidden">
              {renderTable('Borrow', borrowRows, 'ds-text-brand-cyan', 'border-[rgb(var(--ds-brand-cyan-rgb))]/40', 'border-l-[rgb(var(--ds-brand-cyan-rgb))]', showBorrowCapWarning, supplyRows, borrowDisabledNotice)}
            </div>
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden self-stretch">
              {renderEarnCostTable()}
            </div>
          </div>
        </>
      )}

      {/* Footer notes */}
      {(simulation.forecastLoading || showPriceMissingNotice || ((simulation.supply.hasInput || simulation.borrow.hasInput) && simulation.forecastUnavailableCampaignCount > 0)) && (
        <div className={`mt-3 space-y-1 ${effectiveCompact && embeddedFromTop ? 'px-0' : 'px-1'}`}>
          {simulation.forecastLoading && <p className="ds-text-11 text-muted-foreground">Loading Merkl forecast...</p>}
          {showPriceMissingNotice && (
            <p className="ds-text-11 text-muted-foreground">Price unavailable for {reserve.tokenSymbol}; using current supply for forecast.</p>
          )}
          {!simulation.forecastLoading && (simulation.supply.hasInput || simulation.borrow.hasInput) && simulation.forecastUnavailableCampaignCount > 0 && (
            <p className="ds-text-11 text-muted-foreground">
              * No forecast data — using current APR.
            </p>
          )}
        </div>
      )}

      {/* Bottom of scrollable simulation stack — used by E2E to detect inner-pane clipping */}
      <div data-reserves-simulation-bottom-sentinel aria-hidden className="h-px w-full shrink-0" />
    </div>
  );
};

export default SimulationSubRow;
