const DAYS_PER_YEAR = 365;
const SECONDS_PER_DAY = 86400;
const EPSILON = 1e-9;

export interface MerklForecastState {
  campaignType?: string;
  plannedDaily?: number;
  requiredDaily?: number;
  aprCap?: number | null;
  distributedSoFar?: number;
  totalBudget?: number;
  latestTvl?: number;
  endTimestamp?: number;
}

export type MerklForecastProgressState = MerklForecastState;

export interface MerklForecastResult {
  dailyRewards: number;
  apr: number;
  regime: 'APR_CAPPED' | 'CATCHING_UP' | 'PLANNED';
  fixRewardableDays?: number;
  fixRewardableUntilTs?: number;
}

export interface MerklForecastProgressFlags {
  isUnderDistributed: boolean;
}

const safe = (value: number): number => (Number.isFinite(value) ? Math.max(value, 0) : 0);

export const forecastWithTVL = (
  forecastState: MerklForecastState,
  tvl: number,
  nowTs = Math.floor(Date.now() / 1000)
): MerklForecastResult => {
  const safeTvl = safe(tvl);
  const isMaxAprCampaign = forecastState.campaignType === 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE';
  const isFixAprCampaign = forecastState.campaignType === 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE';
  const isRateLimitedCampaign = isMaxAprCampaign || isFixAprCampaign;

  if (safeTvl <= 0) {
    return {
      dailyRewards: 0,
      apr: 0,
      regime: isMaxAprCampaign ? 'APR_CAPPED' : 'PLANNED',
    };
  }

  const plannedDaily = safe(forecastState.plannedDaily ?? 0);
  const requiredDaily = safe(forecastState.requiredDaily ?? plannedDaily);
  const remainingBudget = safe((forecastState.totalBudget ?? 0) - (forecastState.distributedSoFar ?? 0));
  const remainingDays = Math.max((safe(forecastState.endTimestamp) - safe(nowTs)) / SECONDS_PER_DAY, 0);

  const aprCap = safe(forecastState.aprCap ?? 0);
  const aprBasedDaily = isRateLimitedCampaign ? (safeTvl * aprCap) / DAYS_PER_YEAR : Number.POSITIVE_INFINITY;

  if (isFixAprCampaign) {
    const dailyRewards = Math.min(aprBasedDaily, remainingBudget);
    const apr = (dailyRewards * DAYS_PER_YEAR) / safeTvl;
    const rewardableDaysByBudget = aprBasedDaily > EPSILON ? remainingBudget / aprBasedDaily : remainingDays;
    const fixRewardableDays = Math.max(Math.min(remainingDays, rewardableDaysByBudget), 0);
    const fixRewardableUntilTs = Math.floor(
      Math.min(
        safe(forecastState.endTimestamp),
        safe(nowTs) + fixRewardableDays * SECONDS_PER_DAY
      )
    );

    return {
      dailyRewards,
      apr,
      regime: 'PLANNED',
      fixRewardableDays,
      fixRewardableUntilTs,
    };
  }

  const dailyRewards = Math.min(requiredDaily, aprBasedDaily);
  const apr = (dailyRewards * DAYS_PER_YEAR) / safeTvl;
  const capBinding = isMaxAprCampaign && aprBasedDaily < requiredDaily;
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
