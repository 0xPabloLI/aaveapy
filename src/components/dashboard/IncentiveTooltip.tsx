import { useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink } from 'lucide-react';
import { useTheme } from 'next-themes';
import { ReserveWithSpread, MeritIncentive, MerklOpportunityGroup, BrevisIncentive } from '@/types/aave';
import {
  formatPercent,
  convertAprToApy,
  isMerklWhitelistBreakdownIncluded,
  MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL,
  MERKL_WHITELIST_TOGGLE_ARIA,
  MERKL_WHITELIST_TOGGLE_LABEL,
} from '@/lib/formatters';
import { getMerklBreakdownApr, forecastBreakdownApr, sanitizePercent } from '@/lib/merklForecast';
import type { MerklForecastWireItem } from '@/types/aave';
import { splitMeritMessageBySelfAuth } from '@/lib/meritForecast';
import {
  getBrevisCampaignApr,
  getBrevisCampaignBreakdowns,
  getBrevisDisplayLabel,
  getBrevisCampaignEndedAt,
  getBrevisCampaignMessage,
  getBrevisCampaignStartedAt,
} from '@/lib/brevis';
import { adjustTooltipAnchorForScroll, getWindowScroll } from '@/lib/tooltipPosition';
import { CalloutArrowSvg } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import BottomSheet from './BottomSheet';
import { externalLinkTabProps } from '@/lib/externalNavigation';
import { DS_NATIVE_CHECKBOX_CLASS } from '@/lib/dsNativeCheckbox';

interface IncentiveTooltipProps {
  reserve: ReserveWithSpread;
  type: 'supply' | 'borrow';
  position: { x: number; y: number };
  triggerCenterX: number;
  triggerHeight?: number;
  triggerRect?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  };
  onClose: () => void;
  isApy?: boolean;
  usePortal?: boolean;
  accentBorderClass?: string;
  accentTextClass?: string;
  accentBgClass?: string;
  tydroPointToUsdRate: number;
  whitelistMerklCampaignIds: ReadonlySet<string>;
  onToggleWhitelistMerklCampaign: (campaignId: string, enabled: boolean) => void;
  forecastStates?: Record<string, MerklForecastWireItem>;
}

