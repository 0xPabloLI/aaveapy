const DAYS_PER_YEAR = 365;

export interface MerklForecastState {
  desiredDaily: number;
  remainingBudget: number;
  remainingDays: number;
  maxAPR: number;
  computedUntil: number | null;
  asOf: number;
  distributedSoFar: number;
}

export interface MerklForecastResult {
  dailyRewards: number;
  apr: number;
  capBinding: boolean;
  regime: 'APR_CAPPED' | 'BUDGET_LIMITED';
}

const safe = (value: number): number => (Number.isFinite(value) ? Math.max(value, 0) : 0);

export const forecastWithTVL = (
  forecastState: MerklForecastState,
  tvl: number
): MerklForecastResult => {
  const safeTvl = safe(tvl);
  if (safeTvl <= 0) {
    return {
      dailyRewards: 0,
      apr: 0,
      capBinding: true,
      regime: 'APR_CAPPED',
    };
  }

  const desiredDaily = safe(forecastState.desiredDaily);
  const maxAPR = safe(forecastState.maxAPR);
  const capDaily = (safeTvl * maxAPR) / DAYS_PER_YEAR;
  const dailyRewards = Math.min(desiredDaily, capDaily);
  const apr = (dailyRewards * DAYS_PER_YEAR) / safeTvl;
  const capBinding = capDaily < desiredDaily;

  return {
    dailyRewards,
    apr,
    capBinding,
    regime: capBinding ? 'APR_CAPPED' : 'BUDGET_LIMITED',
  };
};
