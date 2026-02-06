import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

import type { PoolWithSpread } from '@/types/aave';
import { collectMerklCampaignOptions } from '@/lib/merklCampaigns';
import { fetchMerklForecastState, fetchMerklForecastStates } from '@/lib/merklForecastApi';
import { shouldSurfaceForecastError } from '@/lib/merklForecastErrors';
import { forecastWithTVL } from '@/lib/merklForecast';
import { formatPercent } from '@/lib/formatters';

interface MerklForecastPanelProps {
  pools: PoolWithSpread[];
}

const formatUsd = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);

const MerklForecastPanel = ({ pools }: MerklForecastPanelProps) => {
  const campaignOptions = useMemo(() => collectMerklCampaignOptions(pools), [pools]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [depositInput, setDepositInput] = useState('100000');
  const [loading, setLoading] = useState(false);
  const [states, setStates] = useState<Record<string, Awaited<ReturnType<typeof fetchMerklForecastState>>>>({});
  const [error, setError] = useState<string | null>(null);

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
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchMerklForecastStates()
      .then((result) => {
        if (cancelled) return;
        const next: Record<string, Awaited<ReturnType<typeof fetchMerklForecastState>>> = {};
        result.items.forEach((item) => {
          next[item.campaignId] = item;
        });
        const failed = result.errors.filter((item) => shouldSurfaceForecastError(item)).length;

        setStates((prev) => ({ ...prev, ...next }));
        if (failed > 0) {
          setError(`Failed to load ${failed} campaign forecast state${failed > 1 ? 's' : ''}.`);
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

  const deposit = useMemo(() => {
    const normalized = depositInput.replace(/,/g, '').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
  }, [depositInput]);

  const selectedState = selectedCampaignId ? states[selectedCampaignId] : undefined;
  const forecast = useMemo(() => {
    if (!selectedState) return null;
    const hypotheticalTvl = Math.max(selectedState.latestTvl + deposit, 0);
    return {
      hypotheticalTvl,
      ...forecastWithTVL(selectedState, hypotheticalTvl),
      isCatchingUp: selectedState.distributedSoFar < selectedState.expectedByNow,
    };
  }, [deposit, selectedState]);

  if (campaignOptions.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-border/60 bg-card/80 p-[var(--ds-space-3)] md:p-[var(--ds-space-4)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm md:text-base font-semibold text-foreground">Merkl Capped Forecast</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Estimate next-run daily rewards and APR after adding a hypothetical deposit.
          </p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

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
          Deposit Amount (USD)
          <input
            value={depositInput}
            onChange={(event) => setDepositInput(event.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="e.g. 100000"
          />
        </label>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!selectedState && !loading && (
        <p className="mt-3 text-xs text-muted-foreground">Forecast state is not available for the selected campaign yet.</p>
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
              Regime: {forecast.regime} · Cap binding: {forecast.capBinding ? 'Yes' : 'No'} · Catching up:{' '}
              {forecast.isCatchingUp ? 'Yes' : 'No'}
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export default MerklForecastPanel;
