import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

import type { ReserveWithSpread, TokenPricesIndex, MerklCampaignBreakdown } from '@/types/aave';
import { collectMerklCampaignOptions, collectWhitelistOnlyMerklCampaignEntries } from '@/lib/merklCampaigns';
import { useMerklForecastStates } from '@/hooks/useMerklForecastStates';
import { deriveForecastProgressFlags, forecastWithTVL, type MerklForecastState } from '@/lib/merklForecast';
import { resolveForecastTokenPrice, resolveForecastTokenPriceWithBackup } from '@/lib/tokenPriceResolver';
import { formatPercent, MERKL_WHITELIST_TOGGLE_ARIA, MERKL_WHITELIST_TOGGLE_LABEL } from '@/lib/formatters';
import { formatNumberInput, parseNumberInput } from '@/lib/numberFormat';

interface MerklForecastPanelProps {
  reserves: ReserveWithSpread[];
  tokenPrices?: TokenPricesIndex;
  tydroPointToUsdRate: number;
  whitelistMerklCampaignIds: ReadonlySet<string>;
  onToggleWhitelistMerklCampaign: (campaignId: string, enabled: boolean) => void;
}

const formatUsd = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);

const formatDateTime = (unixSeconds: number): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(unixSeconds * 1000));

const formatDays = (days: number): string =>
  `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: days >= 10 ? 1 : 2,
  }).format(days)} day${days >= 1.5 ? 's' : ''}`;

const findBreakdownByCampaignId = (reserves: ReserveWithSpread[], campaignId: string): MerklCampaignBreakdown | undefined => {
  for (const reserve of reserves) {
    for (const groups of [reserve.merklSupplys, reserve.merklBorrows, reserve.merklHolds]) {
      for (const group of groups ?? []) {
        for (const bd of group.breakdowns ?? []) {
          if (String(bd.campaignId) === campaignId) return bd;
        }
      }
    }
  }
  return undefined;
};

