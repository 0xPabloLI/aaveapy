import { useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Clock, ChevronDown } from 'lucide-react';
import { useTheme } from 'next-themes';
import { ReserveWithSpread, MeritCampaignGroup, MerklOpportunityGroup, BrevisIncentive, CampaignAccessStatus } from '@/types/aave';
import { formatPercent, formatUsd } from '@/lib/formatters';
import { convertAprToApy, apyToApr } from '@/lib/rateCalculations';
import {
  isMerklWhitelistBreakdownIncluded,
  MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL,
  MERKL_WHITELIST_TOGGLE_ARIA,
  MERKL_WHITELIST_TOGGLE_LABEL,
} from '@/lib/merklWhitelist';
import { getMerklBreakdownApr, forecastMerklApr, sanitizePercent } from '@/lib/merklForecast';
import { getPointToUsdRate, type PointRateMap } from '@/lib/tydro';
import type { MerklForecastWireItem } from '@/types/aave';
import {
  getBrevisCampaignBreakdowns,
  getBrevisDisplayLabel,
  getBrevisCampaignMessage,
  getBrevisCampaignStartedAt,
  getBrevisCampaignEndedAt,
} from '@/lib/brevis';
import { isCampaignActive } from '@/lib/campaignGroups';
import { getIncentiveSources } from '@/lib/incentiveAggregation';
import { HEADER_CONTROL_AFFORDANCE_ICON_CLASS } from '@/lib/headerControlStyles';
import { adjustTooltipAnchorForScroll, getWindowScroll } from '@/lib/tooltipPosition';
import { useIsMobile } from '@/hooks/use-mobile';
import BottomSheet from './BottomSheet';
import { externalLinkTabProps } from '@/lib/externalNavigation';
import { DS_NATIVE_CHECKBOX_CLASS } from '@/lib/dsNativeCheckbox';
import { TOKEN_ICON_MANIFEST } from '@/lib/tokenIconManifest.generated';

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
  pointRateMap?: PointRateMap;
  whitelistMerklCampaignIds: ReadonlySet<string>;
  onToggleWhitelistMerklCampaign: (campaignId: string, enabled: boolean) => void;
  forecastStates?: Record<string, MerklForecastWireItem>;
  campaignAccessStatuses?: Record<string, CampaignAccessStatus>;
}

interface IncentiveCampaign {
  value: number;
  startDate?: string;
  endDate?: string;
  message?: string | Record<string, unknown> | unknown[];
  campaignId?: string;
  campaignUrl?: string;
  sourceType?: IncentiveSource['sourceType'];
  whitelistOnly?: boolean;
  included?: boolean;
  rawValue?: number;
  campaignType?: string;
  aprCap?: number | null;
  rewardTokenIconUrl?: string;
  rewardTokenSymbol?: string;
  positionCap?: number;
  lastEndedCampaign?: {
    startedAt: string;
    endedAt: string;
    campaignId: string;
  };
}

interface IncentiveSource {
  name: string;
  value: number;
  color: string;
  bgColor: string;
  sourceType?: 'Protocol' | 'ACI' | 'Merkl' | 'Brevis';
  link?: string;
  message?: string | Record<string, unknown> | unknown[];
  requiredTokens?: string[] | string;
  campaigns?: IncentiveCampaign[];
  rewardTokenIconUrl?: string;
}

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

function resolveRewardTokenIconSrc(symbol?: string, fallbackUrl?: string): string | undefined {
  if (symbol) {
    const key = symbol.trim().toLowerCase();
    if (TOKEN_ICON_MANIFEST[key]) {
      return `/icons/tokens/${key}.${TOKEN_ICON_MANIFEST[key][0]}`;
    }
  }
  return fallbackUrl;
}

function campaignsHaveUniformIcon(campaigns: IncentiveCampaign[]): boolean {
  const icons = campaigns
    .map(c => resolveRewardTokenIconSrc(c.rewardTokenSymbol, c.rewardTokenIconUrl))
    .filter(Boolean);
  if (icons.length === 0) return false;
  return new Set(icons).size === 1;
}

