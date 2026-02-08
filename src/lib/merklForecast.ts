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

export interface MerklForecastProgressState extends MerklForecastState {
  totalBudget: number;
  expectedByNow: number;
  endTimestamp: number;
}

export interface MerklForecastResult {
  dailyRewards: number;
  apr: number;
  capBinding: boolean;
  regime: 'APR_CAPPED' | 'BUDGET_LIMITED';
}

export interface MerklForecastProgressFlags {
  isCatchingUpLive: boolean;
  isUnderDistributed: boolean;
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

export const deriveForecastProgressFlags = (
  forecastState: MerklForecastProgressState,
  nowTs = Math.floor(Date.now() / 1000)
): MerklForecastProgressFlags => {
  const distributedSoFar = safe(forecastState.distributedSoFar);
  const expectedByNow = safe(forecastState.expectedByNow);
  const totalBudget = safe(forecastState.totalBudget);
  const endTimestamp = safe(forecastState.endTimestamp);

  if (endTimestamp > 0 && nowTs >= endTimestamp) {
    return {
      isCatchingUpLive: false,
      isUnderDistributed: distributedSoFar < totalBudget,
    };
  }

  return {
    isCatchingUpLive: distributedSoFar < expectedByNow,
    isUnderDistributed: false,
  };
};
