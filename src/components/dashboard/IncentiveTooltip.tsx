import { useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { ReserveWithSpread, MeritIncentive, MerklOpportunityGroup, BrevisIncentive, TokenPricesIndex, MerklForecastStateResponse } from '@/types/aave';
import { formatPercent, convertAprToApy, apyToApr } from '@/lib/formatters';
import { getMerklBreakdownApr, getMerklForecastUsdMultiplier } from '@/lib/tydro';
import { fetchMerklForecastStates } from '@/lib/merklForecastApi';
import {
  extractMeritSelfCapUsd,
  forecastMeritCampaign,
  splitMeritMessageBySelfAuth,
} from '@/lib/meritForecast';
import type { MeritForecastPreview } from '@/lib/meritForecast';
import { deriveForecastProgressFlags, forecastWithTVL } from '@/lib/merklForecast';
import { resolveForecastTokenPrice, resolveForecastTokenPriceWithBackup } from '@/lib/tokenPriceResolver';
import { shouldSurfaceForecastError } from '@/lib/merklForecastErrors';
import { formatNumberInput, parseNumberInput } from '@/lib/numberFormat';
import { adjustTooltipAnchorForScroll, getWindowScroll } from '@/lib/tooltipPosition';
import { useIsMobile } from '@/hooks/use-mobile';
import { useReserveRateInput } from '@/hooks/useReserveRateInputs';
import { simulateNativeRatesAfterSupply, simulateNativeRatesAfterBorrow } from '@/lib/interestRateCalculator';

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
  includeWhitelistOnlyMerkl: boolean;
  onToggleWhitelistOnlyMerkl: (next: boolean) => void;
  tokenPrices?: TokenPricesIndex;
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
    forecastMultiplier?: number;
    whitelistOnly?: boolean;
    included?: boolean;
    rawValue?: number;
    forecastAprPercent?: number;
    lastRoundRewardUsd?: number;
    meritForecastMode?: 'MERIT_BASE' | 'MERIT_SELF_CAP';
    selfCapUsd?: number;
    meritBaseAprPercent?: number;
    meritBaseLastRoundRewardUsd?: number;
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

const isCampaignActive = (startDate: string | undefined, endDate: string | undefined, nowMs = Date.now()): boolean => {
  const startMs = parseCampaignBoundaryMs(startDate, 'start');
  const endMs = parseCampaignBoundaryMs(endDate, 'end');
  if (startMs === null || endMs === null) return false;
  return nowMs >= startMs && nowMs <= endMs;
};

const getCampaignCycleDays = (startDate: string | undefined, endDate: string | undefined): number | null => {
  if (!startDate || !endDate) return null;
  const startMs = Date.parse(startDate);
  const endMs = Date.parse(endDate);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  const days = (endMs - startMs) / 1000 / 86400;
  return Number.isFinite(days) && days > 0 ? days : null;
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
  includeWhitelistOnlyMerkl,
  onToggleWhitelistOnlyMerkl,
  tokenPrices,
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
  const [depositInput, setDepositInput] = useState('');
  const [tokenPrice, setTokenPrice] = useState<number | undefined>(undefined);
  const [tokenPriceLoading, setTokenPriceLoading] = useState(false);
  const [merklForecastStates, setMerklForecastStates] = useState<Record<string, MerklForecastStateResponse>>({});
  const [merklForecastErrors, setMerklForecastErrors] = useState<Record<string, string>>({});
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

  const formatUsd = (value: number): string =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(value);

  const formatForecastTimestamp = (unixSeconds: number): string =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(unixSeconds * 1000));

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
    return opportunity.link || opportunity.opportunityLink;
  };

  const buildSourceGroupKey = (source: IncentiveSource): string =>
    `${source.sourceType ?? 'Unknown'}|${source.name}|${source.link ?? ''}`;

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

  const tokenSymbol = reserve.tokenSymbol || 'Token';

  useEffect(() => {
    setOpenedAtScroll(getWindowScroll());
  }, [position.x, position.y, triggerCenterX, type]);

  useEffect(() => {
    const lookupInput = {
      tokenPrices,
      chainId: reserve.chainId,
      actionType: type === 'supply' ? 'Supply' : 'Borrow',
      tokenSymbol: reserve.tokenSymbol,
      tokenAddress: reserve.tokenAddress,
      aTokenAddress: reserve.aTokenAddress,
      vTokenAddress: reserve.vTokenAddress,
    } as const;

    const localPrice = resolveForecastTokenPrice(lookupInput);
    if (localPrice !== undefined) {
      setTokenPrice(localPrice);
      setTokenPriceLoading(false);
      return;
    }

    let cancelled = false;
    setTokenPrice(undefined);
    setTokenPriceLoading(true);

    resolveForecastTokenPriceWithBackup(lookupInput)
      .then((price) => {
        if (cancelled) return;
        setTokenPrice(price);
      })
      .finally(() => {
        if (!cancelled) setTokenPriceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reserve, type, tokenPrices]);

  const depositAssetAmount = useMemo(() => parseNumberInput(depositInput), [depositInput]);
  const depositUsd = tokenPrice ? depositAssetAmount * tokenPrice : 0;
  const {
    data: reserveRateInput,
    isLoading: reserveRateInputLoading,
    error: reserveRateInputError,
  } = useReserveRateInput({
    chainId: reserve.chainId,
    tokenAddress: reserve.tokenAddress,
    marketName: reserve.marketName,
  });

  const nativeSimulation = useMemo(() => {
    if (!reserveRateInput) return null;
    return type === 'borrow'
      ? simulateNativeRatesAfterBorrow(reserveRateInput, depositInput)
      : simulateNativeRatesAfterSupply(reserveRateInput, depositInput);
  }, [reserveRateInput, depositInput, type]);

  const nativeRateUnitLabel = isApy ? 'APY' : 'APR';
  const currentNativeApy = type === 'supply' ? reserve.supplyApy ?? null : reserve.borrowApy ?? null;
  const currentNativeRate = useMemo(() => {
    if (currentNativeApy === null || currentNativeApy === undefined) return null;
    return isApy ? currentNativeApy : apyToApr(currentNativeApy);
  }, [currentNativeApy, isApy]);
  const simulatedNativeRate = useMemo(() => {
    if (!nativeSimulation) return null;
    if (type === 'supply') {
      return isApy ? nativeSimulation.supplyApyPercent : nativeSimulation.supplyAprPercent;
    }
    return isApy ? nativeSimulation.borrowApyPercent : nativeSimulation.borrowAprPercent;
  }, [nativeSimulation, type, isApy]);
  const nativeRateDelta =
    currentNativeRate !== null && simulatedNativeRate !== null
      ? simulatedNativeRate - currentNativeRate
      : null;

  const campaignIds = useMemo(() => {
    const opportunities = type === 'supply' ? reserve.merklSupplys : reserve.merklBorrows;
    if (!opportunities || !Array.isArray(opportunities)) return [];
    const ids = new Set<string>();
    opportunities.forEach((opportunity) => {
      opportunity.breakdowns?.forEach((breakdown) => {
        if (!isCampaignActive(breakdown.campaignStartedAt, breakdown.campaignEndedAt)) return;
        if (breakdown?.campaignId) ids.add(String(breakdown.campaignId));
      });
    });
    return Array.from(ids);
  }, [reserve, type]);

  useEffect(() => {
    if (campaignIds.length === 0) {
      setMerklForecastStates({});
      setMerklForecastErrors({});
      return;
    }

    let cancelled = false;
    fetchMerklForecastStates(campaignIds)
      .then((result) => {
        if (cancelled) return;
        const next: Record<string, MerklForecastStateResponse> = {};
        const nextErrors: Record<string, string> = {};
        result.items.forEach((item) => {
          next[item.campaignId] = item;
        });
        result.errors
          .filter((item) => shouldSurfaceForecastError(item))
          .forEach((item) => {
            nextErrors[item.campaignId] = item.message;
          });
        setMerklForecastStates(next);
        setMerklForecastErrors(nextErrors);
      })
      .catch(() => {
        if (!cancelled) {
          setMerklForecastStates({});
          setMerklForecastErrors({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campaignIds]);

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
          const selfCapUsd = extractMeritSelfCapUsd(selfMessage);

          const meritCampaigns: NonNullable<IncentiveSource['campaigns']> = [];
          if (baseAprPercent > 0) {
            meritCampaigns.push({
              value: isApy ? convertAprToApy(baseAprPercent) : baseAprPercent,
              dateRange: formatDateRange(merit.startDate, merit.endDate) || undefined,
              startDate: merit.startDate,
              endDate: merit.endDate,
              message: baseMessage ?? merit.message,
              forecastAprPercent: baseAprPercent,
              lastRoundRewardUsd: merit.lastRoundRewardUsd,
              meritForecastMode: 'MERIT_BASE',
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
              forecastAprPercent: selfAprPercent,
              meritForecastMode: 'MERIT_SELF_CAP',
              selfCapUsd: selfCapUsd ?? undefined,
              meritBaseAprPercent: baseAprPercent > 0 ? baseAprPercent : undefined,
              meritBaseLastRoundRewardUsd:
                typeof merit.lastRoundRewardUsd === 'number' && Number.isFinite(merit.lastRoundRewardUsd) && merit.lastRoundRewardUsd > 0
                  ? merit.lastRoundRewardUsd
                  : undefined,
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
                  forecastAprPercent: totalForecastAprPercent,
                  lastRoundRewardUsd: merit.lastRoundRewardUsd,
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
        if (!isCampaignActive(brevis.startDate, brevis.endDate)) return;
        const apr = brevis.apr;
        if (!isNaN(apr) && apr >= 0) {
          sources.push({
            name: brevis.name || 'Brevis Incentive',
            value: isApy ? convertAprToApy(apr) : apr,
            color: 'text-foreground',
            bgColor: 'bg-muted/60',
            sourceType: 'Brevis',
            link: brevis.link,
            dateRange: formatDateRange(brevis.startDate, brevis.endDate) || undefined,
            campaigns: [{
              value: isApy ? convertAprToApy(apr) : apr,
              dateRange: formatDateRange(brevis.startDate, brevis.endDate) || undefined,
              startDate: brevis.startDate,
              endDate: brevis.endDate,
            }],
          });
        }
      });
    }

    // Merkl incentives (use breakdowns for date range)
    const opportunities = type === 'supply' ? reserve.merklSupplys : reserve.merklBorrows;
    if (opportunities && Array.isArray(opportunities)) {
      opportunities.forEach((opportunity) => {
        if (!opportunity.breakdowns || !Array.isArray(opportunity.breakdowns)) return;
        opportunity.breakdowns.forEach((breakdown) => {
          if (!isCampaignActive(breakdown.campaignStartedAt, breakdown.campaignEndedAt)) return;
          const apr = getMerklBreakdownApr(breakdown, tydroPointToUsdRate);
          const whitelistOnly = breakdown.whitelistOnly === true;
          const included = !whitelistOnly || includeWhitelistOnlyMerkl;
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
                forecastMultiplier: getMerklForecastUsdMultiplier(breakdown, tydroPointToUsdRate),
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
  const meritEstimateCampaignCount = useMemo(() => {
    const merits = type === 'supply' ? reserve.meritSupplys : reserve.meritBorrows;
    if (!Array.isArray(merits)) return 0;
    return merits.reduce((count, merit) => {
      if (!isCampaignActive(merit.startDate, merit.endDate)) return count;
      if (
        typeof merit.lastRoundRewardUsd !== 'number' ||
        !Number.isFinite(merit.lastRoundRewardUsd) ||
        merit.lastRoundRewardUsd <= 0
      ) {
        return count;
      }
      const cycleDays = getCampaignCycleDays(merit.startDate, merit.endDate);
      if (!cycleDays || cycleDays <= 0) return count;
      const forecastAprPercent = (typeof merit.apr === 'number' ? merit.apr : 0) + (typeof merit.selfApr === 'number' ? merit.selfApr : 0);
      if (!Number.isFinite(forecastAprPercent) || forecastAprPercent <= 0) {
        return count;
      }
      return count + 1;
    }, 0);
  }, [reserve, type]);
  const showForecastInput =
    campaignIds.length > 0 ||
    meritEstimateCampaignCount > 0 ||
    reserveRateInput !== null ||
    reserveRateInputLoading ||
    Boolean(reserveRateInputError);
  const whitelistOnlyCampaignCount = useMemo(() => {
    const opportunities = type === 'supply' ? reserve.merklSupplys : reserve.merklBorrows;
    if (!opportunities || !Array.isArray(opportunities)) return 0;
    return opportunities.reduce((count, opportunity) => {
      const breakdowns = opportunity.breakdowns ?? [];
      return (
        count +
        breakdowns.reduce((innerCount, breakdown) => innerCount + (breakdown.whitelistOnly ? 1 : 0), 0)
      );
    }, 0);
  }, [reserve, type]);
  const showWhitelistToggle = whitelistOnlyCampaignCount > 0;
  const merklForecastInput = showForecastInput ? (
    <div className="mb-[var(--ds-space-2)] rounded-lg border border-border/60 bg-muted/20 px-[var(--ds-space-2)] py-[var(--ds-space-2)]">
      <label className="ds-tooltip-body text-muted-foreground block mb-[var(--ds-space-1)]">
        Incentive Forecast Input (amount in {tokenSymbol})
      </label>
      <input
        value={depositInput}
        onChange={(event) => setDepositInput(formatNumberInput(event.target.value))}
        inputMode="decimal"
        placeholder="e.g. 100,000"
        className="w-full rounded-md border border-border bg-background px-[var(--ds-space-2)] py-[var(--ds-space-1-5)] ds-tooltip-body text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {tokenPrice ? (
        <p className="mt-[var(--ds-space-1)] ds-tooltip-body text-muted-foreground">
          ≈ {formatUsd(depositUsd)}
        </p>
      ) : tokenPriceLoading ? (
        <p className="mt-[var(--ds-space-1)] ds-tooltip-body text-muted-foreground">
          Fetching backup price...
        </p>
      ) : (
        <p className="mt-[var(--ds-space-1)] ds-tooltip-body text-muted-foreground">
          Price unavailable for {tokenSymbol}; forecast uses current TVL.
        </p>
      )}
      <p className="mt-[var(--ds-space-1)] ds-tooltip-body text-muted-foreground">
        Merkl forecasts support MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE, DUTCH_AUCTION, and FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE.
        Merit uses latest-round estimates when available.
      </p>
      <div className="mt-[var(--ds-space-1-5)] rounded-md border border-border/50 bg-muted/30 px-[var(--ds-space-2)] py-[var(--ds-space-1-5)]">
        <p className="ds-tooltip-body text-muted-foreground">
          Native {type === 'supply' ? 'supply' : 'borrow'} {nativeRateUnitLabel} simulation
        </p>
        {reserveRateInputLoading ? (
          <p className="ds-tooltip-body mt-[var(--ds-space-0-5)] text-muted-foreground">Loading rate inputs...</p>
        ) : reserveRateInputError ? (
          <p className="ds-tooltip-body mt-[var(--ds-space-0-5)] text-amber-600">
            Native simulation unavailable: {reserveRateInputError instanceof Error ? reserveRateInputError.message : 'failed to fetch rate inputs'}
          </p>
        ) : !reserveRateInput || !nativeSimulation ? (
          <p className="ds-tooltip-body mt-[var(--ds-space-0-5)] text-muted-foreground">
            Native simulation unavailable for this reserve.
          </p>
        ) : (
          <>
            {simulatedNativeRate !== null ? (
              <p className={`ds-tooltip-body mt-[var(--ds-space-0-5)] ${valueAccentClass}`}>
                Forecast {nativeRateUnitLabel} {formatPercent(simulatedNativeRate)}
                {nativeRateDelta !== null ? ` (${nativeRateDelta >= 0 ? '+' : ''}${nativeRateDelta.toFixed(2)}%)` : ''}
              </p>
            ) : (
              <p className="ds-tooltip-body mt-[var(--ds-space-0-5)] text-muted-foreground">
                Enter amount to simulate.
              </p>
            )}
            <p className="ds-tooltip-body mt-[var(--ds-space-0-5)] text-muted-foreground">
              Utilization {formatPercent(nativeSimulation.utilizationRatePercent)} · source {reserveRateInput.source}
            </p>
            <p className="ds-tooltip-body mt-[var(--ds-space-0-5)] text-muted-foreground">
              data: {reserveRateInput.sourceDetail}
            </p>
          </>
        )}
      </div>
      {showWhitelistToggle && (
        <label className="mt-[var(--ds-space-1)] flex items-center gap-[var(--ds-space-1-5)] ds-tooltip-body text-muted-foreground">
          <input
            type="checkbox"
            checked={includeWhitelistOnlyMerkl}
            onChange={(event) => onToggleWhitelistOnlyMerkl(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-border bg-background"
          />
          <span>
            Include whitelist-only Merkl campaigns
            {!includeWhitelistOnlyMerkl && whitelistOnlyCampaignCount > 0 ? ` (${whitelistOnlyCampaignCount} excluded)` : ''}
          </span>
        </label>
      )}
    </div>
  ) : null;

  const renderSourceCampaigns = (source: IncentiveSource, keyPrefix: string) => {
    const campaignsBase =
      source.campaigns ?? [{ value: source.value, dateRange: source.dateRange, message: source.message, sourceType: source.sourceType }];
    const campaigns = [...campaignsBase].sort((a, b) => {
      const aExcluded = a.whitelistOnly === true && a.included === false;
      const bExcluded = b.whitelistOnly === true && b.included === false;
      if (aExcluded === bExcluded) return 0;
      return aExcluded ? 1 : -1;
    });
    const getForecastPreview = (campaign: (typeof campaigns)[number]) => {
      const campaignSourceType = campaign.sourceType ?? source.sourceType;
      if (depositUsd <= 0) return null;
      if (campaignSourceType === 'Merkl' && campaign.campaignId) {
        if (campaign.whitelistOnly && campaign.included === false) return null;
        const forecastState = merklForecastStates[campaign.campaignId];
        if (!forecastState) {
          const errorMessage = merklForecastErrors[campaign.campaignId];
          return {
            unavailable: true,
            campaignId: campaign.campaignId,
            message: errorMessage || 'Forecast state unavailable',
          } as const;
        }

        const hypotheticalTvl = Math.max(forecastState.latestTvl + depositUsd, 0);
        const forecast = forecastWithTVL(forecastState, hypotheticalTvl);
        const multiplier =
          typeof campaign.forecastMultiplier === 'number' && Number.isFinite(campaign.forecastMultiplier)
            ? Math.max(campaign.forecastMultiplier, 0)
            : 1;
        const progress = deriveForecastProgressFlags(forecastState);
        return {
          unavailable: false,
          hypotheticalTvl,
          campaignType: forecastState.campaignType,
          dailyRewards: forecast.dailyRewards * multiplier,
          apr: forecast.apr * multiplier,
          regime: forecast.regime,
          fixRewardableDays: forecast.fixRewardableDays,
          fixRewardableUntilTs: forecast.fixRewardableUntilTs,
          ...progress,
        };
      }

      if (campaignSourceType === 'ACI') {
        return forecastMeritCampaign({
          mode: campaign.meritForecastMode === 'MERIT_SELF_CAP' ? 'MERIT_SELF_CAP' : 'MERIT_BASE',
          depositUsd,
          forecastAprPercent: campaign.forecastAprPercent,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          lastRoundRewardUsd: campaign.lastRoundRewardUsd,
          selfCapUsd: campaign.selfCapUsd,
          baseAprPercent: campaign.meritBaseAprPercent,
          baseLastRoundRewardUsd: campaign.meritBaseLastRoundRewardUsd,
        });
      }

      return null;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type AnyForecast = Record<string, any>;

    const toAvailableForecast = (
      fp: NonNullable<ReturnType<typeof getForecastPreview>>,
    ): AnyForecast | null => (fp.unavailable ? null : (fp as AnyForecast));

    const getForecastRateDisplay = (fp: AnyForecast) => {
      const forecastAprPercent = (fp.apr ?? 0) * 100;
      const displayPercent = isApy ? convertAprToApy(forecastAprPercent) : forecastAprPercent;
      const isSelfEstimate = typeof fp.selfCapUsd === 'number' || fp.estimateKind === 'MERIT_SELF_CAP';
      const rateUnitLabel = isApy ? 'APY' : 'APR';
      return {
        label:
          isSelfEstimate || fp.estimateKind === 'MERIT_CURRENT_RATE'
            ? `Your ${rateUnitLabel}`
            : `Forecast ${rateUnitLabel}`,
        valuePercent: displayPercent,
      };
    };

    const getForecastDailyRewardsLabel = (fp: AnyForecast) =>
      typeof fp.selfCapUsd === 'number' || fp.estimateKind === 'MERIT_CURRENT_RATE'
        ? 'Your Daily Rewards'
        : 'Total Daily Rewards';

    if (campaigns.length === 1) {
      const campaign = campaigns[0];
      const isExcludedWhitelist = campaign.whitelistOnly === true && campaign.included === false;
      const forecastPreview = getForecastPreview(campaign);
      const messageLines = getMessageLines(campaign.message);
      const campaignAccentClass = isExcludedWhitelist ? 'text-zinc-500' : valueAccentClass;
      const displayValue = isExcludedWhitelist ? campaign.rawValue ?? campaign.value : campaign.value;
      return (
        <>
          {isExcludedWhitelist && (
            <p className="ds-tooltip-body mt-[var(--ds-space-1)] text-zinc-500">
              Whitelist-only campaign (excluded) · {formatPercent(displayValue)}
            </p>
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
          {forecastPreview && (() => {
            const fp = toAvailableForecast(forecastPreview);
            if (!fp) return null;
            <div className="mt-[var(--ds-space-1-5)] rounded-md border border-border/50 bg-muted/30 px-[var(--ds-space-2)] py-[var(--ds-space-1-5)]">
              <p className="ds-tooltip-body text-muted-foreground">
                {typeof fp.hypotheticalTvl === 'number'
                  ? `Forecast at TVL ${formatUsd(fp.hypotheticalTvl)}`
                  : 'Estimate for your deposit'}
              </p>
              {(() => {
                const rateDisplay = getForecastRateDisplay(fp);
                if (!rateDisplay) return null;
                return (
              <p className={`ds-tooltip-body mt-[var(--ds-space-0-5)] ${valueAccentClass}`}>
                {rateDisplay.label} {formatPercent(rateDisplay.valuePercent)} · {getForecastDailyRewardsLabel(fp)}{' '}
                {formatUsd(fp.dailyRewards)}
                  </p>
                );
              })()}
              {fp.usesCurrentRateFallback && (
                <p className="ds-tooltip-body text-muted-foreground mt-[var(--ds-space-0-5)]">
                  Using current APR because latest-round reward data is unavailable.
                </p>
              )}
              {fp.estimateKind === 'MERIT_BASE' ? (
                <p className="ds-tooltip-body text-muted-foreground mt-[var(--ds-space-0-5)]">
                  Estimated from last round reward
                  {typeof fp.lastRoundRewardUsd === 'number'
                    ? ` (${formatUsd(fp.lastRoundRewardUsd)})`
                    : ''}.
                </p>
              ) : typeof fp.selfCapUsd === 'number' ? (
                <p className="ds-tooltip-body text-muted-foreground mt-[var(--ds-space-0-5)]">
                  Self bonus applies to the first {formatUsd(fp.selfCapUsd)} of your deposit.
                </p>
              ) : null}
              {'fixRewardableDays' in fp &&
                fp.campaignType === 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE' &&
                typeof fp.fixRewardableDays === 'number' &&
                typeof fp.fixRewardableUntilTs === 'number' && (
                  <p className={`ds-tooltip-body mt-[var(--ds-space-0-5)] font-medium ${valueAccentClass}`}>
                    Rewardable until: {formatForecastTimestamp(fp.fixRewardableUntilTs)} (
                    {fp.fixRewardableDays.toFixed(2)}d)
                  </p>
                )}
            </div>
            );
          })()}
          {forecastPreview && forecastPreview.unavailable && (
            <p className="ds-tooltip-body mt-[var(--ds-space-1)] text-amber-600">
              Forecast unavailable for campaign {forecastPreview.campaignId}: {forecastPreview.message}
            </p>
          )}
        </>
      );
    }

    return (
      <div className="mt-[var(--ds-space-1)] space-y-[var(--ds-space-1-5)]">
        {campaigns.map((campaign, campaignIndex) => {
          const isExcludedWhitelist = campaign.whitelistOnly === true && campaign.included === false;
          const forecastPreview = getForecastPreview(campaign);
          const messageLines = getMessageLines(campaign.message);
          const campaignLabel = campaign.dateRange ? `Campaign time: ${campaign.dateRange}` : 'Campaign time: N/A';
          const campaignAccentClass = isExcludedWhitelist ? 'text-zinc-500' : valueAccentClass;
          const displayValue = isExcludedWhitelist ? campaign.rawValue ?? campaign.value : campaign.value;
          return (
            <div
              key={`${keyPrefix}-campaign-${campaignIndex}`}
              className={campaignIndex > 0 ? 'pt-[var(--ds-space-0-5)]' : ''}
            >
              {isExcludedWhitelist && (
                <p className="ds-tooltip-body text-zinc-500 mb-[var(--ds-space-0-5)]">
                  Whitelist-only campaign (excluded)
                </p>
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
              {forecastPreview && isAvailableForecast(forecastPreview) && (() => {
                const fp = forecastPreview as AnyForecast;
                return (
                <div className="mt-[var(--ds-space-1-5)] rounded-md border border-border/50 bg-muted/30 px-[var(--ds-space-2)] py-[var(--ds-space-1-5)]">
                  <p className="ds-tooltip-body text-muted-foreground">
                    {typeof fp.hypotheticalTvl === 'number'
                      ? `Forecast at TVL ${formatUsd(fp.hypotheticalTvl)}`
                      : 'Estimate for your deposit'}
                  </p>
                  {(() => {
                    const rateDisplay = getForecastRateDisplay(fp);
                    if (!rateDisplay) return null;
                    return (
                      <p className={`ds-tooltip-body mt-[var(--ds-space-0-5)] ${valueAccentClass}`}>
                        {rateDisplay.label} {formatPercent(rateDisplay.valuePercent)} · {getForecastDailyRewardsLabel(fp)}{' '}
                        {formatUsd(fp.dailyRewards)}
                      </p>
                    );
                  })()}
                  {fp.usesCurrentRateFallback && (
                    <p className="ds-tooltip-body text-muted-foreground mt-[var(--ds-space-0-5)]">
                      Using current APR because latest-round reward data is unavailable.
                    </p>
                  )}
                {fp.estimateKind === 'MERIT_BASE' ? (
                  <p className="ds-tooltip-body text-muted-foreground mt-[var(--ds-space-0-5)]">
                    Estimated from last round reward
                    {typeof fp.lastRoundRewardUsd === 'number'
                      ? ` (${formatUsd(fp.lastRoundRewardUsd)})`
                      : ''}.
                  </p>
                ) : typeof fp.selfCapUsd === 'number' ? (
                  <p className="ds-tooltip-body text-muted-foreground mt-[var(--ds-space-0-5)]">
                    Self bonus applies to the first {formatUsd(fp.selfCapUsd)} of your deposit.
                  </p>
                ) : null}
                  {'fixRewardableDays' in fp &&
                    fp.campaignType === 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE' &&
                    typeof fp.fixRewardableDays === 'number' &&
                    typeof fp.fixRewardableUntilTs === 'number' && (
                      <p className={`ds-tooltip-body mt-[var(--ds-space-0-5)] font-medium ${valueAccentClass}`}>
                        Rewardable until: {formatForecastTimestamp(fp.fixRewardableUntilTs)} (
                        {fp.fixRewardableDays.toFixed(2)}d)
                      </p>
                    )}
                </div>
                );
              })()}
              {forecastPreview && forecastPreview.unavailable && (
                <p className="ds-tooltip-body mt-[var(--ds-space-1)] text-amber-600">
                  Forecast unavailable for campaign {forecastPreview.campaignId}: {forecastPreview.message}
                </p>
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
      <>
        {/* Background overlay with smooth fade */}
        <div 
          className="fixed inset-0 z-30 bg-background/20" 
          onClick={onClose}
        />
        {/* Bottom sheet with spring-like animation */}
        <div
          ref={tooltipRef}
          className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl border border-border/60 bg-card ds-tooltip-shadow-up max-h-[80vh] overflow-y-auto"
          style={tooltipSurfaceStyle}
        >
          {/* Handle bar */}
          <div className="sticky top-0 bg-card border-b border-border px-[var(--ds-space-4)] py-[var(--ds-space-3)] flex items-center justify-between z-10">
            <h3 className="ds-tooltip-title text-foreground">
              {type === 'supply' ? 'Supply' : 'Borrow'} Incentive Details
            </h3>
            <button
              onClick={onClose}
              className="p-[var(--ds-space-1-5)] rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          
          <div className="ds-tooltip-pad pt-[var(--ds-space-3)] pb-[var(--ds-space-3)]">
            {merklForecastInput}
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
                              target="_blank"
                              rel="noopener noreferrer"
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
            
          </div>
        </div>
      </>
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
        className={`fixed z-40 rounded-xl border border-border/60 bg-card ds-tooltip-pad ds-tooltip-shadow max-w-[min(520px,calc(100vw-32px))] w-[min(520px,calc(100vw-32px))] min-w-[320px] animate-in fade-in-0 zoom-in-95 duration-200 ease-out ${
          tooltipPlacement === 'top' ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1'
        }`}
        style={{ 
          left: `${tooltipLeft ?? position.x}px`,
          top: `${tooltipTop ?? position.y + 8}px`,
          ...tooltipSurfaceStyle,
        }}
      >
        {/* Upward-pointing arrow - dynamically positioned, appears as border extension */}
        {showTooltipArrow && (
          <div 
            className={`absolute w-4 h-4 border-border/60 transform bg-card ${
              tooltipPlacement === 'top'
                ? '-bottom-2 border-r border-b rotate-45'
                : '-top-2 border-l border-t rotate-45'
            }`}
            style={{ 
              left: `${arrowLeft}px`,
              ...tooltipSurfaceStyle,
            }}
          />
        )}
        {/* Content area */}
        <div className="w-full min-w-0 max-h-[calc(100vh-32px)] overflow-y-auto overscroll-contain pr-1">
          {merklForecastInput}
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
                            target="_blank"
                            rel="noopener noreferrer"
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