function formatDateSafe(dateString?: string): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface RecentlyEndedSectionProps {
  incentiveSources: IncentiveSource[];
  isDark: boolean;
  isMobile: boolean;
}

function RecentlyEndedSection({ incentiveSources, isDark, isMobile }: RecentlyEndedSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const allEndedItems = useMemo(() => {
    const items: Array<{
      sourceType: IncentiveSource['sourceType'];
      sourceName: string;
      sourceLink?: string;
      lastEndedCampaign?: {
        startedAt: string;
        endedAt: string;
        campaignId: string;
      };
    }> = [];

    for (const source of incentiveSources) {
      for (const campaign of source.campaigns ?? []) {
        if (!campaign.lastEndedCampaign) continue;
        items.push({
          sourceType: source.sourceType,
          sourceName: source.name,
          sourceLink: source.link,
          lastEndedCampaign: campaign.lastEndedCampaign,
        });
      }
    }

    return items;
  }, [incentiveSources]);

  const groupedBySource = useMemo(() => {
    const map = new Map<string, {
      sourceType: IncentiveSource['sourceType'];
      sourceName: string;
      sourceLink?: string;
      items: typeof allEndedItems;
    }>();
    for (const item of allEndedItems) {
      const key = `${item.sourceType ?? 'unknown'}:${item.sourceName}`;
      const group = map.get(key) ?? {
        sourceType: item.sourceType,
        sourceName: item.sourceName,
        sourceLink: item.sourceLink,
        items: [],
      };
      group.items.push(item);
      map.set(key, group);
    }
    return Array.from(map.values());
  }, [allEndedItems]);

  if (allEndedItems.length === 0) return null;

  const renderCampaignMessage = (message: unknown, keyPrefix: string) => {
    if (!message) return null;
    let resolvedMessage: string | Record<string, unknown> | unknown[] | undefined;
    if (typeof message === 'string') {
      try {
        const parsed = JSON.parse(message);
        if (Array.isArray(parsed)) {
          resolvedMessage = parsed;
        } else if (parsed && typeof parsed === 'object') {
          resolvedMessage = parsed as Record<string, unknown>;
        } else {
          resolvedMessage = message;
        }
      } catch { /* not JSON */ }
      if (!resolvedMessage) resolvedMessage = message;
    } else {
      resolvedMessage = message as Record<string, unknown> | unknown[];
    }
    const lines = getMessageLines(resolvedMessage);
    if (lines.length === 0) return null;
    return (
      <ul key={`${keyPrefix}-msg`} className="mt-[var(--ds-space-0-5)] space-y-[var(--ds-space-0-5)] ds-tooltip-body text-zinc-400">
        {lines.map((line, lineIndex) => (
          <li key={`${keyPrefix}-msg-line-${lineIndex}`} className="flex items-start gap-[var(--ds-space-1)]">
            <span className="mt-[0.4em] h-1 w-1 rounded-full bg-current flex-shrink-0" />
            <span className="min-w-0 break-words">
              {line.emphasizePrefix && line.text.includes(':') ? (
                <>
                  <span className="font-semibold">{line.text.split(':')[0]}:</span>
                  {line.text.slice(line.text.indexOf(':') + 1)}
                </>
              ) : (
                line.text
              )}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="border-t border-border/30 mt-[var(--ds-space-1)] pt-[var(--ds-space-1)]">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center justify-between w-full px-[var(--ds-space-2)] py-[var(--ds-space-1)] ds-tooltip-body text-muted-foreground hover:text-foreground/80 transition-colors"
      >
        <span className="flex items-center gap-[var(--ds-space-1-5)]">
          <Clock className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} />
          <span>Recently Ended ({allEndedItems.length})</span>
        </span>
        <ChevronDown
          className={`${HEADER_CONTROL_AFFORDANCE_ICON_CLASS} transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className={isMobile ? '' : 'animate-in fade-in slide-in-from-top-1 duration-150'}>
          {groupedBySource.map((group, sourceIndex) => {
            const iconSrc = group.sourceType !== 'merit'
              ? getSourceIcon(group.sourceType === 'merkl' ? 'Merkl' : group.sourceType === 'Brevis' ? 'Brevis' : undefined, isDark)
              : null;

            return (
              <div
                key={`ended-${sourceIndex}`}
                className="px-[var(--ds-space-2)] py-[var(--ds-space-1)]"
              >
                <div className="flex items-center gap-[var(--ds-space-2)] mb-[var(--ds-space-1)]">
                  <div className="flex items-center gap-[var(--ds-space-1-5)] min-w-0 flex-1">
                    {iconSrc && (
                      <span
                        className="flex items-center justify-center rounded-md ring-1 ring-zinc-500/30 shadow-sm flex-shrink-0 bg-muted/60 min-w-[44px] px-[6px] py-[5px]"
                        style={{ filter: 'grayscale(100%)', opacity: 0.5 }}
                      >
                        <img
                          src={iconSrc}
                          alt={group.sourceType ?? ''}
                          className="h-[11px] w-auto max-w-[60px]"
                          loading="eager"
                        />
                      </span>
                    )}
                    <span className="ds-tooltip-title text-zinc-400 break-words block min-w-0">
                      {group.sourceName}
                    </span>
                  </div>
                  {group.sourceLink && (
                    <a
                      href={group.sourceLink}
                      {...externalLinkTabProps(isMobile)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex h-7 w-7 items-center justify-center rounded-full transition-opacity opacity-40 hover:opacity-60 text-zinc-400 bg-zinc-500/10"
                      title="Open link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                {group.items.map((item, ci: number) => {
                  const dateRangeText = item.lastEndedCampaign.startedAt && formatDateSafe(item.lastEndedCampaign.startedAt)
                    ? `${formatDateSafe(item.lastEndedCampaign.startedAt)} - ${formatDateSafe(item.lastEndedCampaign.endedAt)}`
                    : `Ended: ${formatDateSafe(item.lastEndedCampaign.endedAt)}`;
                  const endedCampaignUrl = item.sourceLink && item.lastEndedCampaign.campaignId
                    ? `${item.sourceLink}/campaigns/${item.lastEndedCampaign.campaignId}` : undefined;
                  return (
                  <div
                    key={`ended-${sourceIndex}-c-${ci}`}
                    className={ci > 0 ? 'mt-[var(--ds-space-1)] pt-[var(--ds-space-0-5)]' : ''}
                  >
                    <div className="ds-tooltip-body grid grid-cols-[1fr_auto_auto] items-start gap-x-[var(--ds-space-1-5)] text-zinc-400">
                      <span className="break-words min-w-0">{dateRangeText}</span>
                      <span className="tabular-nums font-semibold whitespace-nowrap text-zinc-500">
                        {formatPercent(0)}
                      </span>
                      {endedCampaignUrl ? (
                        <a
                          href={endedCampaignUrl}
                          {...externalLinkTabProps(isMobile)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-5 w-5 items-center justify-center rounded-full transition-opacity opacity-50 hover:opacity-80 text-zinc-400"
                          title="View campaign"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : <div />}
                    </div>
                  </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  pointRateMap,
  whitelistMerklCampaignIds,
  onToggleWhitelistMerklCampaign,
  forecastStates,
  campaignAccessStatuses,
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
    if (typeof message === 'string') {
      try {
        const parsed = JSON.parse(message);
        if (Array.isArray(parsed)) {
          return getMessageLines(parsed);
        }
        if (parsed && typeof parsed === 'object') {
          return getMessageLines(parsed as Record<string, unknown>);
        }
      } catch { /* not JSON, treat as plain string */ }
      return filterLines([{ text: message }]);
    }
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

  const getMerklOppLink = (opportunity: MerklOpportunityGroup): string | undefined => {
    return opportunity.opportunityId ? `https://app.merkl.xyz/opportunities/${opportunity.opportunityId}` : undefined;
  };

  const buildSourceGroupKey = (source: IncentiveSource): string => {
    return `${source.sourceType ?? 'Unknown'}|${source.name}|${source.link ?? ''}`;
  };

  const groupIncentiveSources = (sources: IncentiveSource[]): IncentiveSource[] => {
    const grouped = new Map<string, IncentiveSource>();

    sources.forEach((source) => {
      const key = buildSourceGroupKey(source);
      const campaigns = source.campaigns ?? [{ value: source.value, message: source.message, sourceType: source.sourceType }];
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
  const buildIncentiveSources = (): IncentiveSource[] => {
    const sources: IncentiveSource[] = [];

    // Protocol incentives (number array)
    const { protocol: protocolIncentives, merit: meritGroups, merkl: opportunities, brevis: brevisIncentives } = getIncentiveSources(reserve, type);
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

    // Merit incentives (MeritCampaignGroup array)
    if (meritGroups && Array.isArray(meritGroups)) {
      meritGroups.forEach((group) => {
        const breakdowns = group.breakdowns ?? [];
        const activeBreakdowns = breakdowns.filter((b) => isCampaignActive(b.campaignStartedAt, b.campaignEndedAt));
        if (activeBreakdowns.length === 0) return;

        const meritCampaigns: NonNullable<IncentiveSource['campaigns']> = activeBreakdowns.map((breakdown, bdIndex) => {
          const value = isApy ? convertAprToApy(breakdown.campaignApr) : breakdown.campaignApr;
          return {
            value,
            startDate: breakdown.campaignStartedAt,
            endDate: breakdown.campaignEndedAt,
            message: breakdown.message ?? group.message,
            sourceType: 'ACI',
            campaignType: breakdown.campaignType,
            ...(breakdown.positionCap != null && breakdown.positionCap > 0 ? { positionCap: breakdown.positionCap } : {}),
          };
        });

        const totalValue = meritCampaigns.reduce((sum, c) => sum + c.value, 0);

        sources.push({
          name: group.name || 'Merit Incentive',
          value: totalValue,
          color: 'text-foreground',
          bgColor: 'bg-muted/60',
          sourceType: 'ACI',
          link: group.link,
          campaigns: meritCampaigns,
        });
      });
    }

    // Brevis incentives (array)
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
              startDate,
              endDate,
              campaignId: breakdown.campaignId,
              sourceType: 'Brevis' as const,
              campaignType: breakdown.campaignType ?? brevis.campaignType,
              aprCap: breakdown.aprCap ?? brevis.aprCap,
              ...(breakdown.positionCap != null && breakdown.positionCap > 0 ? { positionCap: breakdown.positionCap } : {}),
              ...(brevis.positionCap != null && brevis.positionCap > 0 && breakdown.positionCap == null ? { positionCap: brevis.positionCap } : {}),
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
          campaigns,
        });
      });
    }

    // Merkl incentives (use breakdowns for date range)
    if (opportunities && Array.isArray(opportunities)) {
      opportunities.forEach((opportunity) => {
        if (!opportunity.breakdowns || !Array.isArray(opportunity.breakdowns)) return;

        for (const breakdown of opportunity.breakdowns) {
          if (!isCampaignActive(breakdown.campaignStartedAt, breakdown.campaignEndedAt)) continue;
          const effectiveRate = pointRateMap
            ? getPointToUsdRate(breakdown.rewardTokenSymbol, pointRateMap)
            : tydroPointToUsdRate;
          const apr = forecastStates
            ? sanitizePercent(forecastMerklApr(breakdown, 0, forecastStates, effectiveRate))
            : getMerklBreakdownApr(breakdown, effectiveRate);
          const whitelistOnly = breakdown.whitelistOnly === true;
          const included = isMerklWhitelistBreakdownIncluded(breakdown, whitelistMerklCampaignIds, campaignAccessStatuses?.[breakdown.campaignId]);
          if (!isNaN(apr) && apr >= 0) {
            const displayValue = isApy ? convertAprToApy(apr) : apr;
            const oppLink = getMerklOppLink(opportunity);
            const campaignUrl = oppLink ? `${oppLink}/campaigns/${breakdown.campaignId}` : undefined;
            sources.push({
              name: opportunity.name || 'Merkl Incentive',
              value: included ? displayValue : 0,
              color: 'text-foreground',
              bgColor: 'bg-muted/60',
              sourceType: 'Merkl',
              link: oppLink,
              message: opportunity.message,
              rewardTokenIconUrl: breakdown.rewardTokenIconUrl,
                  campaigns: [{
                    value: included ? displayValue : 0,
                    rawValue: displayValue,
                    whitelistOnly,
                    included,
                    startDate: breakdown.campaignStartedAt,
                    endDate: breakdown.campaignEndedAt,
                    campaignId: breakdown.campaignId,
                    ...(campaignUrl ? { campaignUrl } : {}),
                    sourceType: 'Merkl',
               campaignType: breakdown.campaignType ?? 'DUTCH_AUCTION',
                     aprCap: breakdown.aprCap,
                     rewardTokenIconUrl: breakdown.rewardTokenIconUrl,
                     rewardTokenSymbol: breakdown.rewardTokenSymbol,
                      lastEndedCampaign: breakdown.lastEndedCampaign,
                  }],
            });
          }
        }
      });
    }

    return groupIncentiveSources(sources);
  };


  const incentiveSources = buildIncentiveSources();
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

  const hasIneligibleCampaigns = useMemo(() => {
    if (!campaignAccessStatuses) return false;
    return incentiveSources.some(
      (source) =>
        source.sourceType === 'Merkl' &&
        source.campaigns?.some(
          (campaign) =>
            campaign.included === false &&
            campaign.campaignId != null &&
            (campaignAccessStatuses[campaign.campaignId] === 'blacklisted' ||
              campaignAccessStatuses[campaign.campaignId] === 'whitelist-blocked'),
        ),
    );
  }, [incentiveSources, campaignAccessStatuses]);

  const nativeApy = type === 'supply' ? (reserve.supplyApy ?? 0) : (reserve.borrowApy ?? 0);
  const displayTargetApr = (aprCap: number) => isApy ? convertAprToApy(aprCap) : aprCap;
  const displayNative = () => isApy ? nativeApy : apyToApr(nativeApy);

  const CAMPAIGN_DESC_WRAPPER = 'mt-[var(--ds-space-1)] rounded-md bg-muted/40 border-l-2 border-muted-foreground/30 pl-[var(--ds-space-1-5)] py-[3px] pr-[var(--ds-space-1)]';

  const renderCampaignTypeDescription = (campaign: IncentiveCampaign) => {
    const ct = campaign.campaignType;
    if (!ct || campaign.value <= 0) return null;

    if (ct === 'TARGET_TOTAL_APR' && campaign.aprCap != null && campaign.aprCap > 0) {
      return (
        <div data-campaign-desc="TARGET_TOTAL_APR" className={CAMPAIGN_DESC_WRAPPER}>
          <p className="ds-tooltip-body break-words text-muted-foreground">
            Target total {isApy ? 'APY' : 'APR'}: {formatPercent(displayTargetApr(campaign.aprCap!))} = Native {formatPercent(displayNative())} + Merkl {formatPercent(campaign.rawValue ?? campaign.value)}
          </p>
        </div>
      );
    }

    if (ct === 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE') {
      const hasCap = campaign.aprCap != null && campaign.aprCap > 0;
      const capPart = hasCap ? ` (cap ${formatPercent(displayTargetApr(campaign.aprCap!))})` : '';
      return (
        <div data-campaign-desc="MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE" className={CAMPAIGN_DESC_WRAPPER}>
          <p className="ds-tooltip-body break-words text-muted-foreground">
            Max APR — reward decreases as TVL grows{capPart}
          </p>
        </div>
      );
    }

    if (ct === 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE') {
      return (
        <div data-campaign-desc="FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE" className={CAMPAIGN_DESC_WRAPPER}>
          <p className="ds-tooltip-body break-words text-muted-foreground">
            Fixed APR — campaign ends early if budget runs out
          </p>
        </div>
      );
    }

    if (ct === 'DUTCH_AUCTION') {
      return (
        <div data-campaign-desc="DUTCH_AUCTION" className={CAMPAIGN_DESC_WRAPPER}>
          <p className="ds-tooltip-body break-words text-muted-foreground">
            Dutch auction — daily amount is fixed, rate changes with TVL
          </p>
        </div>
      );
    }

    return null;
  };

  const renderCampaignMessageLines = (message: IncentiveCampaign['message'], keyPrefix: string, accentClass: string) => {
    const lines = getMessageLines(message);
    if (lines.length === 0) return null;
    return (
      <ul className="mt-[var(--ds-space-1)] space-y-[var(--ds-space-1)] ds-tooltip-body text-muted-foreground">
        {lines.map((line, lineIndex) => (
          <li key={`${keyPrefix}-bd-msg-${lineIndex}`} className="flex items-start gap-[var(--ds-space-1)]">
            <span className={`mt-[0.4em] h-1 w-1 rounded-full bg-current flex-shrink-0 ${accentClass}`} />
            <span className="min-w-0 break-words">{renderMessageLine(line, accentClass)}</span>
          </li>
        ))}
      </ul>
    );
  };

  const renderCampaignContent = (campaign: IncentiveCampaign, campaignAccentClass: string, keyPrefix: string, showApr?: boolean) => {
    const dateRangeText = campaign.startDate && campaign.endDate && formatDateRange(campaign.startDate, campaign.endDate)
      ? `Campaign time: ${formatDateRange(campaign.startDate, campaign.endDate)}`
      : '';
    return (
      <>
        {dateRangeText && (
          <div className={`ds-tooltip-body mt-[var(--ds-space-1)] grid grid-cols-[1fr_auto_auto] items-start gap-x-[var(--ds-space-1-5)] ${campaignAccentClass}`}>
            <span className="break-words min-w-0">{dateRangeText}</span>
            {showApr && (() => {
              const campaignIconSrc = resolveRewardTokenIconSrc(campaign.rewardTokenSymbol, campaign.rewardTokenIconUrl);
              return (
              <span data-testid="campaign-apr" className="flex items-center gap-0.5 whitespace-nowrap">
                {campaignIconSrc && (
                  <img
                    src={campaignIconSrc}
                    alt=""
                    className="h-3.5 w-3.5 flex-shrink-0 rounded-full"
                    loading="lazy"
                  />
                )}
                <span className={`tabular-nums font-semibold ${campaignAccentClass}`}>{formatPercent(campaign.value)}</span>
              </span>
              );
            })()}
            {campaign.campaignUrl ? (
              <a
                href={campaign.campaignUrl}
                {...externalLinkTabProps(isMobile)}
                onClick={(e) => e.stopPropagation()}
                className="flex h-5 w-5 items-center justify-center rounded-full transition-opacity opacity-50 hover:opacity-80 text-muted-foreground"
                title="View campaign"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : <div />}
          </div>
        )}
        {renderCampaignTypeDescription(campaign)}
        {campaign.positionCap != null && campaign.positionCap > 0 && (
          <p className="ds-tooltip-body mt-[var(--ds-space-1)] break-words text-foreground/70">
            Incentive on first {formatUsd(campaign.positionCap)} only
          </p>
        )}
        {renderCampaignMessageLines(campaign.message, keyPrefix, campaignAccentClass)}
      </>
    );
  };

  const renderSourceCampaigns = (source: IncentiveSource, keyPrefix: string) => {
    const campaignsBase =
      source.campaigns ?? [{ value: source.value, sourceType: source.sourceType }];
    const campaigns = [...campaignsBase].sort((a, b) => {
      const aExcluded = a.whitelistOnly === true && a.included === false;
      const bExcluded = b.whitelistOnly === true && b.included === false;
      if (aExcluded === bExcluded) return 0;
      return aExcluded ? 1 : -1;
    });

    const sourceMessageLines = getMessageLines(source.message);

    if (campaigns.length === 1) {
      const campaign = campaigns[0];
      const isExcludedWhitelist = campaign.whitelistOnly === true && campaign.included === false;
      const merklWlToggleKey =
        campaign.whitelistOnly === true
          ? String(campaign.campaignId ?? '').trim() || MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL
          : '';
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
          {renderCampaignContent(campaign, campaignAccentClass, `${keyPrefix}-0`)}
          {sourceMessageLines.length > 0 && (
            <ul className="mt-[var(--ds-space-1)] space-y-[var(--ds-space-1)] ds-tooltip-body text-muted-foreground">
              {sourceMessageLines.map((line, lineIndex) => (
                <li key={`${keyPrefix}-src-msg-${lineIndex}`} className="flex items-start gap-[var(--ds-space-1)]">
                  <span className={`mt-[0.4em] h-1 w-1 rounded-full bg-current flex-shrink-0 ${valueAccentClass}`} />
                  <span className="min-w-0 break-words">{renderMessageLine(line, valueAccentClass)}</span>
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
          const campaignAccentClass = isExcludedWhitelist ? 'text-zinc-500' : valueAccentClass;
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
              {renderCampaignContent(campaign, campaignAccentClass, `${keyPrefix}-${campaignIndex}`, true)}
            </div>
          );
        })}
        {sourceMessageLines.length > 0 && (
          <ul className="space-y-[var(--ds-space-1)] ds-tooltip-body text-muted-foreground">
            {sourceMessageLines.map((line, lineIndex) => (
              <li key={`${keyPrefix}-src-msg-${lineIndex}`} className="flex items-start gap-[var(--ds-space-1)]">
                <span className={`mt-[0.4em] h-1 w-1 rounded-full bg-current flex-shrink-0 ${valueAccentClass}`} />
                <span className="min-w-0 break-words">{renderMessageLine(line, valueAccentClass)}</span>
              </li>
            ))}
          </ul>
        )}
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

  function IncentiveSourceRow({
    source,
    index,
    animated = false,
  }: {
    source: IncentiveSource;
    index: number;
    animated?: boolean;
  }) {
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
    const keyPrefix = animated ? `desktop-${index}` : `mobile-${index}`;
    const headerAllCampaigns = source.campaigns ?? [];
    const headerUniformIcon = campaignsHaveUniformIcon(headerAllCampaigns);
    const headerRewardTokenIcon = headerUniformIcon
      ? resolveRewardTokenIconSrc(headerAllCampaigns[0]?.rewardTokenSymbol, headerAllCampaigns[0]?.rewardTokenIconUrl)
      : undefined;
    return (
      <div
        className={`ds-tooltip-item relative px-[var(--ds-space-2)] py-[var(--ds-space-1)] ${
          animated ? 'animate-in fade-in-0 slide-in-from-top-2' : ''
        } ${allWhitelistExcluded ? 'bg-zinc-500/5 rounded-md' : ''}`}
        style={animated ? { animationDelay: `${index * 45}ms` } : undefined}
      >
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-[var(--ds-space-1-5)] mb-[var(--ds-space-1)]">
          <div className="flex items-center gap-[var(--ds-space-1-5)] min-w-0 pr-1">
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
          {source.link ? (
            <a
              href={source.link}
              {...externalLinkTabProps(isMobile)}
              onClick={(e) => e.stopPropagation()}
              className={`${linkClass} flex h-7 w-7 items-center justify-center rounded-full transition-opacity opacity-80 hover:opacity-100 focus:outline-none focus-visible:outline-none focus-visible:ring-0`}
              title="Open link"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <div />
          )}
          <span data-testid="source-header-apr" className={`${valueClass} whitespace-nowrap flex items-center gap-0.5`}>
            {headerRewardTokenIcon && (
              <img
                src={headerRewardTokenIcon}
                alt=""
                className="h-3.5 w-3.5 flex-shrink-0 rounded-full"
                loading="lazy"
              />
            )}
            {formatPercent(sourceDisplayValue)}
          </span>
        </div>
        {renderSourceCampaigns(source, keyPrefix)}
      </div>
    );
  }

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
                {orderedIncentiveSources.map((source, index) => (
                      <IncentiveSourceRow key={`${source.name}-${index}`} source={source} index={index} />
                    ))}
                    </div>
                  </div>
                ) : (
                  <div className="mb-[var(--ds-space-2)]">
                    <p className="ds-tooltip-body text-muted-foreground italic">
                      No detailed breakdown available
                    </p>
                  </div>
                )}
                <RecentlyEndedSection
                  incentiveSources={incentiveSources}
                  isDark={isDark}
                  isMobile={true}
                />
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
        {/* Arrow using SVG dual-path (fill + stroke separated) — matches TooltipCalloutArrow approach */}
        {showTooltipArrow && (
          tooltipPlacement === 'top' ? (
            <svg
              className="absolute pointer-events-none z-20"
              style={{ left: `${arrowLeft}px`, bottom: -8 }}
              width="16"
              height="9"
              viewBox="0 0 16 9"
              aria-hidden
            >
              <path d="M0 0 L8 9 L16 0 Z" fill="hsl(var(--card))" />
              <path d="M0 0 L8 9 L16 0" stroke="hsl(var(--border) / 0.6)" strokeWidth="1" strokeLinejoin="round" fill="none" />
            </svg>
          ) : (
            <svg
              className="absolute pointer-events-none z-20"
              style={{ left: `${arrowLeft}px`, top: -8 }}
              width="16"
              height="9"
              viewBox="0 0 16 9"
              aria-hidden
            >
              <path d="M0 9 L8 0 L16 9 Z" fill="hsl(var(--card))" />
              <path d="M0 9 L8 0 L16 9" stroke="hsl(var(--border) / 0.6)" strokeWidth="1" strokeLinejoin="round" fill="none" />
            </svg>
          )
        )}
        {/* Content area */}
        <div className="w-full min-w-0 max-h-[calc(100vh-32px)] overflow-y-auto overscroll-contain pr-1">
          {hasIneligibleCampaigns && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
              <span>⚠</span>
              <span>Your address is not eligible for some campaigns</span>
            </div>
          )}
          {/* Detailed sources */}
          {hasDetails ? (
            <div className="relative my-[var(--ds-space-2)] pl-[var(--ds-space-2)]">
              <div className={`pointer-events-none absolute left-0 top-0 bottom-0 ${accentClass}`} />
              <div className="divide-y divide-border/40">
              {orderedIncentiveSources.map((source, index) => (
                <IncentiveSourceRow key={`${source.name}-${index}`} source={source} index={index} animated />
              ))}
              </div>
            </div>
          ) : (
            <div className="mb-[var(--ds-space-2)]">
              <p className="ds-tooltip-body text-muted-foreground italic">
                No detailed breakdown available
              </p>
            </div>
          )}
          <RecentlyEndedSection
            incentiveSources={incentiveSources}
            isDark={isDark}
            isMobile={false}
          />
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
