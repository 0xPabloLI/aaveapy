export interface PositionCapEligibility {
  eligibleUsd: number;
  isCapBinding: boolean;
}

export function computePositionCapEligibility(
  positionUsd: number,
  capUsd: number,
): PositionCapEligibility {
  const eligibleUsd = Math.min(positionUsd, capUsd);
  return {
    eligibleUsd,
    isCapBinding: positionUsd > capUsd,
  };
}

export function computeBudgetRemainingDays(
  remainingBudget: number,
  dailyReward: number,
  calendarDays: number,
): number {
  if (!Number.isFinite(remainingBudget) || remainingBudget <= 0) return calendarDays;
  if (!Number.isFinite(dailyReward) || dailyReward <= 0) return calendarDays;
  const budgetDays = remainingBudget / dailyReward;
  return Math.max(Math.min(calendarDays, budgetDays), 0);
}
