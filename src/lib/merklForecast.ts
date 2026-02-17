const DAYS_PER_YEAR = 365;

export interface MerklForecastState {
  campaignType: string;
  plannedDaily?: number;
  requiredDaily?: number;
  aprCap: number | null;
  distributedSoFar: number;
  totalBudget: number;
  latestTvl: number;
  endTimestamp: number;
}

export type MerklForecastProgressState = MerklForecastState;

export interface MerklForecastResult {
  dailyRewards: number;
  apr: number;
  regime: 'APR_CAPPED' | 'CATCHING_UP' | 'PLANNED';
}

export interface MerklForecastProgressFlags {
  isUnderDistributed: boolean;
}

const safe = (value: number): number => (Number.isFinite(value) ? Math.max(value, 0) : 0);

export const forecastWithTVL = (
  forecastState: MerklForecastState,
  tvl: number
): MerklForecastResult => {
  const safeTvl = safe(tvl);
  const isRateLimitedCampaign =
    forecastState.campaignType === 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE' ||
    forecastState.campaignType === 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE';

  if (safeTvl <= 0) {
    return {
      dailyRewards: 0,
      apr: 0,
      regime: isRateLimitedCampaign ? 'APR_CAPPED' : 'PLANNED',
    };
  }

  const plannedDaily = safe(forecastState.plannedDaily ?? 0);
  const requiredDaily = safe(forecastState.requiredDaily ?? plannedDaily);

  const aprCap = safe(forecastState.aprCap ?? 0);
  const capDaily = isRateLimitedCampaign ? (safeTvl * aprCap) / DAYS_PER_YEAR : Number.POSITIVE_INFINITY;
  const dailyRewards = Math.min(requiredDaily, capDaily);
  const apr = (dailyRewards * DAYS_PER_YEAR) / safeTvl;
  const capBinding = isRateLimitedCampaign && capDaily < requiredDaily;
  const isCatchingUp = requiredDaily > plannedDaily * 1.01; // 1% tolerance for floating point

  let regime: 'APR_CAPPED' | 'CATCHING_UP' | 'PLANNED';
  if (capBinding) {
    regime = 'APR_CAPPED';
  } else if (isCatchingUp) {
    regime = 'CATCHING_UP';
  } else {
    regime = 'PLANNED';
  }

  return {
    dailyRewards,
    apr,
    regime,
  };
};

export const deriveForecastProgressFlags = (
  forecastState: MerklForecastProgressState,
  nowTs = Math.floor(Date.now() / 1000)
): MerklForecastProgressFlags => {
  const distributedSoFar = safe(forecastState.distributedSoFar);
  const totalBudget = safe(forecastState.totalBudget);
  const endTimestamp = safe(forecastState.endTimestamp);

  if (endTimestamp > 0 && nowTs >= endTimestamp) {
    return {
      isUnderDistributed: distributedSoFar < totalBudget,
    };
  }

  return {
    isUnderDistributed: false,
  };
};
