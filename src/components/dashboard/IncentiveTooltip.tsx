import { useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { ReserveWithSpread, MeritIncentive, MerklOpportunityGroup, BrevisIncentive, TokenPricesIndex, MerklForecastStateResponse } from '@/types/aave';
import { formatPercent, convertAprToApy } from '@/lib/formatters';
import { getMerklBreakdownApr, getMerklForecastUsdMultiplier } from '@/lib/tydro';
import { fetchMerklForecastStates } from '@/lib/merklForecastApi';
import { deriveForecastProgressFlags, forecastWithTVL } from '@/lib/merklForecast';
import { resolveForecastTokenPrice, resolveForecastTokenPriceWithBackup } from '@/lib/merklTokenPrice';
import { shouldSurfaceForecastError } from '@/lib/merklForecastErrors';
import { formatNumberInput, parseNumberInput } from '@/lib/numberFormat';
import { adjustTooltipAnchorForScroll, getWindowScroll } from '@/lib/tooltipPosition';
import { useIsMobile } from '@/hooks/use-mobile';

interface IncentiveTooltipProps {
  pool: ReserveWithSpread;
  type: 'supply' | 'borrow';
  position: { x: number; y: number };
  triggerCenterX: number;
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
    message?: string | Record<string, unknown> | unknown[];
    campaignId?: string;
    sourceType?: IncentiveSource['sourceType'];
    forecastMultiplier?: number;
    whitelistOnly?: boolean;
    included?: boolean;
    rawValue?: number;
    estimatedDailyRewardUsd?: number;
    estimatedImpliedTvlUsd?: number;
    estimatedRoundCampaignId?: string;
    estimatedRoundIntervalDays?: number;
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
  pool,
  type,
  position,
  triggerCenterX,
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

  const tokenSymbol = pool.tokenSymbol || 'Token';

  useEffect(() => {
    setOpenedAtScroll(getWindowScroll());
  }, [position.x, position.y, triggerCenterX, type]);

  useEffect(() => {
    const lookupInput = {
      tokenPrices,
      chainId: pool.chainId,
      actionType: type === 'supply' ? 'Supply' : 'Borrow',
      tokenSymbol: pool.tokenSymbol,
      tokenAddress: pool.tokenAddress,
      aTokenAddress: pool.aTokenAddress,
      vTokenAddress: pool.vTokenAddress,
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
  }, [pool, type, tokenPrices]);

  const depositAssetAmount = useMemo(() => parseNumberInput(depositInput), [depositInput]);
  const depositUsd = tokenPrice ? depositAssetAmount * tokenPrice : 0;

  const campaignIds = useMemo(() => {
    const opportunities = type === 'supply' ? pool.merklSupplys : pool.merklBorrows;
    if (!opportunities || !Array.isArray(opportunities)) return [];
    const ids = new Set<string>();
    opportunities.forEach((opportunity) => {
      opportunity.breakdowns?.forEach((breakdown) => {
        if (!isCampaignActive(breakdown.campaignStartedAt, breakdown.campaignEndedAt)) return;
        if (breakdown?.campaignId) ids.add(String(breakdown.campaignId));
      });
    });
    return Array.from(ids);
  }, [pool, type]);

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
    const protocolIncentives = type === 'supply' ? pool.supplyIncentives : pool.borrowIncentives;
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
    const meritIncentives: MeritIncentive[] | undefined = type === 'supply' ? pool.meritSupplys : pool.meritBorrows;
    if (meritIncentives && Array.isArray(meritIncentives)) {
      meritIncentives.forEach((merit, index) => {
        if (!isCampaignActive(merit.startDate, merit.endDate)) return;
        const apr = merit.apr;
        const selfApr = merit.selfApr || 0;
        
        // Convert each APR to APY separately then sum (convertAprToApy is non-linear)
        let totalValue = 0;
        if (isApy) {
          if (!isNaN(apr) && apr >= 0) {
            totalValue += convertAprToApy(apr);
          }
          if (!isNaN(selfApr) && selfApr >= 0) {
            totalValue += convertAprToApy(selfApr);
          }
        } else {
          // For APR mode, just sum the APR values
          totalValue = (!isNaN(apr) && apr >= 0 ? apr : 0) + (!isNaN(selfApr) && selfApr >= 0 ? selfApr : 0);
        }
        
        if (totalValue >= 0) {
          const name = merit.name
            ? merit.name
            : meritIncentives.length > 1 
              ? `ACI Incentive ${index + 1}`
              : 'ACI Incentive';

          sources.push({
            name,
            value: totalValue,
            color: 'text-foreground',
            bgColor: 'bg-muted/60',
            sourceType: 'ACI',
            link: merit.link,
            message: merit.message,
            dateRange: formatDateRange(merit.startDate, merit.endDate) || undefined,
            campaigns: [{
              value: totalValue,
              dateRange: formatDateRange(merit.startDate, merit.endDate) || undefined,
              message: merit.message,
              estimatedDailyRewardUsd: merit.estimatedDailyRewardUsd,
              estimatedImpliedTvlUsd: merit.estimatedImpliedTvlUsd,
              estimatedRoundCampaignId: merit.estimatedRoundCampaignId,
              estimatedRoundIntervalDays: merit.estimatedRoundIntervalDays,
            }],
          });
        }
      });
    }

    // Brevis incentives (array)
    const brevisIncentives: BrevisIncentive[] | undefined =
      type === 'supply' ? pool.brevisSupplys : pool.brevisBorrows;

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
            }],
          });
        }
      });
    }

    // Merkl incentives (use breakdowns for date range)
    const opportunities = type === 'supply' ? pool.merklSupplys : pool.merklBorrows;
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
    const merits = type === 'supply' ? pool.meritSupplys : pool.meritBorrows;
    if (!Array.isArray(merits)) return 0;
    return merits.reduce((count, merit) => {
      if (!isCampaignActive(merit.startDate, merit.endDate)) return count;
      if (
        typeof merit.estimatedDailyRewardUsd !== 'number' ||
        !Number.isFinite(merit.estimatedDailyRewardUsd) ||
        merit.estimatedDailyRewardUsd <= 0
      ) {
        return count;
      }
      if (
        typeof merit.estimatedImpliedTvlUsd !== 'number' ||
        !Number.isFinite(merit.estimatedImpliedTvlUsd) ||
        merit.estimatedImpliedTvlUsd <= 0
      ) {
        return count;
      }
      return count + 1;
    }, 0);
  }, [pool, type]);
  const showForecastInput = campaignIds.length > 0 || meritEstimateCampaignCount > 0;
  const whitelistOnlyCampaignCount = useMemo(() => {
    const opportunities = type === 'supply' ? pool.merklSupplys : pool.merklBorrows;
    if (!opportunities || !Array.isArray(opportunities)) return 0;
    return opportunities.reduce((count, opportunity) => {
      const breakdowns = opportunity.breakdowns ?? [];
      return (
        count +
        breakdowns.reduce((innerCount, breakdown) => innerCount + (breakdown.whitelistOnly ? 1 : 0), 0)
      );
    }, 0);
  }, [pool, type]);
  const showWhitelistToggle = whitelistOnlyCampaignCount > 0 || includeWhitelistOnlyMerkl;
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
      if (depositUsd <= 0) return null;
      if (campaign.sourceType === 'Merkl' && campaign.campaignId) {
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

      if (campaign.sourceType === 'ACI') {
        const estimatedDailyRewardUsd = campaign.estimatedDailyRewardUsd;
        const estimatedImpliedTvlUsd = campaign.estimatedImpliedTvlUsd;
        if (
          typeof estimatedDailyRewardUsd !== 'number' ||
          !Number.isFinite(estimatedDailyRewardUsd) ||
          estimatedDailyRewardUsd <= 0
        ) {
          return null;
        }
        if (
          typeof estimatedImpliedTvlUsd !== 'number' ||
          !Number.isFinite(estimatedImpliedTvlUsd) ||
          estimatedImpliedTvlUsd <= 0
        ) {
          return null;
        }

        const hypotheticalTvl = Math.max(estimatedImpliedTvlUsd + depositUsd, 0);
        const apr = hypotheticalTvl > 0 ? (estimatedDailyRewardUsd * 365) / hypotheticalTvl : 0;
        return {
          unavailable: false,
          hypotheticalTvl,
          campaignType: 'MERIT_ESTIMATE',
          dailyRewards: estimatedDailyRewardUsd,
          apr,
          regime: 'PLANNED',
          isUnderDistributed: false,
          estimateKind: 'MERIT_LATEST_ROUND' as const,
          estimatedRoundCampaignId: campaign.estimatedRoundCampaignId,
          estimatedRoundIntervalDays: campaign.estimatedRoundIntervalDays,
        };
      }

      return null;
    };

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
          {forecastPreview && !forecastPreview.unavailable && (
            <div className="mt-[var(--ds-space-1-5)] rounded-md border border-border/50 bg-muted/30 px-[var(--ds-space-2)] py-[var(--ds-space-1-5)]">
              <p className="ds-tooltip-body text-muted-foreground">
                Forecast at TVL {formatUsd(forecastPreview.hypotheticalTvl)}
              </p>
              <p className={`ds-tooltip-body mt-[var(--ds-space-0-5)] ${valueAccentClass}`}>
                APR {formatPercent(forecastPreview.apr * 100)} · Daily Rewards {formatUsd(forecastPreview.dailyRewards)}
              </p>
              {forecastPreview.estimateKind === 'MERIT_LATEST_ROUND' ? (
                <p className="ds-tooltip-body text-muted-foreground mt-[var(--ds-space-0-5)]">
                  Estimated from latest Merkl round
                  {forecastPreview.estimatedRoundCampaignId ? ` (${forecastPreview.estimatedRoundCampaignId})` : ''}.
                  {typeof forecastPreview.estimatedRoundIntervalDays === 'number'
                    ? ` Interval: ${forecastPreview.estimatedRoundIntervalDays.toFixed(2)}d`
                    : ''}
                </p>
              ) : (
                <p className="ds-tooltip-body text-muted-foreground mt-[var(--ds-space-0-5)]">
                  Type: {forecastPreview.campaignType} · Regime: {forecastPreview.regime} · Ended under-distributed:{' '}
                  {forecastPreview.isUnderDistributed ? 'Yes' : 'No'}
                </p>
              )}
              {forecastPreview.campaignType === 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE' &&
                typeof forecastPreview.fixRewardableDays === 'number' &&
                typeof forecastPreview.fixRewardableUntilTs === 'number' && (
                  <p className="ds-tooltip-body text-muted-foreground mt-[var(--ds-space-0-5)]">
                    Rewardable until {formatForecastTimestamp(forecastPreview.fixRewardableUntilTs)} (
                    {forecastPreview.fixRewardableDays.toFixed(2)}d)
                  </p>
                )}
            </div>
          )}
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
              {forecastPreview && !forecastPreview.unavailable && (
                <div className="mt-[var(--ds-space-1-5)] rounded-md border border-border/50 bg-muted/30 px-[var(--ds-space-2)] py-[var(--ds-space-1-5)]">
                  <p className="ds-tooltip-body text-muted-foreground">
                    Forecast at TVL {formatUsd(forecastPreview.hypotheticalTvl)}
                  </p>
                  <p className={`ds-tooltip-body mt-[var(--ds-space-0-5)] ${valueAccentClass}`}>
                    APR {formatPercent(forecastPreview.apr * 100)} · Daily Rewards {formatUsd(forecastPreview.dailyRewards)}
                  </p>
                  {forecastPreview.estimateKind === 'MERIT_LATEST_ROUND' ? (
                    <p className="ds-tooltip-body text-muted-foreground mt-[var(--ds-space-0-5)]">
                      Estimated from latest Merkl round
                      {forecastPreview.estimatedRoundCampaignId ? ` (${forecastPreview.estimatedRoundCampaignId})` : ''}.
                      {typeof forecastPreview.estimatedRoundIntervalDays === 'number'
                        ? ` Interval: ${forecastPreview.estimatedRoundIntervalDays.toFixed(2)}d`
                        : ''}
                    </p>
                  ) : (
                    <p className="ds-tooltip-body text-muted-foreground mt-[var(--ds-space-0-5)]">
                      Type: {forecastPreview.campaignType} · Regime: {forecastPreview.regime} · Ended under-distributed:{' '}
                      {forecastPreview.isUnderDistributed ? 'Yes' : 'No'}
                    </p>
                  )}
                  {forecastPreview.campaignType === 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE' &&
                    typeof forecastPreview.fixRewardableDays === 'number' &&
                    typeof forecastPreview.fixRewardableUntilTs === 'number' && (
                      <p className="ds-tooltip-body text-muted-foreground mt-[var(--ds-space-0-5)]">
                        Rewardable until {formatForecastTimestamp(forecastPreview.fixRewardableUntilTs)} (
                        {forecastPreview.fixRewardableDays.toFixed(2)}d)
                      </p>
                    )}
                </div>
              )}
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
      const tooltipWidth = tooltipRef.current.offsetWidth;
      const minLeft = 16;
      const maxLeft = Math.max(minLeft, window.innerWidth - tooltipWidth - minLeft);
      const baseLeft =
        type === 'borrow'
          ? anchored.triggerCenterX - tooltipWidth + 24
          : anchored.position.x;
      const nextLeft = Math.min(Math.max(baseLeft, minLeft), maxLeft);
      setTooltipLeft(nextLeft);
      setTooltipTop(anchored.position.y + 8);

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

    return () => {
      cancelAnimationFrame(outerRafId);
      if (innerRafId !== null) {
        cancelAnimationFrame(innerRafId);
      }
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [triggerCenterX, position, type, openedAtScroll]);

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
                                loading="lazy"
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
        className="fixed z-40 rounded-xl border border-border/60 bg-card ds-tooltip-pad ds-tooltip-shadow max-w-[min(520px,calc(100vw-32px))] w-[min(520px,calc(100vw-32px))] min-w-[320px] animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-200 ease-out"
        style={{ 
          left: `${tooltipLeft ?? position.x}px`,
          top: `${tooltipTop ?? position.y + 8}px`,
          ...tooltipSurfaceStyle,
        }}
      >
        {/* Upward-pointing arrow - dynamically positioned, appears as border extension */}
        <div 
          className="absolute -top-2 w-4 h-4 border-l border-t border-border/60 transform rotate-45 bg-card"
          style={{ 
            left: `${arrowLeft}px`,
            ...tooltipSurfaceStyle,
          }}
        />
        {/* Content area */}
        <div className="w-full min-w-0">
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
                              loading="lazy"
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
