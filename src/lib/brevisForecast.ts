import type { BrevisIncentive } from '@/types/aave';
import { getBrevisCampaignApr, getBrevisCampaignEndedAt, getBrevisPerUserRewardCapUsd } from '@/lib/brevis';
import { computePositionCapEligibility } from '@/lib/incentiveMath';

const DAYS_PER_YEAR = 365;
const MS_PER_DAY = 86_400_000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface BrevisForecastResult {
  aprPercent: number;
  isCapBinding: boolean;
  /** Eligible portion of the position under the cap (null when cap is absent). */
  eligibleUsd: number | null;
  /** Informational: at the nominal APR, how many days to earn rewards equal to the cap amount (null when not computable). */
  daysToHitCap: number | null;
  /** Calendar days from now until campaign endDate (null when endDate is absent/unparseable). */
  remainingDays: number | null;
}

const sanitizePercent = (value: number): number =>
  Number.isFinite(value) && value >= 0 ? value : 0;

const parseBoundaryMs = (value: string | undefined, boundary: 'start' | 'end'): number | null => {
  if (!value) return null;
  if (DATE_ONLY_PATTERN.test(value)) {
    const normalized = boundary === 'start' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`;
    const ts = Date.parse(normalized);
    return Number.isNaN(ts) ? null : ts;
  }
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
};

/**
 * Compute the effective Brevis APR after applying the per-user position cap.
 *
 * When a valid `perUserRewardCapUsd` is available the returned APR is
 * `nominalApr × min(position, capUsd) / position` — the nominal APR is
 * diluted by the eligible fraction of the position, exactly like Merit Self.
 * The position cap does NOT depend on `endDate`; only the cap amount and the
 * user's position matter.
 *
 * @param combinedDepositUsd — When supply and borrow rows on the same reserve
 *   represent one shared Brevis campaign (same `campaignId`), pass the **total**
 *   deposit across both sides. The cap eligibility is then evaluated against the
 *   canonical shared campaign instead of one side in isolation.
 *   When absent, defaults to `depositUsd` (single-campaign behaviour).
 */
export function forecastBrevisAprPercent(
  brevis: BrevisIncentive,
  depositUsd: number,
  _nowMs = Date.now(),
  combinedDepositUsd?: number,
): number {
  const nominalApr = sanitizePercent(getBrevisCampaignApr(brevis));
  if (nominalApr <= 0) return 0;
  if (!Number.isFinite(depositUsd) || depositUsd <= 0) return nominalApr;

  const capUsd = getBrevisPerUserRewardCapUsd(brevis);
  if (capUsd === undefined || !Number.isFinite(capUsd) || capUsd <= 0) return nominalApr;

  const totalDeposit = (combinedDepositUsd !== undefined && Number.isFinite(combinedDepositUsd) && combinedDepositUsd > 0)
    ? combinedDepositUsd
    : depositUsd;

  const { eligibleUsd, isCapBinding } = computePositionCapEligibility(totalDeposit, capUsd!);
  return nominalApr * (eligibleUsd / totalDeposit);
}

/**
 * Extended forecast with diagnostic fields for tooltip display.
 *
 * `isCapBinding` is true when the total position exceeds the cap (position dilution applies).
 * `daysToHitCap` is informational: at the nominal APR, the number of days to earn rewards
 * equal to the cap amount. It does not imply the user will be "capped out" — position caps
 * are static eligibility thresholds, not cumulative reward limits.
 * `remainingDays` is derived from endDate and exposed for UI display (null when
 * endDate is absent — Brevis campaigns may not have an explicit end).
 */
export function forecastBrevisDetailed(
  brevis: BrevisIncentive,
  depositUsd: number,
  nowMs = Date.now(),
  combinedDepositUsd?: number,
): BrevisForecastResult {
  const nominalApr = sanitizePercent(getBrevisCampaignApr(brevis));
  const effectiveApr = forecastBrevisAprPercent(brevis, depositUsd, nowMs, combinedDepositUsd);

  const endMs = parseBoundaryMs(getBrevisCampaignEndedAt(brevis), 'end');
  const remainingDays = endMs !== null && endMs > nowMs
    ? (endMs - nowMs) / MS_PER_DAY
    : null;

  const capUsd = getBrevisPerUserRewardCapUsd(brevis);
  const hasValidCap = capUsd !== undefined && Number.isFinite(capUsd) && capUsd > 0;

  if (!hasValidCap || nominalApr <= 0 || !Number.isFinite(depositUsd) || depositUsd <= 0) {
    return {
      aprPercent: effectiveApr,
      isCapBinding: false,
      eligibleUsd: hasValidCap ? capUsd! : null,
      daysToHitCap: null,
      remainingDays,
    };
  }

  const totalDeposit = (combinedDepositUsd !== undefined && Number.isFinite(combinedDepositUsd) && combinedDepositUsd > 0)
    ? combinedDepositUsd
    : depositUsd;

  const { eligibleUsd, isCapBinding } = computePositionCapEligibility(totalDeposit, capUsd!);
  const dailyRewardUsd = totalDeposit * (nominalApr / 100) / DAYS_PER_YEAR;
  const daysToHitCap = dailyRewardUsd > 0 ? capUsd! / dailyRewardUsd : null;

  return {
    aprPercent: effectiveApr,
    isCapBinding,
    eligibleUsd,
    daysToHitCap,
    remainingDays,
  };
}