const MerklForecastPanel = ({
  reserves,
  tokenPrices,
  tydroPointToUsdRate,
  whitelistMerklCampaignIds,
  onToggleWhitelistMerklCampaign,
}: MerklForecastPanelProps) => {
  const whitelistEntries = useMemo(() => collectWhitelistOnlyMerklCampaignEntries(reserves), [reserves]);
  const campaignOptions = useMemo(
    () =>
      collectMerklCampaignOptions(reserves, {
        whitelistMerklCampaignIds,
        activeOnly: true,
      }),
    [whitelistMerklCampaignIds, reserves]
  );
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [depositInput, setDepositInput] = useState('100,000');
  const [tokenPrice, setTokenPrice] = useState<number | undefined>(undefined);
  const [tokenPriceLoading, setTokenPriceLoading] = useState(false);

  const campaignIdsForHook = useMemo(
    () => campaignOptions.map((option) => option.campaignId),
    [campaignOptions]
  );
  const { states, errors: stateErrors, isLoading: loading, error: queryError } = useMerklForecastStates(campaignIdsForHook);

  useEffect(() => {
    if (campaignOptions.length === 0) {
      setSelectedCampaignId('');
      return;
    }
    if (!selectedCampaignId || !campaignOptions.some((option) => option.campaignId === selectedCampaignId)) {
      setSelectedCampaignId(campaignOptions[0].campaignId);
    }
  }, [campaignOptions, selectedCampaignId]);


  const selectedOption = useMemo(
    () => campaignOptions.find((option) => option.campaignId === selectedCampaignId) || null,
    [campaignOptions, selectedCampaignId]
  );

  const tokenSymbol = selectedOption?.tokenSymbol ?? 'Token';

  useEffect(() => {
    if (!selectedOption) {
      setTokenPrice(undefined);
      setTokenPriceLoading(false);
      return;
    }

    const lookupInput = {
      tokenPrices,
      chainId: selectedOption.chainId,
      actionType: selectedOption.actionType,
      tokenSymbol: selectedOption.tokenSymbol,
      tokenAddress: selectedOption.tokenAddress,
      aTokenAddress: selectedOption.aTokenAddress,
      vTokenAddress: selectedOption.vTokenAddress,
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
  }, [selectedOption, tokenPrices]);

  const depositAssetAmount = useMemo(() => parseNumberInput(depositInput), [depositInput]);
  const depositUsd = tokenPrice ? depositAssetAmount * tokenPrice : 0;

  const selectedMetrics = selectedCampaignId ? states[selectedCampaignId] : undefined;
  const selectedBreakdown = useMemo(
    () => (selectedCampaignId ? findBreakdownByCampaignId(reserves, selectedCampaignId) : undefined),
    [reserves, selectedCampaignId]
  );

  const mergedState: MerklForecastState | undefined = useMemo(() => {
    if (!selectedBreakdown?.campaignType) return undefined;
    return {
      campaignType: selectedBreakdown.campaignType,
      totalBudget: selectedBreakdown.totalBudget,
      aprCap: selectedBreakdown.aprCap,
      latestTvl: selectedBreakdown.latestTvl,
      plannedDaily: selectedBreakdown.plannedDaily,
      requiredDaily: selectedMetrics?.requiredDaily,
      distributedSoFar: selectedMetrics?.distributedSoFar,
      endTimestamp: selectedMetrics?.endTimestamp,
    };
  }, [selectedBreakdown, selectedMetrics]);

  const forecast = useMemo(() => {
    if (!mergedState || !selectedOption) return null;
    const hypotheticalTvl = Math.max((mergedState.latestTvl ?? 0) + depositUsd, 0);
    const baseForecast = forecastWithTVL(mergedState, hypotheticalTvl);
    const forecastMultiplier = selectedOption.usesPointToUsdRate
      ? Math.max(tydroPointToUsdRate, 0)
      : 1;
    const progress = deriveForecastProgressFlags(mergedState);
    return {
      hypotheticalTvl,
      dailyRewards: baseForecast.dailyRewards * forecastMultiplier,
      apr: baseForecast.apr * forecastMultiplier,
      regime: baseForecast.regime,
      fixRewardableDays: baseForecast.fixRewardableDays,
      fixRewardableUntilTs: baseForecast.fixRewardableUntilTs,
      ...progress,
    };
  }, [depositUsd, selectedOption, mergedState, tydroPointToUsdRate]);

  if (campaignOptions.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-border/60 bg-card/80 p-[var(--ds-space-3)] md:p-[var(--ds-space-4)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm md:text-base font-semibold text-foreground">Merkl Campaign Forecast</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Estimate next-run daily rewards and APR after adding a hypothetical deposit (MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE, DUTCH_AUCTION, FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE).
          </p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {whitelistEntries.length > 0 && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">{MERKL_WHITELIST_TOGGLE_LABEL}:</p>
          <ul className="space-y-1.5">
            {whitelistEntries.map((entry) => (
              <li key={entry.campaignId}>
                <label
                  className="inline-flex items-start gap-2 text-xs text-muted-foreground"
                  aria-label={`${MERKL_WHITELIST_TOGGLE_ARIA} ${entry.label}`}
                >
                  <input
                    type="checkbox"
                    checked={whitelistMerklCampaignIds.has(entry.campaignId)}
                    onChange={(event) => onToggleWhitelistMerklCampaign(entry.campaignId, event.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border bg-background"
                  />
                  <span className="min-w-0 break-words" aria-hidden="true">
                    {entry.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Campaign
          <select
            value={selectedCampaignId}
            onChange={(event) => setSelectedCampaignId(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {campaignOptions.map((option) => (
              <option key={option.campaignId} value={option.campaignId}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-muted-foreground">
          Amount ({tokenSymbol})
          <input
            value={depositInput}
            onChange={(event) => setDepositInput(formatNumberInput(event.target.value))}
            inputMode="decimal"
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="e.g. 100,000"
          />
          {tokenPrice ? (
            <span className="mt-1 block text-[11px] text-muted-foreground">
              ≈ {formatUsd(depositUsd)}
            </span>
          ) : tokenPriceLoading ? (
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Fetching backup price...
            </span>
          ) : (
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Price unavailable for {tokenSymbol}; forecast uses current supply.
            </span>
          )}
        </label>
      </div>

      {queryError && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{queryError.message || 'Failed to load campaign forecast states.'}</span>
        </div>
      )}

      {!mergedState && !loading && (
        <p className="mt-3 text-xs text-muted-foreground">
          Forecast state is not available for the selected campaign yet.
          {selectedCampaignId && stateErrors[selectedCampaignId] ? ` (${stateErrors[selectedCampaignId]})` : ''}
        </p>
      )}

      {mergedState && forecast && (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="rounded-md border border-border/60 bg-muted/20 p-2">
            <p className="text-[11px] text-muted-foreground">Hypothetical Supply</p>
            <p className="text-sm font-semibold text-foreground mt-1">{formatUsd(forecast.hypotheticalTvl)}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 p-2">
            <p className="text-[11px] text-muted-foreground">Forecast Daily Rewards</p>
            <p className="text-sm font-semibold text-foreground mt-1">{formatUsd(forecast.dailyRewards)}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 p-2">
            <p className="text-[11px] text-muted-foreground">Forecast APR</p>
            <p className="text-sm font-semibold text-foreground mt-1">{formatPercent(forecast.apr * 100)}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 p-2 md:col-span-3">
            <p className="text-[11px] text-muted-foreground">
              Type: {mergedState.campaignType} · Regime: {forecast.regime} · Ended under-distributed:{' '}
              {forecast.isUnderDistributed ? 'Yes' : 'No'}
            </p>
          </div>
          {mergedState.campaignType === 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE' &&
            typeof forecast.fixRewardableDays === 'number' &&
            typeof forecast.fixRewardableUntilTs === 'number' &&
            typeof mergedState.endTimestamp === 'number' && (
              <div className="rounded-md border border-border/60 bg-muted/20 p-2 md:col-span-3">
                <p className="text-[11px] text-muted-foreground">FIX Rewardable Window (campaign-level)</p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  Now → {formatDateTime(forecast.fixRewardableUntilTs)} ({formatDays(forecast.fixRewardableDays)})
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Campaign window baseline: Now → {formatDateTime(mergedState.endTimestamp)}
                </p>
              </div>
            )}
        </div>
      )}
    </section>
  );
};

export default MerklForecastPanel;
