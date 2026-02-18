import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

import type { PoolWithSpread, TokenPricesIndex, MerklForecastStateResponse } from '@/types/aave';
import { collectMerklCampaignOptions } from '@/lib/merklCampaigns';
import { fetchMerklForecastStates } from '@/lib/merklForecastApi';
import { shouldSurfaceForecastError } from '@/lib/merklForecastErrors';
import { deriveForecastProgressFlags, forecastWithTVL } from '@/lib/merklForecast';
import { resolveForecastTokenPrice, resolveForecastTokenPriceWithBackup } from '@/lib/merklTokenPrice';
import { formatPercent } from '@/lib/formatters';
import { formatNumberInput, parseNumberInput } from '@/lib/numberFormat';

interface MerklForecastPanelProps {
  pools: PoolWithSpread[];
  tokenPrices?: TokenPricesIndex;
  tydroPointToUsdRate: number;
  includeWhitelistOnlyMerkl: boolean;
  onToggleWhitelistOnlyMerkl: (next: boolean) => void;
}

const formatUsd = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);

const MerklForecastPanel = ({
  pools,
  tokenPrices,
  tydroPointToUsdRate,
  includeWhitelistOnlyMerkl,
  onToggleWhitelistOnlyMerkl,
}: MerklForecastPanelProps) => {
  const campaignOptions = useMemo(
    () =>
      collectMerklCampaignOptions(pools, {
        includeWhitelistOnly: includeWhitelistOnlyMerkl,
      }),
    [includeWhitelistOnlyMerkl, pools]
  );
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [depositInput, setDepositInput] = useState('100,000');
  const [loading, setLoading] = useState(false);
  const [states, setStates] = useState<Record<string, MerklForecastStateResponse>>({});
  const [stateErrors, setStateErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [tokenPrice, setTokenPrice] = useState<number | undefined>(undefined);
  const [tokenPriceLoading, setTokenPriceLoading] = useState(false);

  useEffect(() => {
    if (campaignOptions.length === 0) {
      setSelectedCampaignId('');
      return;
    }
    if (!selectedCampaignId || !campaignOptions.some((option) => option.campaignId === selectedCampaignId)) {
      setSelectedCampaignId(campaignOptions[0].campaignId);
    }
  }, [campaignOptions, selectedCampaignId]);

  useEffect(() => {
    if (campaignOptions.length === 0) {
      setStates({});
      setStateErrors({});
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchMerklForecastStates(campaignOptions.map((option) => option.campaignId))
      .then((result) => {
        if (cancelled) return;
        const next: Record<string, MerklForecastStateResponse> = {};
        const nextErrors: Record<string, string> = {};
        result.items.forEach((item) => {
          next[item.campaignId] = item;
        });
        const surfacedErrors = result.errors.filter((item) => shouldSurfaceForecastError(item));
        surfacedErrors.forEach((item) => {
          nextErrors[item.campaignId] = item.message;
        });
        const failed = surfacedErrors.length;

        setStates((prev) => ({ ...prev, ...next }));
        setStateErrors(nextErrors);
        if (failed > 0) {
          const details = surfacedErrors
            .slice(0, 3)
            .map((item) => `${item.campaignId} (${item.status})`)
            .join(', ');
          setError(
            `Failed to load ${failed} campaign forecast state${failed > 1 ? 's' : ''}${details ? `: ${details}` : ''}.`
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (shouldSurfaceForecastError(err)) {
          setError('Failed to load campaign forecast states.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campaignOptions]);

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

  const selectedState = selectedCampaignId ? states[selectedCampaignId] : undefined;
  const forecast = useMemo(() => {
    if (!selectedState || !selectedOption) return null;
    const hypotheticalTvl = Math.max(selectedState.latestTvl + depositUsd, 0);
    const baseForecast = forecastWithTVL(selectedState, hypotheticalTvl);
    const forecastMultiplier = selectedOption.usesPointToUsdRate
      ? Math.max(tydroPointToUsdRate, 0)
      : 1;
    const progress = deriveForecastProgressFlags(selectedState);
    return {
      hypotheticalTvl,
      dailyRewards: baseForecast.dailyRewards * forecastMultiplier,
      apr: baseForecast.apr * forecastMultiplier,
      regime: baseForecast.regime,
      ...progress,
    };
  }, [depositUsd, selectedOption, selectedState, tydroPointToUsdRate]);

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

      <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={includeWhitelistOnlyMerkl}
          onChange={(event) => onToggleWhitelistOnlyMerkl(event.target.checked)}
          className="h-3.5 w-3.5 rounded border-border bg-background"
        />
        Include whitelist-only Merkl campaigns
      </label>

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
              Price unavailable for {tokenSymbol}; forecast uses current TVL.
            </span>
          )}
        </label>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!selectedState && !loading && (
        <p className="mt-3 text-xs text-muted-foreground">
          Forecast state is not available for the selected campaign yet.
          {selectedCampaignId && stateErrors[selectedCampaignId] ? ` (${stateErrors[selectedCampaignId]})` : ''}
        </p>
      )}

      {selectedState && forecast && (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className="rounded-md border border-border/60 bg-muted/20 p-2">
            <p className="text-[11px] text-muted-foreground">Hypothetical TVL</p>
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
              Type: {selectedState.campaignType} · Regime: {forecast.regime} · Ended under-distributed:{' '}
              {forecast.isUnderDistributed ? 'Yes' : 'No'}
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export default MerklForecastPanel;
