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

export interface PositionCapResult {
  aprPercent: number;
  isCapBinding: boolean;
  eligibleUsd: number;
}

export function applyPositionCap(
  nominalAprPercent: number,
  positionUsd: number,
  capUsd: number,
): PositionCapResult {
  const { eligibleUsd, isCapBinding } = computePositionCapEligibility(positionUsd, capUsd);
  const aprPercent = isCapBinding ? nominalAprPercent * (eligibleUsd / positionUsd) : nominalAprPercent;
  return { aprPercent, isCapBinding, eligibleUsd };
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
