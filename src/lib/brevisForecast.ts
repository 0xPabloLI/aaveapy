import type { BrevisIncentive } from '@/types/aave';
import { getBrevisCampaignApr, getBrevisCampaignEndedAt } from '@/lib/brevis';

const DAYS_PER_YEAR = 365;
const MS_PER_DAY = 86_400_000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface BrevisForecastResult {
  aprPercent: number;
  isCapBinding: boolean;
  /** Remaining reward the user can earn under the cap (null when cap is absent). */
  rewardHeadroomUsd: number | null;
  /** At the nominal APR, how many days until the per-user cap is reached (null when not computable). */
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
 * Compute the effective Brevis APR after applying the per-user cumulative reward cap.
 *
 * When a valid `perUserRewardCapUsd` and future `endDate` are both available the
 * returned APR is `min(nominalApr, capUsd / depositUsd / remainingYearFraction × 100)`.
 * Otherwise the nominal APR is returned unchanged (graceful degradation).
 *
 * @param combinedDepositUsd — When supply and borrow rows on the same reserve
 *   represent one shared Brevis campaign (same `campaignId`), pass the **total**
 *   deposit across both sides. The cap headroom is then evaluated against the
 *   canonical shared campaign instead of one side in isolation.
 *   When absent, defaults to `depositUsd` (single-campaign behaviour).
 */
export function forecastBrevisAprPercent(
  brevis: BrevisIncentive,
  depositUsd: number,
  nowMs = Date.now(),
  combinedDepositUsd?: number,
): number {
  const nominalApr = sanitizePercent(getBrevisCampaignApr(brevis));
  if (nominalApr <= 0) return 0;
  if (!Number.isFinite(depositUsd) || depositUsd <= 0) return nominalApr;

  const capUsd = brevis.perUserRewardCapUsd;
  if (capUsd === undefined || !Number.isFinite(capUsd) || capUsd <= 0) return nominalApr;

  const endMs = parseBoundaryMs(getBrevisCampaignEndedAt(brevis), 'end');
  if (endMs === null || endMs <= nowMs) return nominalApr;

  const remainingDays = (endMs - nowMs) / MS_PER_DAY;
  if (remainingDays <= 0) return nominalApr;

  const totalDeposit = (combinedDepositUsd !== undefined && Number.isFinite(combinedDepositUsd) && combinedDepositUsd > 0)
    ? combinedDepositUsd
    : depositUsd;

  const remainingYearFraction = remainingDays / DAYS_PER_YEAR;
  const capImpliedAprPercent = (capUsd / totalDeposit / remainingYearFraction) * 100;
  return Math.min(nominalApr, capImpliedAprPercent);
}

/**
 * Extended forecast with diagnostic fields for tooltip display.
 *
 * `daysToHitCap` is always computable when the cap and deposit are valid
 * (it does not require endDate). `isCapBinding` requires endDate to determine
 * whether the cap actually constrains the effective APR over the remaining period.
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

  const capUsd = brevis.perUserRewardCapUsd;
  const hasValidCap = capUsd !== undefined && Number.isFinite(capUsd) && capUsd > 0;

  if (!hasValidCap || nominalApr <= 0 || !Number.isFinite(depositUsd) || depositUsd <= 0) {
    return {
      aprPercent: effectiveApr,
      isCapBinding: false,
      rewardHeadroomUsd: hasValidCap ? capUsd! : null,
      daysToHitCap: null,
      remainingDays,
    };
  }

  const totalDeposit = (combinedDepositUsd !== undefined && Number.isFinite(combinedDepositUsd) && combinedDepositUsd > 0)
    ? combinedDepositUsd
    : depositUsd;

  const dailyRewardUsd = totalDeposit * (nominalApr / 100) / DAYS_PER_YEAR;
  const daysToHitCap = dailyRewardUsd > 0 ? capUsd! / dailyRewardUsd : null;

  return {
    aprPercent: effectiveApr,
    isCapBinding: effectiveApr < nominalApr,
    rewardHeadroomUsd: capUsd!,
    daysToHitCap,
    remainingDays,
  };
}