interface IncentiveSource {
  name: string;
  value: number;
  color: string;
  bgColor: string;
  sourceType?: 'Protocol' | 'ACI' | 'Merkl' | 'Brevis';
  link?: string;
  dateRange?: string;
  message?: string | Record<string, unknown> | unknown[];
  requiredTokens?: string[] | string;
  campaigns?: Array<{
    value: number;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    message?: string | Record<string, unknown> | unknown[];
    campaignId?: string;
    sourceType?: IncentiveSource['sourceType'];
    whitelistOnly?: boolean;
    included?: boolean;
    rawValue?: number;
  }>;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseCampaignBoundaryMs = (value: string | undefined, boundary: 'start' | 'end'): number | null => {
  if (!value) return null;
  if (DATE_ONLY_PATTERN.test(value)) {
    const normalized = boundary === 'start' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`;
    const timestamp = Date.parse(normalized);
    return Number.isNaN(timestamp) ? null : timestamp;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const isCampaignActive = (
  startDate: string | undefined,
  endDate: string | undefined,
  nowMs = Date.now(),
  allowOpenEnd = false,
): boolean => {
  const startMs = parseCampaignBoundaryMs(startDate, 'start');
  if (startMs === null || nowMs < startMs) return false;
  const endMs = parseCampaignBoundaryMs(endDate, 'end');
  if (endMs === null) return allowOpenEnd;
  return nowMs <= endMs;
};

const lightSourceIconMap: Record<NonNullable<IncentiveSource['sourceType']>, string> = {
  Protocol: '/icons/tokens/aave.svg',
  Brevis: '/icons/partners/brevis-black.svg',
  Merkl: '/icons/partners/merkl-black.svg',
  ACI: '/icons/partners/aci-black.svg',
};

const darkSourceIconMap: Record<NonNullable<IncentiveSource['sourceType']>, string> = {
  Protocol: '/icons/tokens/aave.svg',
  Brevis: '/icons/partners/brevis-white.svg',
  Merkl: '/icons/partners/merkl-white.svg',
  ACI: '/icons/partners/aci-white.svg',
};

const getSourceIcon = (
  sourceType?: IncentiveSource['sourceType'],
  isDark?: boolean
) => {
  if (!sourceType || sourceType === 'Protocol') return null;
  const map = isDark ? darkSourceIconMap : lightSourceIconMap;
  return map[sourceType];
};

const IncentiveTooltip = ({
  reserve,
  type,
  position,
  triggerCenterX,
  triggerHeight,
  triggerRect,
  onClose,
  isApy = true,
  usePortal = false,
  accentBorderClass,
  accentTextClass,
  accentBgClass,
  tydroPointToUsdRate,
  whitelistMerklCampaignIds,
  onToggleWhitelistMerklCampaign,
  forecastStates,
}: IncentiveTooltipProps) => {
  const { resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [arrowLeft, setArrowLeft] = useState(0);
  const [tooltipLeft, setTooltipLeft] = useState<number | null>(null);
  const [tooltipTop, setTooltipTop] = useState<number | null>(null);
  const [tooltipPlacement, setTooltipPlacement] = useState<'top' | 'bottom'>('bottom');
  const [showTooltipArrow, setShowTooltipArrow] = useState(true);
  const [openedAtScroll, setOpenedAtScroll] = useState(() => getWindowScroll());
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  const numberMatch = /^(\d+(?:\.\d+)?%?)$/;
  const currencyMatch = /^[€$£¥]$/;
  const highlightMatch = /^([€$£¥]?\d+(?:\.\d+)?%?|[€$£¥])$/;
  type MessageLine = { text: string; emphasizePrefix?: boolean };
  const renderHighlightedText = (text: string) => (
    <>
      {text.split(/([€$£¥]?\d+(?:\.\d+)?%?|[€$£¥])/g).map((part, index) =>
        highlightMatch.test(part) && (numberMatch.test(part) || currencyMatch.test(part) || /^[€$£¥]\d/.test(part)) ? (
          <span key={`num-${index}`} className="font-semibold text-foreground">
            {part}
          </span>
        ) : (
          <span key={`txt-${index}`}>{part}</span>
        )
      )}
    </>
  );
  const renderMessageLine = (line: MessageLine, accentClass: string) => {
    if (!line.emphasizePrefix) return renderHighlightedText(line.text);
    const colonIndex = line.text.indexOf(':');
    if (colonIndex === -1) return renderHighlightedText(line.text);
    const prefix = line.text.slice(0, colonIndex + 1);
    const rest = line.text.slice(colonIndex + 1).trimStart();
    return (
      <>
        <span className={`font-semibold ${accentClass}`}>{prefix}</span>
        {rest ? <span className="ml-1">{renderHighlightedText(rest)}</span> : null}
      </>
    );
  };
  // Format date for display (e.g., "Jan 7, 2026"), safe for invalid values
  const formatDate = (dateString?: string): string | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatDateRange = (start?: string, end?: string): string | null => {
    const startText = formatDate(start);
    const endText = formatDate(end);
    if (!startText || !endText) return null;
    return `${startText} - ${endText}`;
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  };

  const getMessageLines = (message?: string | Record<string, unknown> | unknown[]): MessageLine[] => {
    if (!message) return [];
    const filterLines = (lines: MessageLine[]) =>
      lines.filter((line) => !line.text.toLowerCase().includes('require_multiple'));
    if (typeof message === 'string') return filterLines([{ text: message }]);
    if (Array.isArray(message)) {
      return filterLines(
        message
          .map((item) => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item) {
              const values = Object.values(item as Record<string, unknown>)
                .map((entry) => formatValue(entry))
                .filter(Boolean);
              return values.length > 0
                ? { text: values.join(': '), emphasizePrefix: values.length > 1 }
                : '';
            }
            return '';
          })
          .filter(Boolean)
          .map((item) => (typeof item === 'string' ? { text: item } : item))
      );
    }
    const values = Object.values(message)
      .map((entry) => formatValue(entry))
      .filter(Boolean);
    if (values.length === 0) return [];
    return filterLines([{ text: values.join(': '), emphasizePrefix: values.length > 1 }]);
  };

  const accentClass =
    accentBorderClass ??
    (type === 'supply'
      ? 'border-l-[3px] border-l-[rgb(var(--ds-emerald-500-rgb))]'
      : 'border-l-[3px] border-l-[rgb(var(--ds-brand-cyan-rgb))]');
  const valueAccentClass =
    accentTextClass ?? (type === 'supply' ? 'ds-text-emerald-600' : 'ds-text-brand-cyan');
  const valueBgClass =
    accentBgClass ?? (type === 'supply' ? 'ds-bg-emerald-500-10' : 'ds-bg-brand-cyan-10');
  const isDark = resolvedTheme === 'dark';
  const tooltipSurfaceStyle = {
    backgroundColor: 'hsl(var(--card))',
    backgroundImage: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card)))',
  } as const;

  const getMerklLink = (opportunity: MerklOpportunityGroup): string | undefined => {
    return opportunity.link;
  };

  const buildSourceGroupKey = (source: IncentiveSource): string => {
    return `${source.sourceType ?? 'Unknown'}|${source.name}|${source.link ?? ''}`;
  };

  const groupIncentiveSources = (sources: IncentiveSource[]): IncentiveSource[] => {
    const grouped = new Map<string, IncentiveSource>();

    sources.forEach((source) => {
      const key = buildSourceGroupKey(source);
      const campaigns = source.campaigns ?? [{ value: source.value, dateRange: source.dateRange, message: source.message, sourceType: source.sourceType }];
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, { ...source, campaigns: [...campaigns] });
        return;
      }

      existing.value += source.value;
      existing.campaigns = [...(existing.campaigns ?? []), ...campaigns];
    });

    return Array.from(grouped.values());
  };

  useEffect(() => {
    setOpenedAtScroll(getWindowScroll());
  }, [position.x, position.y, triggerCenterX, type]);

  // Get detailed incentive sources (unified layout)
  const getIncentiveSources = (): IncentiveSource[] => {
    const sources: IncentiveSource[] = [];

    // Protocol incentives (number array)
    const protocolIncentives = type === 'supply' ? reserve.supplyIncentives : reserve.borrowIncentives;
    if (protocolIncentives && Array.isArray(protocolIncentives) && protocolIncentives.length > 0) {
      const totalProtocol = protocolIncentives.reduce((sum, apr) => {
        if (!isNaN(apr) && apr >= 0) {
          return sum + (isApy ? convertAprToApy(apr) : apr);
        }
        return sum;
      }, 0);
      if (totalProtocol >= 0) {
        sources.push({
          name: 'Protocol Incentive',
          value: totalProtocol,
          color: 'text-foreground',
          bgColor: 'bg-muted/60',
          sourceType: 'Protocol',
          campaigns: [{ value: totalProtocol }],
        });
      }
    }

    // Merit incentives (MeritIncentive array)
    const meritIncentives: MeritIncentive[] | undefined = type === 'supply' ? reserve.meritSupplys : reserve.meritBorrows;
    if (meritIncentives && Array.isArray(meritIncentives)) {
      meritIncentives.forEach((merit, index) => {
        if (!isCampaignActive(merit.startDate, merit.endDate)) return;
        const apr = merit.apr;
        const selfApr = merit.selfApr || 0;
        
        const baseAprPercent = !isNaN(apr) && apr >= 0 ? apr : 0;
        const selfAprPercent = !isNaN(selfApr) && selfApr >= 0 ? selfApr : 0;
        const totalForecastAprPercent = baseAprPercent + selfAprPercent;

        // Convert each APR to APY separately then sum (convertAprToApy is non-linear)
        let totalValue = 0;
        if (isApy) {
          if (baseAprPercent > 0) totalValue += convertAprToApy(baseAprPercent);
          if (selfAprPercent > 0) totalValue += convertAprToApy(selfAprPercent);
        } else {
          totalValue = totalForecastAprPercent;
        }
        
        if (totalValue >= 0) {
          const name = merit.name
            ? merit.name
            : meritIncentives.length > 1 
              ? `ACI Incentive ${index + 1}`
              : 'ACI Incentive';

          const { baseMessage, selfMessage } = splitMeritMessageBySelfAuth(merit.message);

          const meritCampaigns: NonNullable<IncentiveSource['campaigns']> = [];
          if (baseAprPercent > 0) {
            meritCampaigns.push({
              value: isApy ? convertAprToApy(baseAprPercent) : baseAprPercent,
              dateRange: formatDateRange(merit.startDate, merit.endDate) || undefined,
              startDate: merit.startDate,
              endDate: merit.endDate,
              message: baseMessage ?? merit.message,
              sourceType: 'ACI',
            });
          }
          if (selfAprPercent > 0) {
            meritCampaigns.push({
              value: isApy ? convertAprToApy(selfAprPercent) : selfAprPercent,
              dateRange: formatDateRange(merit.startDate, merit.endDate) || undefined,
              startDate: merit.startDate,
              endDate: merit.endDate,
              message: selfMessage,
              sourceType: 'ACI',
            });
          }

          sources.push({
            name,
            value: totalValue,
            color: 'text-foreground',
            bgColor: 'bg-muted/60',
            sourceType: 'ACI',
            link: merit.link,
            message: merit.message,
            dateRange: formatDateRange(merit.startDate, merit.endDate) || undefined,
            campaigns: meritCampaigns.length > 0
              ? meritCampaigns
              : [{
                  value: totalValue,
                  dateRange: formatDateRange(merit.startDate, merit.endDate) || undefined,
                  startDate: merit.startDate,
                  endDate: merit.endDate,
                  message: merit.message,
                }],
          });
        }
      });
    }

    // Brevis incentives (array)
    const brevisIncentives: BrevisIncentive[] | undefined =
      type === 'supply' ? reserve.brevisSupplys : reserve.brevisBorrows;

    if (brevisIncentives && Array.isArray(brevisIncentives) && brevisIncentives.length > 0) {
      brevisIncentives.forEach((brevis) => {
        const name = getBrevisDisplayLabel(brevis, 'Brevis Incentive');
        const message = getBrevisCampaignMessage(brevis);
        const breakdowns = getBrevisCampaignBreakdowns(brevis);
        const campaigns = breakdowns
          .map((breakdown) => {
            const startDate = breakdown.campaignStartedAt ?? getBrevisCampaignStartedAt(brevis);
            const endDate = breakdown.campaignEndedAt ?? getBrevisCampaignEndedAt(brevis);
            if (!isCampaignActive(startDate, endDate, Date.now(), true)) return null;
            const apr = breakdown.campaignApr ?? getBrevisCampaignApr(brevis);
            if (isNaN(apr) || apr < 0) return null;
            const value = isApy ? convertAprToApy(apr) : apr;
            return {
              value,
              dateRange: formatDateRange(startDate, endDate) || undefined,
              startDate,
              endDate,
              message,
              campaignId: breakdown.campaignId,
              sourceType: 'Brevis' as const,
            };
          })
          .filter(Boolean) as NonNullable<IncentiveSource['campaigns']>;
        if (campaigns.length === 0) return;
        const totalValue = campaigns.reduce((sum, campaign) => sum + campaign.value, 0);
        sources.push({
          name,
          value: totalValue,
          color: 'text-foreground',
          bgColor: 'bg-muted/60',
          sourceType: 'Brevis',
          link: brevis.link,
          message,
          dateRange: campaigns[0]?.dateRange,
          campaigns,
        });
      });
    }

    // Merkl incentives (use breakdowns for date range)
    const opportunities = type === 'supply' ? reserve.merklSupplys : reserve.merklBorrows;
    if (opportunities && Array.isArray(opportunities)) {
      opportunities.forEach((opportunity) => {
        if (!opportunity.breakdowns || !Array.isArray(opportunity.breakdowns)) return;
        opportunity.breakdowns.forEach((breakdown) => {
          if (!isCampaignActive(breakdown.campaignStartedAt, breakdown.campaignEndedAt)) return;
          const apr = forecastStates
            ? sanitizePercent(forecastBreakdownApr(breakdown, 0, forecastStates, tydroPointToUsdRate))
            : getMerklBreakdownApr(breakdown, tydroPointToUsdRate);
          const whitelistOnly = breakdown.whitelistOnly === true;
          const included = isMerklWhitelistBreakdownIncluded(breakdown, whitelistMerklCampaignIds);
          if (!isNaN(apr) && apr >= 0) {
            const displayValue = isApy ? convertAprToApy(apr) : apr;
            sources.push({
              name: opportunity.name || 'Merkl Incentive',
              value: included ? displayValue : 0,
              color: 'text-foreground',
              bgColor: 'bg-muted/60',
              sourceType: 'Merkl',
              link: getMerklLink(opportunity),
              message: opportunity.message,
              dateRange: formatDateRange(breakdown.campaignStartedAt, breakdown.campaignEndedAt) || undefined,
              campaigns: [{
                value: included ? displayValue : 0,
                rawValue: displayValue,
                whitelistOnly,
                included,
                dateRange: formatDateRange(breakdown.campaignStartedAt, breakdown.campaignEndedAt) || undefined,
                startDate: breakdown.campaignStartedAt,
                endDate: breakdown.campaignEndedAt,
                message: opportunity.message,
                campaignId: breakdown.campaignId,
                sourceType: 'Merkl',
              }],
            });
          }
        });
      });
    }

    return groupIncentiveSources(sources);
  };


  const incentiveSources = getIncentiveSources();
  const orderedIncentiveSources = useMemo(() => {
    const sourcePriority = (source: IncentiveSource): number => {
      const campaigns = source.campaigns ?? [];
      if (source.sourceType !== 'Merkl' || campaigns.length === 0) return 0;
      const hasIncludedCampaign = campaigns.some((campaign) => campaign.included !== false);
      return hasIncludedCampaign ? 0 : 1;
    };

    return [...incentiveSources].sort((a, b) => sourcePriority(a) - sourcePriority(b));
  }, [incentiveSources]);
  const hasDetails = incentiveSources.length > 0;

  const renderSourceCampaigns = (source: IncentiveSource, keyPrefix: string) => {
    const campaignsBase =
      source.campaigns ?? [{ value: source.value, dateRange: source.dateRange, message: source.message, sourceType: source.sourceType }];
    const campaigns = [...campaignsBase].sort((a, b) => {
      const aExcluded = a.whitelistOnly === true && a.included === false;
      const bExcluded = b.whitelistOnly === true && b.included === false;
      if (aExcluded === bExcluded) return 0;
      return aExcluded ? 1 : -1;
    });

    if (campaigns.length === 1) {
      const campaign = campaigns[0];
      const isExcludedWhitelist = campaign.whitelistOnly === true && campaign.included === false;
      const merklWlToggleKey =
        campaign.whitelistOnly === true
          ? String(campaign.campaignId ?? '').trim() || MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL
          : '';
      const messageLines = getMessageLines(campaign.message);
      const campaignAccentClass = isExcludedWhitelist ? 'text-zinc-500' : valueAccentClass;
      return (
        <>
          {campaign.whitelistOnly && (
            <label
              className="mt-[var(--ds-space-1)] flex items-start gap-[var(--ds-space-1-5)] ds-tooltip-body text-muted-foreground"
              aria-label={MERKL_WHITELIST_TOGGLE_ARIA}
            >
              <input
                type="checkbox"
                checked={whitelistMerklCampaignIds.has(merklWlToggleKey)}
                onChange={(event) => onToggleWhitelistMerklCampaign(merklWlToggleKey, event.target.checked)}
                className={DS_NATIVE_CHECKBOX_CLASS}
              />
              <span aria-hidden="true" className="min-w-0 leading-snug">
                {MERKL_WHITELIST_TOGGLE_LABEL}
              </span>
            </label>
          )}
          {campaign.dateRange && (
            <p className={`ds-tooltip-body mt-[var(--ds-space-1)] break-words ${campaignAccentClass}`}>
              Campaign time: {campaign.dateRange}
            </p>
          )}
          {messageLines.length > 0 && (
            <ul className="mt-[var(--ds-space-1)] space-y-[var(--ds-space-1)] ds-tooltip-body text-muted-foreground">
              {messageLines.map((line, lineIndex) => (
                <li key={`${keyPrefix}-message-${lineIndex}`} className="flex items-start gap-[var(--ds-space-1)]">
                  <span className={`mt-[0.4em] h-1 w-1 rounded-full bg-current flex-shrink-0 ${campaignAccentClass}`} />
                  <span className="min-w-0 break-words">{renderMessageLine(line, campaignAccentClass)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      );
    }

    return (
      <div className="mt-[var(--ds-space-1)] space-y-[var(--ds-space-1-5)]">
        {campaigns.map((campaign, campaignIndex) => {
          const isExcludedWhitelist = campaign.whitelistOnly === true && campaign.included === false;
          const merklWlToggleKey =
            campaign.whitelistOnly === true
              ? String(campaign.campaignId ?? '').trim() || MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL
              : '';
          const messageLines = getMessageLines(campaign.message);
          const campaignLabel = campaign.dateRange ? `Campaign time: ${campaign.dateRange}` : 'Campaign time: N/A';
          const campaignAccentClass = isExcludedWhitelist ? 'text-zinc-500' : valueAccentClass;
          const displayValue = isExcludedWhitelist ? campaign.rawValue ?? campaign.value : campaign.value;
          return (
            <div
              key={`${keyPrefix}-campaign-${campaignIndex}`}
              className={campaignIndex > 0 ? 'pt-[var(--ds-space-0-5)]' : ''}
            >
              {campaign.whitelistOnly && (
                <label
                  className="flex items-start gap-[var(--ds-space-1-5)] ds-tooltip-body text-muted-foreground mb-[var(--ds-space-0-5)]"
                  aria-label={MERKL_WHITELIST_TOGGLE_ARIA}
                >
                  <input
                    type="checkbox"
                    checked={whitelistMerklCampaignIds.has(merklWlToggleKey)}
                    onChange={(event) => onToggleWhitelistMerklCampaign(merklWlToggleKey, event.target.checked)}
                    className={DS_NATIVE_CHECKBOX_CLASS}
                  />
                  <span aria-hidden="true" className="min-w-0 leading-snug">
                    {MERKL_WHITELIST_TOGGLE_LABEL}
                  </span>
                </label>
              )}
              <div className="flex items-start justify-between gap-[var(--ds-space-2)]">
                <p className={`ds-tooltip-body break-words min-w-0 ${campaignAccentClass}`}>{campaignLabel}</p>
                <span className={`ds-tooltip-body tabular-nums font-semibold whitespace-nowrap ${campaignAccentClass}`}>
                  {formatPercent(displayValue)}
                </span>
              </div>
              {messageLines.length > 0 && (
                <ul className="mt-[var(--ds-space-1)] space-y-[var(--ds-space-1)] ds-tooltip-body text-muted-foreground">
                  {messageLines.map((line, lineIndex) => (
                    <li key={`${keyPrefix}-campaign-${campaignIndex}-message-${lineIndex}`} className="flex items-start gap-[var(--ds-space-1)]">
                      <span className={`mt-[0.4em] h-1 w-1 rounded-full bg-current flex-shrink-0 ${campaignAccentClass}`} />
                      <span className="min-w-0 break-words">{renderMessageLine(line, campaignAccentClass)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  useLayoutEffect(() => {
    const updatePosition = () => {
      if (!tooltipRef.current) return;
      const anchored = adjustTooltipAnchorForScroll({
        position,
        triggerCenterX,
        openedAtScroll,
        currentScroll: getWindowScroll(),
      });
      const currentScroll = getWindowScroll();
      const scrollDeltaX = currentScroll.x - openedAtScroll.x;
      const scrollDeltaY = currentScroll.y - openedAtScroll.y;
      const anchoredTriggerRect = triggerRect
        ? {
            top: triggerRect.top - scrollDeltaY,
            bottom: triggerRect.bottom - scrollDeltaY,
            left: triggerRect.left - scrollDeltaX,
            right: triggerRect.right - scrollDeltaX,
            width: triggerRect.width,
            height: triggerRect.height,
          }
        : null;
      const tooltipWidth = tooltipRef.current.offsetWidth;
      const minLeft = 16;
      const maxLeft = Math.max(minLeft, window.innerWidth - tooltipWidth - minLeft);
      const baseLeft =
        type === 'borrow'
          ? anchored.triggerCenterX - tooltipWidth + 24
          : anchored.position.x;
      const nextLeft = Math.min(Math.max(baseLeft, minLeft), maxLeft);
      setTooltipLeft(nextLeft);
      const gap = 8;
      const viewportEdge = 12;
      const flipThreshold = 24;
      const effectiveTriggerHeight = typeof triggerHeight === 'number' && triggerHeight > 0 ? triggerHeight : 0;
      const triggerBottomY = anchoredTriggerRect?.bottom ?? anchored.position.y;
      const desiredBottomTop = triggerBottomY + gap;
      const tooltipHeight = tooltipRef.current.offsetHeight;
      const minTop = viewportEdge;
      const maxTop = Math.max(minTop, window.innerHeight - tooltipHeight - minTop);
      const triggerTopY = anchoredTriggerRect?.top ?? (anchored.position.y - effectiveTriggerHeight);
      const desiredTopTop = triggerTopY - tooltipHeight - gap;
      const spaceBelow = window.innerHeight - desiredBottomTop - viewportEdge;
      const spaceAbove = triggerTopY - gap - viewportEdge;
      const shouldPlaceAbove =
        spaceBelow < tooltipHeight + flipThreshold && spaceAbove > spaceBelow + flipThreshold;
      setTooltipPlacement(shouldPlaceAbove ? 'top' : 'bottom');
      const desiredTop = shouldPlaceAbove ? desiredTopTop : desiredBottomTop;
      const clampedTop = Math.min(Math.max(desiredTop, minTop), maxTop);
      const severelyClamped = Math.abs(clampedTop - desiredTop) > 6;
      setShowTooltipArrow(!severelyClamped);
      setTooltipTop(clampedTop);

      const arrowWidth = 16;
      const calculatedLeft = anchored.triggerCenterX - nextLeft - arrowWidth / 2;
      const maxArrowLeft = tooltipWidth - arrowWidth - 12;
      setArrowLeft(Math.max(12, Math.min(maxArrowLeft, calculatedLeft)));
    };

    // Use double RAF to ensure layout is complete, but store both IDs for cleanup
    let innerRafId: number | null = null;
    const outerRafId = requestAnimationFrame(() => {
      innerRafId = requestAnimationFrame(updatePosition);
    });

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && tooltipRef.current
        ? new ResizeObserver(updatePosition)
        : null;
    if (resizeObserver && tooltipRef.current) {
      resizeObserver.observe(tooltipRef.current);
    }

    return () => {
      cancelAnimationFrame(outerRafId);
      if (innerRafId !== null) {
        cancelAnimationFrame(innerRafId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [triggerCenterX, position, type, openedAtScroll, triggerHeight, triggerRect]);

  // Mobile: bottom sheet style
  if (isMobile) {
    const content = (
      <BottomSheet
        open={true}
        onClose={onClose}
        title={`${type === 'supply' ? 'Supply' : 'Borrow'} Incentive Details`}
        surfaceStyle={tooltipSurfaceStyle}
        overlayOpacity="20"
      >
        {/* Detailed sources */}
        {hasDetails ? (
          <div className="relative mb-[var(--ds-space-2)] pl-[var(--ds-space-2)]">
            <div className={`pointer-events-none absolute left-0 top-0 bottom-0 ${accentClass}`} />
            <div className="divide-y divide-border/40">
            {orderedIncentiveSources.map((source, index) => {
                  const campaigns = source.campaigns ?? [];
                  const hasIncludedCampaign =
                    campaigns.length === 0 || campaigns.some((campaign) => campaign.included !== false);
                  const allWhitelistExcluded =
                    source.sourceType === 'Merkl' && campaigns.length > 0 && !hasIncludedCampaign;
                  const sourceDisplayValue = allWhitelistExcluded
                    ? campaigns.reduce((sum, campaign) => sum + (campaign.rawValue ?? campaign.value), 0)
                    : source.value;
                  const valueClass = `ds-tooltip-title ${allWhitelistExcluded ? 'text-zinc-500' : valueAccentClass}`;
                  const linkClass = `${allWhitelistExcluded ? 'text-zinc-500 bg-zinc-500/10' : `${valueAccentClass} ${valueBgClass}`} transition-opacity opacity-80 hover:opacity-100`;
                  const iconSrc = source.sourceType ? getSourceIcon(source.sourceType, isDark) : null;
                  const isBrevis = source.sourceType === 'Brevis';
                  const isWordmark = source.sourceType === 'Brevis' || source.sourceType === 'ACI' || source.sourceType === 'Merkl';
                  const logoWrapperClass = isWordmark ? 'min-w-[44px] px-[6px] py-[5px]' : 'h-[20px] w-[20px]';
                  const logoClass = isWordmark ? 'h-[11px] w-auto max-w-[60px]' : 'h-[11px] w-[11px]';
                  return (
                    <div 
                      key={`${source.name}-${index}`}
                      className={`ds-tooltip-item relative px-[var(--ds-space-2)] py-[var(--ds-space-1)] ${allWhitelistExcluded ? 'bg-zinc-500/5 rounded-md' : ''}`}
                    >
                      <div className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-1)]">
                        <div className="flex items-center gap-[var(--ds-space-1-5)] min-w-0 flex-1 pr-1">
                          {iconSrc && (
                            <span
                              className={`flex items-center justify-center rounded-md ring-1 ring-border/50 shadow-sm flex-shrink-0 bg-muted/60 ${logoWrapperClass}`}
                            >
                              <img
                                src={iconSrc}
                                alt={`${source.sourceType} logo`}
                                title={source.sourceType}
                                className={logoClass}
                                loading="eager"
                              />
                            </span>
                          )}
                          {isBrevis && !iconSrc && (
                            <span className="ds-text-9 font-semibold uppercase tracking-[0.22em] text-foreground/80 flex-shrink-0">
                              Brevis
                            </span>
                          )}
                          <span className="ds-tooltip-title text-foreground break-words block min-w-0">
                            {source.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-[var(--ds-space-1-5)] flex-shrink-0">
                          {source.link && (
                            <a
                              href={source.link}
                              {...externalLinkTabProps(isMobile)}
                              onClick={(e) => e.stopPropagation()}
                              className={`${linkClass} flex h-7 w-7 items-center justify-center rounded-full transition-opacity opacity-80 hover:opacity-100 focus:outline-none focus-visible:outline-none focus-visible:ring-0`}
                              title="Open link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <span className={`${valueClass} whitespace-nowrap`}>
                            {formatPercent(sourceDisplayValue)}
                          </span>
                        </div>
                      </div>
                      {renderSourceCampaigns(source, `mobile-${index}`)}
                    </div>
                  );
                })}
                </div>
              </div>
            ) : (
              <div className="mb-[var(--ds-space-2)]">
                <p className="ds-tooltip-body text-muted-foreground italic">
                  No detailed breakdown available
                </p>
              </div>
            )}
            
        </BottomSheet>
    );
    if (usePortal && portalTarget) {
      return createPortal(content, portalTarget);
    }
    return content;
  }

  // Desktop: tooltip style
  const content = (
    <>
      {/* Background overlay - subtle for click-away */}
      <div 
        className="fixed inset-0 z-30 animate-in fade-in-0 duration-200" 
        onClick={onClose}
      />
      {/* Tooltip content with smooth zoom + fade animation */}
      <div
        ref={tooltipRef}
        className={`fixed z-40 rounded-xl border border-border/60 bg-card ds-tooltip-pad max-w-[min(520px,calc(100vw-32px))] w-[min(520px,calc(100vw-32px))] min-w-[320px] animate-in fade-in-0 zoom-in-95 duration-200 ease-out ${
          tooltipPlacement === 'top' ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1'
        }`}
        style={{ 
          left: `${tooltipLeft ?? position.x}px`,
          top: `${tooltipTop ?? position.y + 8}px`,
          ...tooltipSurfaceStyle,
        }}
      >
        {showTooltipArrow && (
          <svg
            className={`absolute pointer-events-none ${
              tooltipPlacement === 'top' ? '-bottom-[10px] rotate-180' : '-top-[10px]'
            }`}
            style={{ left: `${arrowLeft}px`, width: '16px', height: '10px' }}
            viewBox="0 0 16 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <CalloutArrowSvg fill="hsl(var(--card))" stroke="hsl(var(--border) / 0.6)" width={16} height={10} />
          </svg>
        )}
        {/* Content area */}
        <div className="w-full min-w-0 max-h-[calc(100vh-32px)] overflow-y-auto overscroll-contain pr-1">
          {/* Detailed sources */}
          {hasDetails ? (
            <div className="relative my-[var(--ds-space-2)] pl-[var(--ds-space-2)]">
              <div className={`pointer-events-none absolute left-0 top-0 bottom-0 ${accentClass}`} />
              <div className="divide-y divide-border/40">
              {orderedIncentiveSources.map((source, index) => {
                const campaigns = source.campaigns ?? [];
                const hasIncludedCampaign =
                  campaigns.length === 0 || campaigns.some((campaign) => campaign.included !== false);
                const allWhitelistExcluded =
                  source.sourceType === 'Merkl' && campaigns.length > 0 && !hasIncludedCampaign;
                const sourceDisplayValue = allWhitelistExcluded
                  ? campaigns.reduce((sum, campaign) => sum + (campaign.rawValue ?? campaign.value), 0)
                  : source.value;
                const valueClass = `ds-tooltip-title ${allWhitelistExcluded ? 'text-zinc-500' : valueAccentClass}`;
                const linkClass = `${allWhitelistExcluded ? 'text-zinc-500 bg-zinc-500/10' : `${valueAccentClass} ${valueBgClass}`} transition-opacity opacity-80 hover:opacity-100`;
                const iconSrc = source.sourceType ? getSourceIcon(source.sourceType, isDark) : null;
                const isBrevis = source.sourceType === 'Brevis';
                const isWordmark = source.sourceType === 'Brevis' || source.sourceType === 'ACI' || source.sourceType === 'Merkl';
                const logoWrapperClass = isWordmark ? 'min-w-[44px] px-[6px] py-[5px]' : 'h-[20px] w-[20px]';
                const logoClass = isWordmark ? 'h-[11px] w-auto max-w-[60px]' : 'h-[11px] w-[11px]';
                return (
                  <div 
                    key={`${source.name}-${index}`}
                    className={`ds-tooltip-item relative px-[var(--ds-space-2)] py-[var(--ds-space-1)] animate-in fade-in-0 slide-in-from-top-2 ${allWhitelistExcluded ? 'bg-zinc-500/5 rounded-md' : ''}`}
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    <div className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-1)]">
                      <div className="flex items-center gap-[var(--ds-space-1-5)] min-w-0 flex-1 pr-1">
                        {iconSrc && (
                          <span
                            className={`flex items-center justify-center rounded-md ring-1 ring-border/50 shadow-sm flex-shrink-0 bg-muted/60 ${logoWrapperClass}`}
                          >
                            <img
                              src={iconSrc}
                              alt={`${source.sourceType} logo`}
                              title={source.sourceType}
                              className={logoClass}
                              loading="eager"
                            />
                          </span>
                        )}
                        {isBrevis && !iconSrc && (
                          <span className="ds-text-9 font-semibold uppercase tracking-[0.22em] text-foreground/80 flex-shrink-0">
                            Brevis
                          </span>
                        )}
                        <span className="ds-tooltip-title text-foreground break-words block min-w-0">
                          {source.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-[var(--ds-space-1-5)] flex-shrink-0">
                        {source.link && (
                          <a
                            href={source.link}
                            {...externalLinkTabProps(isMobile)}
                            onClick={(e) => e.stopPropagation()}
                            className={`${linkClass} flex h-7 w-7 items-center justify-center rounded-full transition-opacity opacity-80 hover:opacity-100 focus:outline-none focus-visible:outline-none focus-visible:ring-0`}
                            title="Open link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <span className={`${valueClass} whitespace-nowrap`}>
                          {formatPercent(sourceDisplayValue)}
                        </span>
                      </div>
                    </div>
                    {renderSourceCampaigns(source, `desktop-${index}`)}
                  </div>
                );
              })}
              </div>
            </div>
          ) : (
            <div className="mb-[var(--ds-space-2)]">
              <p className="ds-tooltip-body text-muted-foreground italic">
                No detailed breakdown available
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
  if (usePortal && portalTarget) {
    return createPortal(content, portalTarget);
  }
  return content;
};

export default IncentiveTooltip;
