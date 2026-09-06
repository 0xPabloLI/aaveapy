import {
  annualPercentToDailyFraction,
  calculateTotalBorrowApy,
  calculateTotalBorrowApr,
  calculateTotalSupplyApy,
  calculateTotalSupplyApr,
  convertAprToApy,
  scaleAprThenConvert,
} from '@/lib/rateCalculations';
import { calculateTotalIncentiveApy, calculateTotalIncentiveApr, getIncentiveSources, resolveBrevisCurrentApr, sumMerklIncentiveApr, sumMerklIncentiveApy } from '@/lib/incentiveAggregation';
import { isMerklWhitelistBreakdownIncluded } from '@/lib/merklWhitelist';
import { simulateNativeRatesAfterActions } from '@/lib/interestRateCalculator';
import type { RateCalcInput } from '@/lib/interestRateCalculator';
import {
  forecastMerklApr,
  getMerklBreakdownApr,
  mergeForecastState,
  sanitizePercent,
  forecastWithTVL,
} from '@/lib/merklForecast';
import { getProtocolVersion, type ProtocolVersion } from '@/lib/protocolVersion';
import {
  forecastMeritAprPercent,
  forecastMeritApr,
} from '@/lib/meritForecast';
import {
  buildFixRewardCapEffect,
  buildMaxRewardCapEffect,
  buildNetEligibleNote,
  buildCrossReserveNetEligibleNote,
  buildCrossAssetPairingNote,
  capEffectToNote,
  netEligibleToNote,
  applyPositionCapToForecastResult,
  checkForecastAvailability,
  resolvePositionCapUsd,
} from '@/lib/incentiveCaps';
import { DEFAULT_TOKEN_DECIMALS } from '@/lib/tokenDefaults';
import { applyPositionCap } from '@/lib/incentiveMath';
import {
  getBrevisCampaignBreakdowns,
  getBrevisCampaignId,
  getBrevisResolvedBreakdown,
} from '@/lib/brevis';
import { getReserveKey } from '@/lib/reserveKey';
import { isSupplyDisabled, isBorrowDisabled } from '@/lib/reserveStatus';
import {
  applyStableCampaignLabels,
  flattenCampaignBreakdowns,
  isCampaignActive,
  parseCampaignBoundaryMs,
  sumActiveCampaignBreakdownValues,
} from '@/lib/campaignGroups';
import { parseSignedNumberInput } from '@/lib/numberFormat';
import { resolveForecastTokenPrice } from '@/lib/tokenPriceResolver';
import type {
  BrevisIncentive,
  IncentiveMessage,
  MeritCampaignGroup,
  MerklCampaignBreakdown,
  MerklForecastWireItem,
  MerklOpportunityGroup,
  ReserveWithSpread,
  TokenPricesIndex,
} from '@/types/aave';
import { nativeToUsd } from '@/lib/scenarioSize';
import {
  computeCrossReserveEligibilityRatio,
  computeCrossReserveNetEligible,
  computeCrossAssetEligibilityRatio,
  computeCrossAssetNetEligible,
  type ReservePositions,
} from '@/lib/netLendingCrossReserve';
import { getPointToUsdRate, type PointRateMap } from '@/lib/tydro';
import type { IncentiveNote } from '@/lib/incentiveCaps';
import type { IncentiveSources } from '@/lib/incentiveAggregation';


export type BrevisCampaignRow = {
  source: BrevisIncentive;
  breakdown: NonNullable<BrevisIncentive['breakdowns']>[number];
};

export const flattenBrevisCampaignRows = (values?: BrevisIncentive[]): BrevisCampaignRow[] => {
  return flattenCampaignBreakdowns(
    values?.map((source) => ({
      ...source,
      breakdowns: getBrevisCampaignBreakdowns(source),
    }))
  ).map(({ group, breakdown }) => ({
    source: group as BrevisIncentive,
    breakdown: breakdown as BrevisCampaignRow['breakdown'],
  }));
};

export interface BuildForecastMerklOpportunitiesInput {
  opportunities?: MerklOpportunityGroup[];
  inputUsd: number;
  forecastStates: Record<string, MerklForecastWireItem>;
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined;
  tydroPointToUsdRate: number;
  /** Per-symbol point rate map for per-campaign rate routing (AAV-898). */
  pointRateMap?: PointRateMap;
}

export function buildForecastMerklOpportunities({
  opportunities,
  inputUsd,
  forecastStates,
  whitelistMerklCampaignIds,
  tydroPointToUsdRate,
  pointRateMap,
}: BuildForecastMerklOpportunitiesInput): MerklOpportunityGroup[] {
  if (!opportunities || opportunities.length === 0) return [];

  return opportunities.map((opportunity) => ({
    ...opportunity,
    breakdowns: (opportunity.breakdowns ?? []).map((breakdown) => {
      const effectiveRate = pointRateMap
        ? getPointToUsdRate(breakdown.rewardTokenSymbol, pointRateMap)
        : tydroPointToUsdRate;
      return {
        ...breakdown,
        campaignApr: forecastMerklApr(breakdown, inputUsd, forecastStates, effectiveRate),
        pointsPerThousandUsd: undefined,
      };
    }),
  }));
}

export const FORECAST_REQUIRING_CAMPAIGN_TYPES = new Set([
  'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
  'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE',
  'TARGET_TOTAL_APR',
]);

export type RateSide = 'supply' | 'borrow';

export interface SimulationMetric {
  current: number | null;
  after: number | null;
  delta: number | null;
}

/** Per-campaign incentive row for the simulation breakdown (Merit/Merkl/Brevis sub-campaigns). */
export interface SimulationCampaignDetail {
  id: string;
  label: string;
  current: number | null;
  after: number | null;
  delta: number | null;
  capMetrics?: import('./incentiveCaps').SimulationCapMetrics;
  notes?: import('./incentiveCaps').IncentiveNote[];
  href?: string | null;
  forecastUnavailable?: boolean;
}

const countForecastUnavailable = (rows: SimulationCampaignDetail[]): number =>
  rows.filter((r) => r.forecastUnavailable).length;

export interface SimulationSourceDetail extends SimulationMetric {
  campaigns?: SimulationCampaignDetail[];
  /** Cap notes (position_cap, pool_budget, apr_cap). */
  notes?: import('./incentiveCaps').IncentiveNote[];
  /** Offset notes (net_eligible) — separated from cap notes (AAV-1036). */
  offsetNotes?: import('./incentiveCaps').IncentiveNote[];
}

export interface SimulationLane {
  hasInput: boolean;
  inputAmount: number;
  inputUsd: number;
  currentNative: number | null;
  currentIncentive: number;
  currentTotal: number | null;
  // AAV-1165: Pure market advertised rate (no forecast/wallet/cap/offset). Reference value.
  headlineIncentive: number;
  afterNative: number | null;
  afterIncentive: number | null;
  afterTotal: number | null;
  deltaNative: number | null;
  deltaIncentive: number | null;
  deltaTotal: number | null;
  sources: {
    protocol: SimulationSourceDetail;
    merit: SimulationSourceDetail;
    merkl: SimulationSourceDetail;
    brevis: SimulationSourceDetail;
  };
}

/** Estimated USD cashflow per day from simulated **after** rates C scenario principal. */
export interface ScenarioUsdAccrualSide {
  /** Supply: positive earnings. Borrow native: negative (interest paid). */
  nativeUsdPerDay: number | null;
  /** Supply: positive. Borrow: positive (rebate reduces borrow cost). */
  incentiveUsdPerDay: number | null;
  /** Net of native + incentive for this side (borrow total uses combined after rate, see build). */
  totalUsdPerDay: number | null;
}

export interface ScenarioUsdAccrual {
  supply: ScenarioUsdAccrualSide | null;
  borrow: ScenarioUsdAccrualSide | null;
  /** Sum of supply and borrow totals (supply positive, borrow negative when paying interest). */
  netUsdPerDay: number | null;
}

export interface MarketMetrics {
  availableLiquidityUsd: number | null;
  availableLiquidityUsdAfter: number | null;
  availableLiquidityUsdDelta: number | null;
  totalBorrowedUsd: number | null;
  totalBorrowedUsdAfter: number | null;
  totalBorrowedUsdDelta: number | null;
  supplyCapUsd: number | null;
  borrowCapUsd: number | null;
  protocolFee: number | null; // percent (e.g., 10 = 10%)
  optimalUtilization: number | null;
  availableSupplyRoomUsd: number | null;
  supplyCapExceeded: boolean;
  supplyCapExceededByUsd: number | null;
  availableBorrowRoomUsd: number | null;
  borrowCapExceeded: boolean;
  borrowCapExceededByUsd: number | null;
  borrowLimitedByLiquidity: boolean;
}

export interface RateSimulationComputedResult {
  tokenPrice?: number;
  supply: SimulationLane;
  borrow: SimulationLane;
  spread: {
    current: number | null;
    after: number | null;
    delta: number | null;
    usesCurrentSide: null;
  };
  utilization: {
    current: number | null;
    after: number | null;
    delta: number | null;
    optimal: number | null;
  };
  marketMetrics: MarketMetrics;
  forecastUnavailableCampaignCount: number;
  /** Present when at least one side has scenario principal; uses after-simulation rates. */
  scenarioUsdAccrual: ScenarioUsdAccrual | null;
}

export interface RateSimulationResult extends RateSimulationComputedResult {
  tokenPriceLoading: boolean;
  forecastLoading: boolean;
  forecastErrors: Record<string, string>;
}

export type ScenarioInputMode = 'usd' | 'token';

export interface BuildRateSimulationResultParams {
  reserve: ReserveWithSpread;
  reserveRateInput?: RateCalcInput | null;
  isApy: boolean;
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined;
  tydroPointToUsdRate: number;
  tokenPrice?: number;
  supplyInput: string;
  borrowInput: string;
  inputMode?: ScenarioInputMode;
  forecastStates: Record<string, MerklForecastWireItem>;
  /**
   * When true (default), Merit/Merkl hypothetical TVL uses net position per side
   * (supply net = max(supplyb.borrow,0), borrow net = max(borrowb.supply,0)) with eligibility scaling.
   * When false, each side uses its full scenario USD independently. Brevis is always gross per side.
   */
  meritMerklNetPosition?: boolean;
  /** Cross-reserve positions (total = wallet + delta) for merkl per-group net eligibility ratio computation (after*). */
  crossReservePositions?: Map<string, ReservePositions>;
  /** Cross-reserve wallet-only positions for current* and headline (AAV-1137). Must be undefined when no wallet. */
  walletCrossReservePositions?: Map<string, ReservePositions>;
  /** reserveId b symbol lookup for cross-reserve note (offset reserve symbols). */
  reserveSymbolById?: Map<string, string>;
  campaignAccessStatuses?: Record<string, 'allowed' | 'whitelist-blocked' | 'blacklisted'>;
  hubSupplied?: string;
  hubBorrowed?: string;
  /**
   * Total supply position in USD (wallet + delta) for accrual & cap dilution.
   * Used as the principal in buildSupplyUsdAccrualSide and for Merit position cap
   * dilution (eligibleDepositUsd = min(effectiveTotalPosition, cap)).
   *
   * This decouples "what moves the rate curve" (supplyInput = delta) from
   * "what earns interest / what determines cap eligibility" (totalSupplyUsd).
   *
   * Callers MUST resolve the appropriate value before calling:
   * - Portfolio mode: totalSupplyUsd = wallet + delta (from PerReserveInput)
   * - Single simulation: totalSupplyUsd = supplyInputUsd (input IS total)
   * - No input: undefined (no position to dilute)
   */
  totalSupplyUsd?: number;
  /**
   * Total borrow position in USD (wallet + delta) for accrual & cap dilution.
   * Same semantics as totalSupplyUsd but for the borrow side.
   */
  totalBorrowUsd?: number;
  /**
   * Wallet-only supply position (USD) for position cap dilution in current incentive.
   * Passed explicitly by the caller from PerReserveInput.
   * undefined when no wallet position exists (triggers identity fallback — Golden Rule §3).
   */
  walletSupplyUsd?: number;
  /**
   * Wallet-only borrow position (USD) for position cap dilution in current incentive.
   * Passed explicitly by the caller from PerReserveInput.
   * undefined when no wallet position exists (triggers identity fallback — Golden Rule §3).
   */
  walletBorrowUsd?: number;
  /** Per-symbol point rate map for per-campaign rate routing (AAV-898). */
  pointRateMap?: PointRateMap;
  /** AAV-1166: When true, after* values are computed for portfolio members even without local input. */
  portfolioScenarioActive?: boolean;
}

export const buildIncentiveCurrent = (
  reserve: ReserveWithSpread,
  side: RateSide,
  isApy: boolean,
  tydroPointToUsdRate: number,
  whitelistMerklCampaignIds: ReadonlySet<string> | undefined,
  forecastStates: Record<string, MerklForecastWireItem> | undefined,
  campaignAccessStatuses?: Record<string, 'allowed' | 'whitelist-blocked' | 'blacklisted'>,
  /**
   * Wallet-only position (USD) for position cap dilution.
   * When set, Merit position cap campaigns are diluted based on wallet position,
   * matching the semantics of the dispatch map sumAfter (which uses wallet + delta).
   * When unset, raw selfApr from the API is used (no dilution).
   */
  walletSupplyUsd?: number,
  walletBorrowUsd?: number,
  hubSupplied?: string,
  hubBorrowed?: string,
  /** Per-symbol point rate map for per-campaign rate routing (AAV-898). */
  pointRateMap?: PointRateMap,
  /** AAV-1060: Merkl eligibility multiplier (net position constraint). Must match dispatch map sumAfter. */
  merklGroupMultiplier?: (group: MerklOpportunityGroup) => number,
  /** AAV-1102: Wallet-only eligibility ratio for Merit scaling. When set, Merit APR is multiplied by this ratio. */
  walletEligibilityRatio = 1,
): number => {
  const { protocol, merit, merkl, brevis } = getIncentiveSources(reserve, side);

  const walletPositionUsd = side === 'supply' ? walletSupplyUsd : walletBorrowUsd;

  // Always use sumForecastMeritIncentiveApr for Merit — consistent calculation path.
  // When walletPositionUsd is set, applies TVL-based forecast with position cap dilution.
  // When unset, uses static headline rates (no forecast, no dilution).
  const anchorTvlUsd = getMeritAnchorTvlUsd(reserve, side, getProtocolVersion(reserve.marketName), hubSupplied, hubBorrowed);

  // AAV-1107: Decompose aggregate current into per-source calls to match dispatch map sumCurrent.
  // Previously used calculateTotalIncentiveApy/Apr which didn't pass positionUsd/tokenPrice/decimals
  // for Merkl position cap dilution, causing aggregate current ≠ per-source sum.
  const merklOptions = { whitelistMerklCampaignIds, forecastStates, campaignAccessStatuses, merklGroupMultiplier, pointRateMap, positionUsd: walletPositionUsd, tokenPrice: reserve.tokenPrice, decimals: reserve.decimals };

  if (walletPositionUsd != null && walletPositionUsd > 0 && merit && merit.length > 0) {
    // Wallet-based: apply position cap dilution using totalPositionUsd, but
    // inputUsd=0 because wallet is an existing position — not a new deposit
    // that would dilute TVL.
    // AAV-1102: Apply walletEligibilityRatio to Merit to match dispatch map sumCurrent.
    const meritPercent = sumForecastMeritIncentiveApr(merit, isApy, 0, anchorTvlUsd, walletPositionUsd) * walletEligibilityRatio;
    const merklPercent = isApy
      ? sumMerklIncentiveApy(merkl, tydroPointToUsdRate, merklOptions)
      : sumMerklIncentiveApr(merkl, tydroPointToUsdRate, merklOptions);
    const brevisPercent = sumForecastBrevisIncentiveApr(brevis, isApy, 0, undefined, forecastStates, walletPositionUsd);
    const protocolPercent = sumNumberArray(protocol, isApy);
    return meritPercent + merklPercent + brevisPercent + protocolPercent;
  }

  // Headline: static rates, no dilution
  // AAV-1102: Apply walletEligibilityRatio to Merit in headline path too.
  const meritApr = merit?.length ? sumForecastMeritIncentiveApr(merit, isApy, 0, anchorTvlUsd, undefined) * walletEligibilityRatio : 0;
  const merklApr = isApy
    ? sumMerklIncentiveApy(merkl, tydroPointToUsdRate, merklOptions)
    : sumMerklIncentiveApr(merkl, tydroPointToUsdRate, merklOptions);
  const brevisApr = sumForecastBrevisIncentiveApr(brevis, isApy, 0, undefined, forecastStates, walletPositionUsd);
  const protocolApr = sumNumberArray(protocol, isApy);
  return meritApr + merklApr + brevisApr + protocolApr;
};

export const sumNumberArray = (values?: number[], isApy = false): number => {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, value) => {
    if (!Number.isFinite(value) || value < 0) return sum;
    return sum + (isApy ? convertAprToApy(value) : value);
  }, 0);
};




/**
 * Supply: supplied (native b USD). Borrow: borrowed USD b supplied C utilization (Merit TVL proxy when no campaign TVL exists).
 * V4: supplied may be 0 or a per-Spoke slice b use on-chain borrowed for borrow side,
 *     and return undefined for supply side when supplied-derived USD is 0/unreliable.
 */
export const getMeritAnchorTvlUsd = (
  reserve: ReserveWithSpread,
  side: RateSide,
  protocolVersion: ProtocolVersion,
  hubSupplied?: string,
  hubBorrowed?: string,
): number | undefined => {
  if (protocolVersion === 'v4') {
    if (side === 'supply') {
      const size = nativeToUsd(hubSupplied ?? reserve.supplied, reserve.decimals, reserve.tokenPrice);
      if (size != null && Number.isFinite(size) && size > 0) return size;
      return undefined;
    }
    const borrowedToUse = hubBorrowed ?? reserve.borrowed;
    const { decimals, tokenPrice } = reserve;
    if (borrowedToUse && decimals != null && tokenPrice != null && tokenPrice > 0) {
      const raw = Number(borrowedToUse);
      if (Number.isFinite(raw) && raw >= 0) {
        const tokens = raw / Math.pow(10, decimals);
        const usd = tokens * tokenPrice;
        if (usd > 0) return usd;
      }
    }
    return undefined;
  }
  const size = nativeToUsd(reserve.supplied, reserve.decimals, reserve.tokenPrice);
  if (size == null || !Number.isFinite(size) || size <= 0) return undefined;
  if (side === 'supply') return size;
  const u = reserve.utilizationPct;
  if (typeof u === 'number' && Number.isFinite(u) && u > 0 && u <= 100) {
    return size * (u / 100);
  }
  return undefined;
};

export const sumForecastMeritIncentiveApr = (
  values: MeritCampaignGroup[] | undefined,
  isApy: boolean,
  inputUsd: number,
  anchorTvlUsd?: number,
  totalPositionUsd?: number,
): number => {
  if (!values || values.length === 0) return 0;
  const aprPercent = forecastMeritAprPercent(values, inputUsd, anchorTvlUsd, totalPositionUsd);
  if (aprPercent <= 0) return 0;
  return isApy ? convertAprToApy(aprPercent) : aprPercent;
};

export const areBrevisSharedSnapshotsEqual = (
  left: ReturnType<typeof getBrevisResolvedBreakdown>,
  right: ReturnType<typeof getBrevisResolvedBreakdown>,
): boolean => (
  left.campaignApr === right.campaignApr &&
  left.campaignStartedAt === right.campaignStartedAt &&
  left.campaignEndedAt === right.campaignEndedAt &&
  left.latestTvl === right.latestTvl &&
  left.totalBudget === right.totalBudget &&
  left.positionCapUsd === right.positionCapUsd &&
  left.message === right.message &&
  left.link === right.link
);

/**
 * Canonical shared-cap rule for Brevis:
 * only campaigns on the same reserve that appear on both supply and borrow with
 * the same `campaignId` share a single per-user reward cap, and the campaign
 * metadata must match exactly across both sides.
 */
export const computeBrevisSharedCampaignDeposits = (
  reserve: ReserveWithSpread,
  supplyInputUsd: number,
  borrowInputUsd: number,
): ReadonlyMap<string, number> => {
  const supplyRows = flattenBrevisCampaignRows(reserve.brevisSupplys);
  const borrowRows = flattenBrevisCampaignRows(reserve.brevisBorrows);

  const supplyByCampaignId = new Map<string, Array<{ source: BrevisIncentive; breakdown: NonNullable<BrevisIncentive['breakdowns']>[number] }>>();
  const borrowByCampaignId = new Map<string, Array<{ source: BrevisIncentive; breakdown: NonNullable<BrevisIncentive['breakdowns']>[number] }>>();
  supplyRows.forEach((item) => {
    const campaignId = item.breakdown.campaignId ?? getBrevisCampaignId(item.source);
    if (!campaignId) return;
    const resolved = getBrevisResolvedBreakdown(item.source, item.breakdown);
    if (!isCampaignActive(resolved.campaignStartedAt, resolved.campaignEndedAt, Date.now(), true)) return;
    const existing = supplyByCampaignId.get(campaignId);
    if (existing) existing.push(item);
    else supplyByCampaignId.set(campaignId, [item]);
  });
  borrowRows.forEach((item) => {
    const campaignId = item.breakdown.campaignId ?? getBrevisCampaignId(item.source);
    if (!campaignId) return;
    const resolved = getBrevisResolvedBreakdown(item.source, item.breakdown);
    if (!isCampaignActive(resolved.campaignStartedAt, resolved.campaignEndedAt, Date.now(), true)) return;
    const existing = borrowByCampaignId.get(campaignId);
    if (existing) existing.push(item);
    else borrowByCampaignId.set(campaignId, [item]);
  });

  const combinedDepositUsd = supplyInputUsd + borrowInputUsd;
  const sharedDeposits = new Map<string, number>();

  supplyByCampaignId.forEach((supplyItems, campaignId) => {
    const borrowItems = borrowByCampaignId.get(campaignId);
    if (!borrowItems?.length) return;

    const entries = [...supplyItems, ...borrowItems];
    const canonical = getBrevisResolvedBreakdown(entries[0].source, entries[0].breakdown);
    const mismatch = entries.slice(1).some((entry) => (
      !areBrevisSharedSnapshotsEqual(canonical, getBrevisResolvedBreakdown(entry.source, entry.breakdown))
    ));

    if (mismatch) {
      console.warn(
        `[Brevis] Skipping shared-cap simulation for ${reserve.marketName} ${reserve.tokenSymbol} campaignId=${campaignId} because supply/borrow metadata differ.`,
      );
      return;
    }

    sharedDeposits.set(campaignId, combinedDepositUsd);
  });

  return sharedDeposits;
};

export const getBrevisCombinedDepositUsd = (
  brevis: BrevisIncentive,
  breakdown: NonNullable<BrevisIncentive['breakdowns']>[number] | undefined,
  sharedDepositsByCampaignId: ReadonlyMap<string, number> | undefined,
): number | undefined => {
  const campaignId = breakdown?.campaignId ?? getBrevisCampaignId(brevis);
  if (!campaignId || !sharedDepositsByCampaignId) return undefined;
  return sharedDepositsByCampaignId.get(campaignId);
};

export const sumForecastBrevisIncentiveApr = (
  values: BrevisIncentive[] | undefined,
  isApy: boolean,
  inputUsd: number,
  sharedDepositsByCampaignId: ReadonlyMap<string, number> | undefined,
  forecastStates: Record<string, MerklForecastWireItem> | undefined,
  totalPositionUsd?: number,
): number => {
  return sumActiveCampaignBreakdownValues(values, {
    allowOpenEnd: true,
    getBreakdowns: (group) => getBrevisCampaignBreakdowns(group),
    getStartDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignStartedAt,
    getEndDate: (group, breakdown) => getBrevisResolvedBreakdown(group, breakdown).campaignEndedAt,
    mapValue: (group, breakdown) => {
      const resolved = getBrevisResolvedBreakdown(group, breakdown);
      const combined = getBrevisCombinedDepositUsd(group, breakdown, sharedDepositsByCampaignId);
      const positionUsd = combined ?? totalPositionUsd ?? inputUsd;
      let aprPercent = forecastStates
        ? sanitizePercent(forecastMerklApr(resolved, inputUsd, forecastStates, 0))
        : sanitizePercent(resolved.campaignApr);

      const capResult = applyPositionCapToForecastResult(aprPercent, positionUsd, resolved.positionCapUsd);
      aprPercent = capResult.aprPercent;
      if (aprPercent <= 0) return 0;
      return isApy ? convertAprToApy(aprPercent) : aprPercent;
    },
  });
};

export const buildMetric = (current: number | null, after: number | null): SimulationMetric => ({
  current,
  after,
  delta: current !== null && after !== null ? after - current : null,
});

export const meritAprToDisplay = (aprPercent: number, isApy: boolean): number => {
  const s = sanitizePercent(aprPercent);
  return isApy ? convertAprToApy(s) : s;
};

export const meritForecastAprToDisplay = (aprDecimal: number, isApy: boolean): number => {
  const pct = aprDecimal * 100;
  return isApy ? convertAprToApy(pct) : pct;
};

/** Show per-campaign rows whenever campaign details exist (even without scenario input). */
export const shouldExposeCampaignRows = (rows: SimulationCampaignDetail[]): boolean => rows.length > 0;

export type LabeledCampaignRow = Omit<SimulationCampaignDetail, 'label'> & { baseLabel: string };

export const finalizeCampaignDetailRows = (
  collected: LabeledCampaignRow[],
): SimulationCampaignDetail[] => {
  if (collected.length === 0) return [];
  const rows = applyStableCampaignLabels(
    collected.map(({ baseLabel, ...rest }) => ({
      ...rest,
      label: baseLabel,
    }))
  );
  return shouldExposeCampaignRows(rows) ? rows : [];
};

export const extractActionLabelFromMeritMessage = (message: IncentiveMessage): string | null => {
  if (!message) return null;
  if (Array.isArray(message)) {
    for (const item of message) {
      const label = extractActionLabelFromMeritMessage(item as IncentiveMessage);
      if (label) return label;
    }
    return null;
  }
  if (typeof message === 'object') {
    const actionValue = (message as Record<string, unknown>).action;
    if (typeof actionValue === 'string' && actionValue.trim()) return actionValue.trim();
    for (const value of Object.values(message)) {
      const label = extractActionLabelFromMeritMessage(value as IncentiveMessage);
      if (label) return label;
    }
    return null;
  }
  return null;
};

export interface MeritCampaignDetailsOptions {
  merits: MeritCampaignGroup[] | undefined;
  isApy: boolean;
  inputUsd: number;
  shouldComputeAfter: boolean;
  meritAnchorTvlUsd?: number;
  eligibilityRatio?: number;
  grossInputUsd?: number;
  totalPositionUsd?: number;
  walletPositionUsd?: number;
  grossForEligibility?: number;
  netForEligibility?: number;
  walletEligibilityRatio?: number;
}

export const buildMeritCampaignDetails = ({
  merits,
  isApy,
  inputUsd,
  shouldComputeAfter,
  meritAnchorTvlUsd,
  eligibilityRatio = 1,
  grossInputUsd,
  totalPositionUsd,
  walletPositionUsd,
  grossForEligibility,
  netForEligibility,
  walletEligibilityRatio = 1,
}: MeritCampaignDetailsOptions): SimulationCampaignDetail[] => {
  const rows: SimulationCampaignDetail[] = [];
  if (!merits?.length) return rows;

  const netNote = grossForEligibility != null && netForEligibility != null
    ? buildNetEligibleNote(netForEligibility, grossForEligibility)
    : (grossInputUsd !== undefined ? buildNetEligibleNote(inputUsd, grossInputUsd) : null);

  merits.forEach((group, groupIndex) => {
    const breakdowns = group.breakdowns ?? [];
    const activeBreakdowns = breakdowns.filter((b) => isCampaignActive(b.campaignStartedAt, b.campaignEndedAt));
    if (activeBreakdowns.length === 0) return;

    const groupName = (group.name?.trim() || 'Merit');
    const groupHref = typeof group.link === 'string' && group.link.trim() ? group.link.trim() : null;
    const groupMessage = group.message;

    activeBreakdowns.forEach((breakdown, bdIndex) => {
      const baseAprPercent = sanitizePercent(breakdown.campaignApr);
      const positionCapUsd = breakdown.positionCapUsd;
      // AAV-979: per-campaign current must include position cap dilution for wallet positions
      let effectiveBaseApr = baseAprPercent;
      if (positionCapUsd != null && positionCapUsd > 0 && walletPositionUsd != null && walletPositionUsd > 0) {
        const { aprPercent: cappedApr } = applyPositionCap(baseAprPercent, walletPositionUsd, positionCapUsd);
        effectiveBaseApr = cappedApr;
      }
      // AAV-1102: per-campaign current must use wallet eligibility ratio to match aggregate sumCurrent
      const baseCurrent = scaleAprThenConvert(effectiveBaseApr, { ratio: walletEligibilityRatio, isApy });
      const bdActionLabel = extractActionLabelFromMeritMessage(breakdown.message);
      const bdLabel = bdActionLabel ?? extractActionLabelFromMeritMessage(groupMessage) ?? (activeBreakdowns.length > 1 ? (positionCapUsd != null && positionCapUsd > 0 ? `${groupName} (double yield)` : `${groupName} (base)`) : groupName);
      let baseAfter: number | null = null;
      let capMetrics: import('./incentiveCaps').SimulationCapMetrics | undefined;
      let notes: import('./incentiveCaps').IncentiveNote[] | undefined;

      if (shouldComputeAfter) {
        const fp = inputUsd > 0 ? forecastMeritApr({
          depositUsd: inputUsd,
          forecastAprPercent: baseAprPercent,
          startDate: breakdown.campaignStartedAt,
          endDate: breakdown.campaignEndedAt,
          anchorTvlUsd: meritAnchorTvlUsd,
        }) : null;
        const fullAfterApr = fp
          ? fp.apr * 100
          : baseAprPercent;
        if (positionCapUsd != null && positionCapUsd > 0) {
          const capResult = applyPositionCapToForecastResult(
            fullAfterApr,
            totalPositionUsd ?? inputUsd,
            positionCapUsd,
            { },
          );
          baseAfter = scaleAprThenConvert(capResult.aprPercent, { ratio: eligibilityRatio, isApy });
          capMetrics = capResult.capMetrics;
          notes = capResult.notes;
        } else {
          baseAfter = scaleAprThenConvert(fullAfterApr, { ratio: eligibilityRatio, isApy });
        }
      }
      const delta = baseAfter !== null ? baseAfter - baseCurrent : null;
      rows.push({
        id: `merit-${groupIndex}-${bdIndex}`,
        label: bdLabel,
        current: baseCurrent,
        after: baseAfter,
        delta,
        capMetrics,
        notes,
        href: groupHref,
      });
    });
  });

  return shouldExposeCampaignRows(rows) ? rows : [];
};

export interface MerklCampaignDetailsOptions {
  opportunities: MerklOpportunityGroup[] | undefined;
  isApy: boolean;
  inputUsd: number;
  forecastStates: Record<string, MerklForecastWireItem>;
  whitelistMerklCampaignIds?: ReadonlySet<string>;
  tydroPointToUsdRate: number;
  shouldComputeAfter: boolean;
  eligibilityRatio?: number;
  grossInputUsd?: number;
  merklGroupMultiplier?: (group: MerklOpportunityGroup) => number;
  merklCrossReserveNote?: (group: MerklOpportunityGroup) => string | null;
  campaignAccessStatuses?: Record<string, 'allowed' | 'whitelist-blocked' | 'blacklisted'>;
  nativeApyPercent?: number;
  pointRateMap?: PointRateMap;
  grossForEligibility?: number;
  netForEligibility?: number;
  tokenPrice?: number;
  decimals?: number;
  tokenSymbol?: string;
  walletEligibilityRatio?: number;
  walletMerklGroupMultiplier?: (group: MerklOpportunityGroup) => number;
  crossReserveNetEligibleUsd?: (group: MerklOpportunityGroup) => number;
}

export const buildMerklCampaignDetails = ({
  opportunities,
  isApy,
  inputUsd,
  forecastStates,
  whitelistMerklCampaignIds,
  tydroPointToUsdRate,
  shouldComputeAfter,
  eligibilityRatio = 1,
  grossInputUsd,
  merklGroupMultiplier,
  merklCrossReserveNote,
  campaignAccessStatuses,
  nativeApyPercent,
  pointRateMap,
  grossForEligibility,
  netForEligibility,
  tokenPrice,
  decimals,
  tokenSymbol,
  walletEligibilityRatio = 1,
  walletMerklGroupMultiplier,
  crossReserveNetEligibleUsd,
}: MerklCampaignDetailsOptions): SimulationCampaignDetail[] => {
  if (!opportunities?.length) return [];

  const netNote = grossForEligibility != null && netForEligibility != null
    ? buildNetEligibleNote(netForEligibility, grossForEligibility)
    : (grossInputUsd !== undefined ? buildNetEligibleNote(inputUsd, grossInputUsd) : null);

  // User-friendly labels; when the same opportunity name appears on multiple rows, add a stable "#n" suffix
  // (same rule with or without scenario input so the list does not change shape).
  const collected: LabeledCampaignRow[] = [];

  opportunities.forEach((opportunity, oppIndex) => {
    (opportunity.breakdowns ?? []).forEach((bd, bdIndex) => {
      if (!isCampaignActive(bd.campaignStartedAt, bd.campaignEndedAt)) return;
      if (!isMerklWhitelistBreakdownIncluded(bd, whitelistMerklCampaignIds, campaignAccessStatuses?.[bd.campaignId])) return;

      const effectiveRate = pointRateMap
        ? getPointToUsdRate(bd.rewardTokenSymbol, pointRateMap)
        : tydroPointToUsdRate;
      // AAV-1102: per-campaign current must use wallet multiplier + eligibility to match aggregate sumCurrent
      const walletGroupMul = walletMerklGroupMultiplier ? walletMerklGroupMultiplier(opportunity) : 1;
      const currentApr = sanitizePercent(forecastMerklApr(bd, 0, forecastStates, effectiveRate, nativeApyPercent));
      const current = scaleAprThenConvert(currentApr, { ratio: walletEligibilityRatio * walletGroupMul, isApy });
      let after: number | null = null;
      let capMetrics: import('./incentiveCaps').SimulationCapMetrics | undefined;
      let notes: import('./incentiveCaps').IncentiveNote[] | undefined;

      const isForecastRequiring = !!bd.campaignType && FORECAST_REQUIRING_CAMPAIGN_TYPES.has(bd.campaignType);
      const merged = mergeForecastState(bd, forecastStates, effectiveRate, nativeApyPercent);
      const forecastUnavailable = isForecastRequiring && checkForecastAvailability(bd.campaignType, bd.campaignId, merged, forecastStates);

      if (shouldComputeAfter) {
        const forecastApr = forecastMerklApr(bd, inputUsd, forecastStates, effectiveRate, nativeApyPercent);
        const forecastAprSan = sanitizePercent(forecastApr);
        const groupMul = merklGroupMultiplier ? merklGroupMultiplier(opportunity) : 1;
        const useUnifiedEligibility =
          crossReserveNetEligibleUsd != null &&
          grossForEligibility != null &&
          grossForEligibility > 0;
        const effectiveCapUsd = resolvePositionCapUsd(
          bd.positionCapNative,
          bd.positionCapUsd,
          tokenPrice,
          decimals,
        );
        const netEligibleUsd = useUnifiedEligibility
          ? Math.max(crossReserveNetEligibleUsd(opportunity), 0)
          : null;
        const eligibleUsd = netEligibleUsd !== null && effectiveCapUsd != null && effectiveCapUsd > 0
          ? Math.min(netEligibleUsd, effectiveCapUsd)
          : netEligibleUsd;
        let afterApr = useUnifiedEligibility
          ? forecastAprSan * eligibleUsd! / grossForEligibility
          : forecastAprSan * eligibilityRatio * groupMul;

        const merklType = merged?.campaignType;
        const isTargetTotalApr = merklType === 'TARGET_TOTAL_APR';
        if (
          merged &&
          (merklType === 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE' || merklType === 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE' || isTargetTotalApr)
        ) {
          const hypotheticalTvl = Math.max((merged.latestTvl ?? 0) + inputUsd, 0);
          const forecast = forecastWithTVL(merged, hypotheticalTvl);
          const isFixLike = merklType === 'FIX_REWARD_VALUE_PER_LIQUIDITY_VALUE' || (isTargetTotalApr && merged.budgetBoundMode === 'FIX_APR');
          const isMaxLike = merklType === 'MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE' || (isTargetTotalApr && merged.budgetBoundMode !== 'FIX_APR');
          if (isFixLike && typeof forecast.fixRewardableDays === 'number') {
            const fixEffect = buildFixRewardCapEffect(forecast.fixRewardableDays);
            notes = [capEffectToNote(fixEffect)];
          } else if (isMaxLike && forecast.regime === 'APR_CAPPED' && afterApr < currentApr) {
            const maxEffect = buildMaxRewardCapEffect();
            notes = [capEffectToNote(maxEffect)];
          }
        }

        if (effectiveCapUsd != null && effectiveCapUsd > 0) {
          const positionUsd = useUnifiedEligibility
            ? netEligibleUsd!
            : (() => {
                const constraint = opportunity.netPositionConstraint;
                return constraint &&
                  netForEligibility != null &&
                  grossForEligibility != null &&
                  grossForEligibility > 0
                  ? netForEligibility
                  : (grossInputUsd ?? inputUsd);
              })();
          const capResult = applyPositionCapToForecastResult(
            useUnifiedEligibility ? forecastAprSan : afterApr,
            positionUsd,
            effectiveCapUsd,
            { isCombineCap: bd.isCombineCap ?? false, positionCapNative: bd.positionCapNative, tokenSymbol, decimals },
          );
          if (!useUnifiedEligibility) {
            afterApr = capResult.aprPercent;
          }
          if (capResult.notes) {
            capMetrics = capResult.capMetrics;
            notes = [...(notes ?? []), ...capResult.notes];
          }
        }

        after = scaleAprThenConvert(afterApr, { ratio: 1, isApy });
      }

      const delta = after !== null ? after - current : null;
      const oppLabel = opportunity.name?.trim() || 'Merkl';
      const oppLink = opportunity.link;
      collected.push({
        id: `merkl-${oppIndex}-${bdIndex}-${bd.campaignId ?? 'x'}`,
        baseLabel: oppLabel,
        current,
        after,
        delta,
        capMetrics,
        notes,
        href: oppLink ?? null,
        forecastUnavailable: forecastUnavailable || undefined,
      });
    });
  });

  return finalizeCampaignDetailRows(collected);
};


export interface BrevisCampaignDetailsOptions {
  items: BrevisIncentive[] | undefined;
  isApy: boolean;
  inputUsd: number;
  sharedDepositsByCampaignId?: ReadonlyMap<string, number>;
  shouldComputeAfter: boolean;
  forecastStates?: Record<string, MerklForecastWireItem>;
  totalPositionUsd?: number;
  walletPositionUsd?: number;
}

export const buildBrevisCampaignDetails = ({
  items,
  isApy,
  inputUsd,
  sharedDepositsByCampaignId,
  shouldComputeAfter,
  forecastStates,
  totalPositionUsd,
  walletPositionUsd,
}: BrevisCampaignDetailsOptions): SimulationCampaignDetail[] => {
  if (!items?.length) return [];

  const flattened = flattenBrevisCampaignRows(items);
  const collected: LabeledCampaignRow[] = [];
  const nowMs = Date.now();
  flattened.forEach(({ source, breakdown }) => {
    const resolved = getBrevisResolvedBreakdown(source, breakdown);
    const baseLabel = (resolved.name?.trim() || resolved.message?.trim() || 'Brevis');
    if (!isCampaignActive(resolved.campaignStartedAt, resolved.campaignEndedAt, nowMs, true)) return;
    const nominal = resolveBrevisCurrentApr(resolved, forecastStates);
    // AAV-1102: per-campaign current must apply wallet position cap dilution to match aggregate sumCurrent
    let currentNominal = nominal;
    if (resolved.positionCapUsd != null && resolved.positionCapUsd > 0 && walletPositionUsd != null && walletPositionUsd > 0) {
      const { aprPercent: cappedApr } = applyPositionCap(nominal, walletPositionUsd, resolved.positionCapUsd);
      currentNominal = cappedApr;
    }
    const current = isApy ? convertAprToApy(currentNominal) : currentNominal;
    let after: number | null = null;
    let capMetrics: import('./incentiveCaps').SimulationCapMetrics | undefined;
    let notes: import('./incentiveCaps').IncentiveNote[] | undefined;
    const combined = getBrevisCombinedDepositUsd(source, breakdown, sharedDepositsByCampaignId);
    const positionUsd = combined ?? totalPositionUsd ?? inputUsd;

    const isForecastRequiring = !!resolved.campaignType && FORECAST_REQUIRING_CAMPAIGN_TYPES.has(resolved.campaignType);
    const forecastUnavailable = isForecastRequiring
      ? checkForecastAvailability(resolved.campaignType, resolved.campaignId, forecastStates ? mergeForecastState(resolved, forecastStates, 0) : undefined, forecastStates)
      : false;

    if (shouldComputeAfter && positionUsd > 0) {
      let aprPercent = forecastStates
        ? sanitizePercent(forecastMerklApr(resolved, inputUsd, forecastStates, 0))
        : nominal;

      const endMs = parseCampaignBoundaryMs(resolved.campaignEndedAt, 'end');
      const capResult = applyPositionCapToForecastResult(
        aprPercent,
        positionUsd,
        resolved.positionCapUsd,
        {
          isCombineCap: combined !== undefined,
          remainingBudget: resolved.totalBudget != null && resolved.totalBudget > 0
            ? resolved.totalBudget - (resolved.positionCapUsd ?? 0)
            : null,
          dailyRewardUsd: positionUsd * (aprPercent / 100) / 365,
          remainingDays: endMs !== null && endMs > nowMs ? (endMs - nowMs) / 86_400_000 : null,
        },
      );
      aprPercent = capResult.aprPercent;
      after = isApy ? convertAprToApy(aprPercent) : aprPercent;

      if (capResult.notes) {
        capMetrics = capResult.capMetrics;
        notes = capResult.notes;
      }
    }

    const delta = after !== null ? after - current : null;
    collected.push({
      id: `brevis-${collected.length}-${breakdown.campaignId ?? 'b'}`,
      baseLabel,
      current,
      after,
      delta,
      capMetrics,
      notes,
      forecastUnavailable: forecastUnavailable || undefined,
    });
  });

  return finalizeCampaignDetailRows(collected);
};

export const attachCampaigns = (
  metric: SimulationMetric,
  campaigns: SimulationCampaignDetail[],
  offsetNotes?: IncentiveNote[],
): SimulationSourceDetail => {
  if (campaigns.length === 0 && !offsetNotes?.length) return { ...metric };
  return {
    ...metric,
    campaigns: campaigns.length > 0 ? campaigns : undefined,
    offsetNotes: offsetNotes?.length ? offsetNotes : undefined,
  };
};

// AAV-1113: buildIncentiveAfter was removed — afterIncentive is now derived from
// per-source dispatch map sum (sr[key].after), eliminating the independent path
// that could diverge from per-source values.

export const toDisplayNative = (rawApy: number | null | undefined): number | null => {
  if (rawApy === null || rawApy === undefined || !Number.isFinite(rawApy)) return null;
  return rawApy;
};

export const getReserveSimulationId = (reserve: Pick<ReserveWithSpread, 'reserveId'>): string =>
  getReserveKey(reserve);

export const buildPriceLookup = (reserve: ReserveWithSpread, tokenPrices?: TokenPricesIndex, actionType: 'Supply' | 'Borrow' = 'Supply') => ({
  tokenPrices,
  chainId: reserve.chainId,
  actionType,
  tokenSymbol: reserve.tokenSymbol,
  tokenAddress: reserve.tokenAddress,
  aTokenAddress: reserve.aTokenAddress,
  vTokenAddress: reserve.vTokenAddress,
});

export const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

export function nativeAprPercentToApyPercent(aprPercent: number): number {
  if (!Number.isFinite(aprPercent) || aprPercent <= 0) return 0;
  const aprDecimal = aprPercent / 100;
  const apyDecimal = Math.pow(1 + aprDecimal / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1;
  return apyDecimal * 100;
}

export function buildSupplyUsdAccrualSide(
  principalUsd: number,
  nativeAprPercent: number | null,
  incentiveAprPercent: number | null
): ScenarioUsdAccrualSide | null {
  if (!Number.isFinite(principalUsd) || principalUsd <= 0) return null;
  const nativeUsd = (ratePercent: number) =>
    principalUsd * annualPercentToDailyFraction(nativeAprPercentToApyPercent(ratePercent), true);
  const incentiveUsd = (ratePercent: number) => principalUsd * annualPercentToDailyFraction(ratePercent, false);
  const nativeUsdPerDay = nativeAprPercent !== null ? nativeUsd(nativeAprPercent) : null;
  const incentiveUsdPerDay = incentiveAprPercent !== null ? incentiveUsd(incentiveAprPercent) : null;
  return {
    nativeUsdPerDay,
    incentiveUsdPerDay,
    totalUsdPerDay:
      nativeUsdPerDay !== null || incentiveUsdPerDay !== null
        ? (nativeUsdPerDay ?? 0) + (incentiveUsdPerDay ?? 0)
        : null,
  };
}

export function buildBorrowUsdAccrualSide(
  principalUsd: number,
  nativeAprPercent: number | null,
  incentiveAprPercent: number | null
): ScenarioUsdAccrualSide | null {
  if (!Number.isFinite(principalUsd) || principalUsd <= 0) return null;
  const nativePay = (ratePercent: number) =>
    -principalUsd * annualPercentToDailyFraction(nativeAprPercentToApyPercent(ratePercent), true);
  const incentiveRebate = (ratePercent: number) =>
    principalUsd * annualPercentToDailyFraction(ratePercent, false);
  const nativeUsdPerDay = nativeAprPercent !== null ? nativePay(nativeAprPercent) : null;
  const incentiveUsdPerDay = incentiveAprPercent !== null ? incentiveRebate(incentiveAprPercent) : null;
  return {
    nativeUsdPerDay,
    incentiveUsdPerDay,
    totalUsdPerDay:
      nativeUsdPerDay !== null || incentiveUsdPerDay !== null
        ? (nativeUsdPerDay ?? 0) + (incentiveUsdPerDay ?? 0)
        : null,
  };
}

export const resolveLocalReserveTokenPrice = (reserve: ReserveWithSpread, tokenPrices?: TokenPricesIndex): number | undefined => {
  return (
    resolveForecastTokenPrice(buildPriceLookup(reserve, tokenPrices, 'Supply')) ??
    resolveForecastTokenPrice(buildPriceLookup(reserve, tokenPrices, 'Borrow'))
  );
};

export function buildRateSimulationResult({
  reserve,
  reserveRateInput,
  isApy,
  whitelistMerklCampaignIds,
  tydroPointToUsdRate,
  tokenPrice,
  supplyInput,
  borrowInput,
  inputMode = 'token',
  forecastStates,
  meritMerklNetPosition = true,
  crossReservePositions,
  walletCrossReservePositions,
  reserveSymbolById,
  campaignAccessStatuses,
  hubSupplied,
  hubBorrowed,
  totalSupplyUsd,
  totalBorrowUsd,
  walletSupplyUsd: explicitWalletSupplyUsd,
  walletBorrowUsd: explicitWalletBorrowUsd,
  pointRateMap,
  portfolioScenarioActive = false,
}: BuildRateSimulationResultParams): RateSimulationComputedResult {
  const rawSupply = parseSignedNumberInput(supplyInput);
  const rawBorrow = parseSignedNumberInput(borrowInput);

  // In USD mode, convert to token amounts for native simulation
  const supplyAmount = inputMode === 'usd' && tokenPrice ? rawSupply / tokenPrice : rawSupply;
  const borrowAmount = inputMode === 'usd' && tokenPrice ? rawBorrow / tokenPrice : rawBorrow;
  const supplyBlocked = isSupplyDisabled(reserve);
  const borrowBlocked = isBorrowDisabled(reserve);
  const hasSupplyInput = supplyBlocked ? false : rawSupply !== 0;
  const hasBorrowInput = borrowBlocked ? false : rawBorrow !== 0;
  const hasAnyInput = hasSupplyInput || hasBorrowInput;
  // AAV-1166: Split hasAnyInput into hasLocalInput (unchanged behavior) and shouldComputeAfter.
  // portfolioScenarioActive opens after computation for portfolio members without local input.
  const hasLocalInput = hasAnyInput;
  const shouldComputeAfter = hasLocalInput || portfolioScenarioActive;

  // For incentive forecasts, we need USD values
  const rawSupplyInputUsd = inputMode === 'usd' ? rawSupply : (tokenPrice ? rawSupply * tokenPrice : 0);
  const rawBorrowInputUsd = inputMode === 'usd' ? rawBorrow : (tokenPrice ? rawBorrow * tokenPrice : 0);

  // Calculate cap constraints for capping inputs
  const supplyCapUsd = nativeToUsd(reserve.supplyCap, reserve.decimals, reserve.tokenPrice) ?? null;
  const borrowCapUsd = nativeToUsd(reserve.borrowCap, reserve.decimals, reserve.tokenPrice) ?? null;
  const currentReserveSizeUsd = nativeToUsd(reserve.supplied, reserve.decimals, reserve.tokenPrice) ?? null;
  
  // Calculate available supply room (prefer API suppliable, fallback to cap-size)
  const availableSupplyRoomUsd = (() => {
    const fromApi = nativeToUsd(reserve.suppliable, reserve.decimals, reserve.tokenPrice) ?? null;
    if (fromApi !== null) return fromApi;
    return supplyCapUsd !== null && supplyCapUsd > 0 && currentReserveSizeUsd !== null
      ? Math.max(supplyCapUsd - currentReserveSizeUsd, 0)
      : null;
  })();

  // Cap supply input
  const supplyInputUsd = 
    availableSupplyRoomUsd !== null && rawSupplyInputUsd > availableSupplyRoomUsd
      ? availableSupplyRoomUsd
      : rawSupplyInputUsd;
  const liquiditySource = reserveRateInput ?? reserve;
  const availableSupplyLiquidityUsd = tokenPrice && liquiditySource.liquidity
    ? Number(liquiditySource.liquidity) / Math.pow(10, liquiditySource.decimals ?? DEFAULT_TOKEN_DECIMALS) * tokenPrice
    : null;

  // Calculate current native simulation first to get totalBorrowedUsd for borrow cap
  const currentNativeSimulation = reserveRateInput
    ? simulateNativeRatesAfterActions(reserveRateInput, {
        supplyAmount: '0',
        borrowAmount: '0',
      })
    : null;

  // Calculate totalBorrowedUsd for borrow cap constraint
  // Must use per-Spoke borrowed (reserve.borrowed), not Hub-level (reserveRateInput.borrowed)
  const currentTotalBorrowedUsd = tokenPrice && reserve.borrowed
    ? (() => {
        const decimals = reserve.decimals ?? DEFAULT_TOKEN_DECIMALS;
        const scale = Math.pow(10, decimals);
        const totalDebt = Number(reserve.borrowed) / scale;
        return totalDebt * tokenPrice;
      })()
    : null;

  // Early exit: if borrow is disabled, skip borrow room calculation entirely.
  const borrowCapRemainingUsd = borrowBlocked ? null
    : borrowCapUsd !== null && borrowCapUsd > 0 && currentTotalBorrowedUsd !== null
      ? Math.max(borrowCapUsd - currentTotalBorrowedUsd, 0)
      : null;

  // If supply is disabled, new supply input does not increase available liquidity.
  const effectiveSupplyInputUsd = supplyBlocked
    ? 0
    : availableSupplyLiquidityUsd !== null
      ? Math.max(supplyInputUsd, -availableSupplyLiquidityUsd)
      : supplyInputUsd;
  const availableLiquidityForBorrowUsd = borrowBlocked ? null
    : liquiditySource.liquidity != null && tokenPrice
      ? (() => {
          const decimals = liquiditySource.decimals ?? DEFAULT_TOKEN_DECIMALS;
          const scale = Math.pow(10, decimals);
          const liquidityRaw = Number(liquiditySource.liquidity) / scale;
            return liquidityRaw * tokenPrice + effectiveSupplyInputUsd;
        })()
      : null;

  // Available to borrow = min(borrow cap remaining, available liquidity + scenario supply)
  // Valid for both V3 and V4. If borrow is disabled, borrow room is 0 (skip all calculation).
  // A/B 混合类: borrowCapRemaining (A 类), 但 availableLiquidityForBorrow 含 effectiveSupplyInputUsd (B 类),
  // 故 supply input 会影响此值, borrow input 不会。
  const availableBorrowRoomUsd = borrowBlocked ? 0
    : borrowCapRemainingUsd !== null && availableLiquidityForBorrowUsd !== null
      ? Math.min(borrowCapRemainingUsd, availableLiquidityForBorrowUsd)
      : borrowCapRemainingUsd ?? availableLiquidityForBorrowUsd ?? (nativeToUsd(reserve.borrowable, reserve.decimals, reserve.tokenPrice) ?? null);

  // ─── B 类字段: borrowLimitedByLiquidity (随 simulation input 变化) ───
  // Track which constraint is binding (for UI messaging)
  const borrowLimitedByLiquidity =
    availableLiquidityForBorrowUsd !== null &&
    (borrowCapRemainingUsd === null || availableLiquidityForBorrowUsd < borrowCapRemainingUsd);

  // Cap borrow input by available borrow room (which already considers both constraints)
  let borrowInputUsd = rawBorrowInputUsd;
  if (availableBorrowRoomUsd !== null && borrowInputUsd > availableBorrowRoomUsd) {
    borrowInputUsd = Math.max(0, availableBorrowRoomUsd);
  }

  // Convert capped USD back to token amounts for native rate simulation
  const cappedSupplyAmount = tokenPrice && tokenPrice > 0
    ? effectiveSupplyInputUsd / tokenPrice
    : supplyAmount;
  const cappedBorrowAmount = tokenPrice && tokenPrice > 0
    ? borrowInputUsd / tokenPrice
    : borrowAmount;

  const combinedNativeSimulation = reserveRateInput && hasAnyInput
    ? simulateNativeRatesAfterActions(reserveRateInput, {
        supplyAmount: String(cappedSupplyAmount),
        borrowAmount: String(cappedBorrowAmount),
      })
    : null;

  // ─── A 类字段: Current snapshot (不随 simulation input 变化) ───

  const supplyCurrentNative = toDisplayNative(reserve.supplyApy);
  const borrowCurrentNative = toDisplayNative(reserve.borrowApy);

  // Wallet position for position cap dilution in buildIncentiveCurrent.
  // Priority: explicit wallet param > derived from totalSupplyUsd - delta.
  // In portfolio mode: totalSupplyUsd = wallet + delta, so wallet = total - delta.
  // Always derive wallet when totalSupplyUsd is available, regardless of hasInput.
  // Deposit Ceiling dilution is a property of the wallet position itself, not the
  // user's simulation input. A wallet position above the cap should show diluted
  // incentive even when the user hasn't entered any delta.
  //
  // Wallet positions are passed explicitly by the caller (from PerReserveInput).
  // No reverse derivation — see AAV-1140 / docs/specs/wallet-position-explicit-passing.md.
  const walletSupplyUsd = explicitWalletSupplyUsd;
  const walletBorrowUsd = explicitWalletBorrowUsd;

  // AAV-1060: Eligibility ratio and merklGroupMultiplier must be computed before
  // buildIncentiveCurrent so that aggregate current matches per-source current.
  // totalSupplyUsd/totalBorrowUsd are already resolved by the caller.
  // Callers are responsible for providing the correct total position:
  // - Portfolio mode: wallet + delta (from PerReserveInput)
  // - Single simulation: input USD (caller resolves: input IS total)
  // - No input: undefined (no position to dilute/accrue)
  const supplyNetInputUsd = Math.max(supplyInputUsd - borrowInputUsd, 0);
  const borrowNetInputUsd = Math.max(borrowInputUsd - supplyInputUsd, 0);
  const supplyGrossForEligibility = totalSupplyUsd ?? supplyInputUsd;
  const supplyBorrowForEligibility = totalBorrowUsd ?? borrowInputUsd;
  const supplyNetForEligibility = Math.max(supplyGrossForEligibility - supplyBorrowForEligibility, 0);
  const supplyEligibilityRatio = supplyGrossForEligibility > 0 ? supplyNetForEligibility / supplyGrossForEligibility : 1;
  const borrowGrossForEligibility = totalBorrowUsd ?? borrowInputUsd;
  const borrowSupplyForEligibility = totalSupplyUsd ?? supplyInputUsd;
  const borrowNetForEligibility = Math.max(borrowGrossForEligibility - borrowSupplyForEligibility, 0);
  const borrowEligibilityRatio = borrowGrossForEligibility > 0 ? borrowNetForEligibility / borrowGrossForEligibility : 1;

  const supplyMeritMerklInputUsd = meritMerklNetPosition ? supplyNetInputUsd : supplyInputUsd;
  const borrowMeritMerklInputUsd = meritMerklNetPosition ? borrowNetInputUsd : borrowInputUsd;
  const supplyMeritMerklEligibilityRatio = meritMerklNetPosition ? supplyEligibilityRatio : 1;
  const borrowMeritMerklEligibilityRatio = meritMerklNetPosition ? borrowEligibilityRatio : 1;

  // GOLDEN RULE (AAV-1121): Wallet-only eligibility ratios for current*.
  // current must NEVER change with simulation input — it represents the wallet's present state.
  // When no wallet exists (Shared Scenario), wallet ratios must be identity (1.0),
  // NOT fallback to simulation inputs. No wallet = no position = no scaling.
  const hasWallet = walletSupplyUsd != null || walletBorrowUsd != null;
  const walletSupplyGrossForEligibility = hasWallet ? (walletSupplyUsd ?? 0) : 0;
  const walletSupplyBorrowForEligibility = hasWallet ? (walletBorrowUsd ?? 0) : 0;
  const walletSupplyNetForEligibility = Math.max(walletSupplyGrossForEligibility - walletSupplyBorrowForEligibility, 0);
  const walletSupplyEligibilityRatio = walletSupplyGrossForEligibility > 0 ? walletSupplyNetForEligibility / walletSupplyGrossForEligibility : 1;
  const walletBorrowGrossForEligibility = hasWallet ? (walletBorrowUsd ?? 0) : 0;
  const walletBorrowSupplyForEligibility = hasWallet ? (walletSupplyUsd ?? 0) : 0;
  const walletBorrowNetForEligibility = Math.max(walletBorrowGrossForEligibility - walletBorrowSupplyForEligibility, 0);
  const walletBorrowEligibilityRatio = walletBorrowGrossForEligibility > 0 ? walletBorrowNetForEligibility / walletBorrowGrossForEligibility : 1;

  const walletSupplyMeritMerklEligibilityRatio = meritMerklNetPosition ? walletSupplyEligibilityRatio : 1;
  const walletBorrowMeritMerklEligibilityRatio = meritMerklNetPosition ? walletBorrowEligibilityRatio : 1;

  // GOLDEN RULE (AAV-1121): walletCrossReservePositions must be undefined when no wallet.
  // This ensures walletMerklGroupMultiplier returns 1.0 (identity) for current*.
  // AAV-1137: Built by the caller from wallet-only positions across ALL reserves,
  // not just the self-entry, so current* never changes with simulation input on other reserves.

  const merklGroupMultiplier = (side: RateSide): ((group: MerklOpportunityGroup) => number) => {
    const grossUsd = side === 'supply' ? supplyGrossForEligibility : borrowGrossForEligibility;
    return (group) => {
      // AAV-962: BORROW_BL — supply incentive zeroed when user has borrow position.
      // Binary zeroing (unlike netPositionConstraint which is proportional).
      if (group.borrowBlacklist === true && side === 'supply' && borrowGrossForEligibility > 0) {
        return 0;
      }
      // AAV-895: Cross-asset pairing (min(1,2)) — checked before netPositionConstraint (mutually exclusive).
      const pairing = group.crossAssetPairing;
      if (pairing && crossReservePositions && crossReservePositions.size > 0) {
        return computeCrossAssetEligibilityRatio({
          sourceGrossUsd: grossUsd,
          pairing,
          crossReservePositions,
        });
      }
      const constraint = group.netPositionConstraint;
      // AAV-1100/AAV-1113: offsetReserveIds always includes self (confirmed in all real data).
      // crossReserveRatio already deducts same-reserve borrow via computeCrossReserveNetEligible.
      // The sameReserveFactor branch (!includesSelf) was dead code — removed.
      return constraint && crossReservePositions && crossReservePositions.size > 0
        ? computeCrossReserveEligibilityRatio({
            sourceSide: constraint.sourceSide,
            sourceGrossUsd: grossUsd,
            constraint,
            crossReservePositions,
          })
        : 1;
    };
  };

  // AAV-1101: Wallet-only merklGroupMultiplier for buildIncentiveCurrent & headline.
  const walletMerklGroupMultiplier = (side: RateSide): ((group: MerklOpportunityGroup) => number) => {
    const grossUsd = side === 'supply' ? walletSupplyGrossForEligibility : walletBorrowGrossForEligibility;
    return (group) => {
      // AAV-962: BORROW_BL — supply incentive zeroed when wallet has borrow position.
      // Uses wallet-only borrow (not simulation input) to preserve Golden Rule #1.
      if (group.borrowBlacklist === true && side === 'supply' && walletBorrowGrossForEligibility > 0) {
        return 0;
      }
      // AAV-895: Cross-asset pairing (min(1,2)) — checked before netPositionConstraint (mutually exclusive).
      const pairing = group.crossAssetPairing;
      if (pairing && walletCrossReservePositions && walletCrossReservePositions.size > 0) {
        return computeCrossAssetEligibilityRatio({
          sourceGrossUsd: grossUsd,
          pairing,
          crossReservePositions: walletCrossReservePositions,
        });
      }
      const constraint = group.netPositionConstraint;
      // AAV-1100/AAV-1113: Same as merklGroupMultiplier — sameReserveFactor dead code removed.
      return constraint && walletCrossReservePositions && walletCrossReservePositions.size > 0
        ? computeCrossReserveEligibilityRatio({
            sourceSide: constraint.sourceSide,
            sourceGrossUsd: grossUsd,
            constraint,
            crossReservePositions: walletCrossReservePositions,
          })
        : 1;
    };
  };

  // AAV-1164: Unified eligibility — net eligible USD after cross-reserve offset.
  // Replaces merklGroupMultiplier for sumMerklIncentive* so cap and offset compose
  // as single eligible principal: eligible = min(netEligible, cap), rate = apr * eligible / gross.
  const crossReserveNetEligibleUsdFn = (side: RateSide): ((group: MerklOpportunityGroup) => number) => {
    const grossUsd = side === 'supply' ? supplyGrossForEligibility : borrowGrossForEligibility;
    return (group) => {
      // AAV-962: BORROW_BL — supply incentive zeroed when user has borrow position.
      // Returns 0 so unified eligibility path produces rate = apr * 0 / gross = 0.
      if (group.borrowBlacklist === true && side === 'supply' && borrowGrossForEligibility > 0) {
        return 0;
      }
      // AAV-895: Cross-asset pairing (min(1,2)) — checked before netPositionConstraint (mutually exclusive).
      const pairing = group.crossAssetPairing;
      if (pairing && crossReservePositions && crossReservePositions.size > 0) {
        return computeCrossAssetNetEligible({
          sourceGrossUsd: grossUsd,
          pairing,
          crossReservePositions,
        });
      }
      const constraint = group.netPositionConstraint;
      if (!constraint || !crossReservePositions || crossReservePositions.size === 0) return grossUsd;
      return computeCrossReserveNetEligible({
        sourceSide: constraint.sourceSide,
        sourceGrossUsd: grossUsd,
        constraint,
        crossReservePositions,
      });
    };
  };

  const walletCrossReserveNetEligibleUsdFn = (side: RateSide): ((group: MerklOpportunityGroup) => number) => {
    const grossUsd = side === 'supply' ? walletSupplyGrossForEligibility : walletBorrowGrossForEligibility;
    return (group) => {
      // AAV-962: BORROW_BL — supply incentive zeroed when wallet has borrow position.
      // Uses wallet-only borrow to preserve Golden Rule #1 (current* never changes with input).
      if (group.borrowBlacklist === true && side === 'supply' && walletBorrowGrossForEligibility > 0) {
        return 0;
      }
      // AAV-895: Cross-asset pairing (min(1,2)) — checked before netPositionConstraint (mutually exclusive).
      const pairing = group.crossAssetPairing;
      if (pairing && walletCrossReservePositions && walletCrossReservePositions.size > 0) {
        return computeCrossAssetNetEligible({
          sourceGrossUsd: grossUsd,
          pairing,
          crossReservePositions: walletCrossReservePositions,
        });
      }
      const constraint = group.netPositionConstraint;
      if (!constraint || !walletCrossReservePositions || walletCrossReservePositions.size === 0) return grossUsd;
      return computeCrossReserveNetEligible({
        sourceSide: constraint.sourceSide,
        sourceGrossUsd: grossUsd,
        constraint,
        crossReservePositions: walletCrossReservePositions,
      });
    };
  };

  const merklCrossReserveNote = (side: RateSide): ((group: MerklOpportunityGroup) => string | null) => {
    const grossUsd = side === 'supply' ? supplyGrossForEligibility : borrowGrossForEligibility;
    return (group) => {
      // AAV-895: Cross-asset pairing note — checked before netPositionConstraint (mutually exclusive).
      const pairing = group.crossAssetPairing;
      if (pairing && crossReservePositions && crossReservePositions.size > 0 && reserveSymbolById) {
        const effectiveUsd = computeCrossAssetNetEligible({
          sourceGrossUsd: grossUsd,
          pairing,
          crossReservePositions,
        });
        const pairedSymbol = reserveSymbolById.get(pairing.pairedReserveId) ?? pairing.pairedReserveId;
        return buildCrossAssetPairingNote({
          effectiveUsd,
          grossUsd,
          pairedSymbol,
          pairedSide: pairing.pairedSide,
          discountFactor: pairing.discountFactor,
        });
      }
      // AAV-1024: Generic note for Shared scenario (no crossReservePositions).
      // CAP and NPC are mutually exclusive, so this won't fire if the precise CAP note above returned.
      if (pairing && (!crossReservePositions || crossReservePositions.size === 0)) {
        return '⚠️ In Portfolio mode, this incentive is capped by paired asset position. See Portfolio for precise values.';
      }
      const constraint = group.netPositionConstraint;
      // AAV-1024: Generic note for Shared scenario (no crossReservePositions).
      if (constraint && (!crossReservePositions || crossReservePositions.size === 0)) {
        return '⚠️ In Portfolio mode, this incentive applies to net position only. Cross-reserve borrows may reduce eligibility.';
      }
      if (!constraint || !crossReservePositions || crossReservePositions.size === 0 || !reserveSymbolById) return null;
      const netUsd = computeCrossReserveNetEligible({
        sourceSide: constraint.sourceSide,
        sourceGrossUsd: grossUsd,
        constraint,
        crossReservePositions,
      });
      const offsetSymbols = constraint.offsetReserveIds
        .map((id) => reserveSymbolById?.get(id) ?? id)
        .filter(Boolean);
      return buildCrossReserveNetEligibleNote({
        netUsd,
        grossUsd,
        sourceSide: constraint.sourceSide,
        offsetSymbols,
      });
    };
  };

  // AAV-1165: Headline = pure market advertised rate.
  // No forecast, no wallet position, no position cap, no cross-reserve offset.
  // Used as reference value (T4 will surface in expanded details).
  const supplyHeadlineIncentive = isApy
    ? calculateTotalIncentiveApy(reserve.meritSupplys, reserve.merklSupplys, reserve.brevisSupplys, reserve.supplyIncentives, tydroPointToUsdRate, { whitelistMerklCampaignIds, campaignAccessStatuses, pointRateMap })
    : calculateTotalIncentiveApr(reserve.meritSupplys, reserve.merklSupplys, reserve.brevisSupplys, reserve.supplyIncentives, tydroPointToUsdRate, { whitelistMerklCampaignIds, campaignAccessStatuses, pointRateMap });
  const borrowHeadlineIncentive = isApy
    ? calculateTotalIncentiveApy(reserve.meritBorrows, reserve.merklBorrows, reserve.brevisBorrows, reserve.borrowIncentives, tydroPointToUsdRate, { whitelistMerklCampaignIds, campaignAccessStatuses, pointRateMap })
    : calculateTotalIncentiveApr(reserve.meritBorrows, reserve.merklBorrows, reserve.brevisBorrows, reserve.borrowIncentives, tydroPointToUsdRate, { whitelistMerklCampaignIds, campaignAccessStatuses, pointRateMap });
  // AAV-1112: currentIncentive is derived from per-source sumCurrent (dispatch map),
  // not from a separate buildIncentiveCurrent call. This eliminates the dual-code-path
  // bug where aggregate and per-source values could diverge.
  // The dispatch map loop runs inside the per-side for loop below, so currentIncentive
  // and currentTotal are computed there. Headline is still computed here because it
  // uses calculateTotalIncentiveApy/Apr (no positionUsd — headline = undiluted).

  // ─── B 类字段: After/Delta (随 simulation input 变化, 无模拟 → null) ───

  // Native rate is ALWAYS APY regardless of isApy toggle.
  // AprApyToggle contract: "Only incentive annual % follows this switch; native stays APY."
  // Using APR here would create a fake delta (APY current vs APR after) that doesn't
  // reflect user input — it's just a unit conversion artifact.
  const supplyAfterNative = combinedNativeSimulation
    ? combinedNativeSimulation.supplyApyPercent
    : (portfolioScenarioActive ? supplyCurrentNative : null);
  const borrowAfterNative = combinedNativeSimulation
    ? combinedNativeSimulation.borrowApyPercent
    : (portfolioScenarioActive ? borrowCurrentNative : null);

  const brevisSharedDepositsByCampaignId = hasAnyInput
    ? computeBrevisSharedCampaignDeposits(reserve, supplyInputUsd, borrowInputUsd)
    : undefined;

  // Net eligible amounts: supply net eligible = max(supply - borrow, 0),
  // borrow incentive eligible = max(borrow - supply, 0).
  // Gross amounts are used by incentive sources that reward both sides independently.
  type SourceKey = 'merit' | 'merkl' | 'brevis';

  interface SideSourceContext {
    isApy: boolean;
    shouldComputeAfter: boolean;
    hasAnyScenarioInput: boolean;
    meritMerklInputUsd: number;
    grossInputUsd: number;
    eligibilityRatio: number;
    walletEligibilityRatio: number;
    grossForEligibility: number;
    netForEligibility: number;
    totalPositionUsd: number | undefined;
    anchorTvlUsd: number | undefined;
    forecastStates: Record<string, MerklForecastWireItem> | undefined;
    whitelistMerklCampaignIds: ReadonlySet<string> | undefined;
    tydroPointToUsdRate: number;
    merklGroupMul: ((group: MerklOpportunityGroup) => number) | undefined;
    walletMerklGroupMul: ((group: MerklOpportunityGroup) => number) | undefined;
    // AAV-1164: Unified eligibility — net eligible USD after cross-reserve offset, per group.
    // When provided, cap and offset compose as single eligible principal in sumMerklIncentive*.
    crossReserveNetEligibleUsd: ((group: MerklOpportunityGroup) => number) | undefined;
    walletCrossReserveNetEligibleUsd: ((group: MerklOpportunityGroup) => number) | undefined;
    campaignAccessStatuses: Record<string, 'allowed' | 'blacklisted' | 'whitelist-blocked'> | undefined;
    nativeApyPercent: number | undefined;
    brevisSharedDeposits: ReadonlyMap<string, number> | undefined;
    walletPositionUsd: number | undefined;
    pointRateMap?: PointRateMap;
    tokenPrice: number | undefined;
    decimals: number | undefined;
    tokenSymbol: string | undefined;
  }

  const sourceDispatch: {
    [K in SourceKey]: {
      sumCurrent: (data: IncentiveSources[K], ctx: SideSourceContext) => number;
      sumAfter: (data: IncentiveSources[K], ctx: SideSourceContext) => number;
      buildDetails: (data: IncentiveSources[K], ctx: SideSourceContext) => SimulationCampaignDetail[];
    }
  } = {
    merit: {
      // AAV-979: sumCurrent must include position cap dilution for wallet positions
      // AAV-1101: sumCurrent uses wallet eligibility ratio (no delta)
      sumCurrent: (data, ctx) =>
        sumForecastMeritIncentiveApr(data, ctx.isApy, 0, ctx.anchorTvlUsd, ctx.walletPositionUsd) * ctx.walletEligibilityRatio,
      sumAfter: (data, ctx) =>
        sumForecastMeritIncentiveApr(data, ctx.isApy, ctx.meritMerklInputUsd, ctx.anchorTvlUsd, ctx.totalPositionUsd)
        * ctx.eligibilityRatio,
      buildDetails: (data, ctx) =>
        buildMeritCampaignDetails({
          merits: data,
          isApy: ctx.isApy,
          inputUsd: ctx.meritMerklInputUsd,
          shouldComputeAfter: ctx.shouldComputeAfter,
          meritAnchorTvlUsd: ctx.anchorTvlUsd,
          eligibilityRatio: ctx.eligibilityRatio,
          grossInputUsd: ctx.grossInputUsd,
          totalPositionUsd: ctx.totalPositionUsd,
          walletPositionUsd: ctx.walletPositionUsd,
          grossForEligibility: ctx.grossForEligibility,
          netForEligibility: ctx.netForEligibility,
          walletEligibilityRatio: ctx.walletEligibilityRatio,
        }),
    },
    merkl: {
      // AAV-1164: Use crossReserveNetEligibleUsd for unified eligibility composition.
      // merklGroupMultiplier kept as fallback when positionUsd is null (Shared Scenario).
      sumCurrent: (data, ctx) =>
        ctx.isApy
          ? sumMerklIncentiveApy(data, ctx.tydroPointToUsdRate, { whitelistMerklCampaignIds: ctx.whitelistMerklCampaignIds, forecastStates: ctx.forecastStates, campaignAccessStatuses: ctx.campaignAccessStatuses, crossReserveNetEligibleUsd: ctx.walletCrossReserveNetEligibleUsd, merklGroupMultiplier: ctx.walletMerklGroupMul, pointRateMap: ctx.pointRateMap, positionUsd: ctx.walletPositionUsd, tokenPrice: ctx.tokenPrice, decimals: ctx.decimals })
          : sumMerklIncentiveApr(data, ctx.tydroPointToUsdRate, { whitelistMerklCampaignIds: ctx.whitelistMerklCampaignIds, forecastStates: ctx.forecastStates, campaignAccessStatuses: ctx.campaignAccessStatuses, crossReserveNetEligibleUsd: ctx.walletCrossReserveNetEligibleUsd, merklGroupMultiplier: ctx.walletMerklGroupMul, pointRateMap: ctx.pointRateMap, positionUsd: ctx.walletPositionUsd, tokenPrice: ctx.tokenPrice, decimals: ctx.decimals }),
      sumAfter: (data, ctx) => {
        const forecasted = buildForecastMerklOpportunities({
          opportunities: data, inputUsd: ctx.meritMerklInputUsd,
          forecastStates: ctx.forecastStates, whitelistMerklCampaignIds: ctx.whitelistMerklCampaignIds,
          tydroPointToUsdRate: ctx.tydroPointToUsdRate, pointRateMap: ctx.pointRateMap,
        });
        return ctx.isApy
          ? sumMerklIncentiveApy(forecasted, ctx.tydroPointToUsdRate, { whitelistMerklCampaignIds: ctx.whitelistMerklCampaignIds, campaignAccessStatuses: ctx.campaignAccessStatuses, crossReserveNetEligibleUsd: ctx.crossReserveNetEligibleUsd, merklGroupMultiplier: ctx.merklGroupMul, pointRateMap: ctx.pointRateMap, positionUsd: ctx.totalPositionUsd, tokenPrice: ctx.tokenPrice, decimals: ctx.decimals })
          : sumMerklIncentiveApr(forecasted, ctx.tydroPointToUsdRate, { whitelistMerklCampaignIds: ctx.whitelistMerklCampaignIds, campaignAccessStatuses: ctx.campaignAccessStatuses, crossReserveNetEligibleUsd: ctx.crossReserveNetEligibleUsd, merklGroupMultiplier: ctx.merklGroupMul, pointRateMap: ctx.pointRateMap, positionUsd: ctx.totalPositionUsd, tokenPrice: ctx.tokenPrice, decimals: ctx.decimals });
      },
      buildDetails: (data, ctx) =>
        buildMerklCampaignDetails({
          opportunities: data,
          isApy: ctx.isApy,
          inputUsd: ctx.meritMerklInputUsd,
          forecastStates: ctx.forecastStates ?? {},
          whitelistMerklCampaignIds: ctx.whitelistMerklCampaignIds,
          tydroPointToUsdRate: ctx.tydroPointToUsdRate,
          shouldComputeAfter: ctx.shouldComputeAfter,
          eligibilityRatio: ctx.eligibilityRatio,
          grossInputUsd: ctx.grossInputUsd,
          merklGroupMultiplier: ctx.merklGroupMul,
          campaignAccessStatuses: ctx.campaignAccessStatuses,
          nativeApyPercent: ctx.nativeApyPercent,
          pointRateMap: ctx.pointRateMap,
          grossForEligibility: ctx.grossForEligibility,
          netForEligibility: ctx.netForEligibility,
          tokenPrice: ctx.tokenPrice,
          decimals: ctx.decimals,
          tokenSymbol: ctx.tokenSymbol,
          walletEligibilityRatio: ctx.walletEligibilityRatio,
          walletMerklGroupMultiplier: ctx.walletMerklGroupMul,
          crossReserveNetEligibleUsd: ctx.crossReserveNetEligibleUsd,
        }),
    },
    brevis: {
      // AAV-1102: sumCurrent must apply wallet position cap dilution to match per-campaign current
      sumCurrent: (data, ctx) => sumForecastBrevisIncentiveApr(data, ctx.isApy, 0, undefined, ctx.forecastStates, ctx.walletPositionUsd),
      sumAfter: (data, ctx) =>
        sumForecastBrevisIncentiveApr(data, ctx.isApy, ctx.grossInputUsd, ctx.brevisSharedDeposits, ctx.forecastStates, ctx.totalPositionUsd),
      buildDetails: (data, ctx) =>
        buildBrevisCampaignDetails({
          items: data,
          isApy: ctx.isApy,
          inputUsd: ctx.grossInputUsd,
          sharedDepositsByCampaignId: ctx.brevisSharedDeposits,
          shouldComputeAfter: ctx.hasAnyScenarioInput,
          forecastStates: ctx.forecastStates,
          totalPositionUsd: ctx.totalPositionUsd,
          walletPositionUsd: ctx.walletPositionUsd,
        }),
    },
  };

  const lanes: Partial<Record<RateSide, SimulationLane>> = {};
  const afterIncentiveAprBySide: Partial<Record<RateSide, number | null>> = {};
  // AAV-1112: Store currentTotal per side for spread calculation after the loop.
  const currentTotalBySide: Partial<Record<RateSide, number | null>> = {};

  for (const side of ['supply', 'borrow'] as const) {
    const isSupply = side === 'supply';
    const blocked = isSupply ? supplyBlocked : borrowBlocked;
    const sideHasInput = isSupply ? hasSupplyInput : hasBorrowInput;

    const currentData = getIncentiveSources(reserve, side);

    const ctx: SideSourceContext = {
      isApy,
      shouldComputeAfter: sideHasInput || portfolioScenarioActive,
      hasAnyScenarioInput: hasAnyInput || portfolioScenarioActive,
      meritMerklInputUsd: isSupply ? supplyMeritMerklInputUsd : borrowMeritMerklInputUsd,
      grossInputUsd: isSupply ? supplyInputUsd : borrowInputUsd,
      eligibilityRatio: isSupply ? supplyMeritMerklEligibilityRatio : borrowMeritMerklEligibilityRatio,
      walletEligibilityRatio: isSupply ? walletSupplyMeritMerklEligibilityRatio : walletBorrowMeritMerklEligibilityRatio,
      grossForEligibility: isSupply ? supplyGrossForEligibility : borrowGrossForEligibility,
      netForEligibility: isSupply ? supplyNetForEligibility : borrowNetForEligibility,
      totalPositionUsd: isSupply ? totalSupplyUsd : totalBorrowUsd,
      anchorTvlUsd: getMeritAnchorTvlUsd(reserve, side, getProtocolVersion(reserve.marketName), hubSupplied ?? reserveRateInput?.hubSupplied, hubBorrowed ?? reserveRateInput?.hubBorrowed),
      forecastStates,
      whitelistMerklCampaignIds,
      tydroPointToUsdRate,
      merklGroupMul: merklGroupMultiplier(side),
      walletMerklGroupMul: walletMerklGroupMultiplier(side),
      crossReserveNetEligibleUsd: crossReserveNetEligibleUsdFn(side),
      walletCrossReserveNetEligibleUsd: walletCrossReserveNetEligibleUsdFn(side),
      campaignAccessStatuses,
      nativeApyPercent: isSupply ? (reserve.supplyApy ?? 0) : (reserve.borrowApy ?? 0),
      brevisSharedDeposits: brevisSharedDepositsByCampaignId,
      walletPositionUsd: isSupply ? walletSupplyUsd : walletBorrowUsd,
      pointRateMap,
      tokenPrice: reserve.tokenPrice,
      decimals: reserve.decimals,
      tokenSymbol: reserve.tokenSymbol,
    };

    // Protocol (degenerate case — no after, no campaigns)
    const protocolCurrent = sumNumberArray(currentData.protocol, isApy);
    const protocolDetail = attachCampaigns(buildMetric(protocolCurrent, protocolCurrent), []);

    // Merit/Merkl/Brevis (dispatch map) — single source of truth for per-source current
    const sr = {} as Record<SourceKey, { current: number; after: number | null; campaigns: SimulationCampaignDetail[] }>;
    const runSource = <K extends SourceKey>(key: K) => {
      const handler = sourceDispatch[key];
      const data = currentData[key];
      const current = handler.sumCurrent(data, ctx);
      const afterRaw = shouldComputeAfter ? handler.sumAfter(data, ctx) : null;
      const after = afterRaw !== null ? Math.min(afterRaw, current) : null;
      sr[key] = { current, after, campaigns: handler.buildDetails(data, ctx) };
    };
    for (const key of Object.keys(sourceDispatch) as SourceKey[]) {
      runSource(key);
    }

    // AAV-1112: Derive currentIncentive from per-source sum (single code path).
    const currentIncentive = protocolCurrent + sr.merit.current + sr.merkl.current + sr.brevis.current;
    // APR variant for afterIncentiveApr Math.min cap.
    // When isApy=true, sr[key].current is in APY — we need APR for the Math.min cap.
    // Run a lightweight APR pass through the same dispatch map.
    const currentIncentiveApr = isApy
      ? (() => {
          const aprCtx = { ...ctx, isApy: false };
          const aprProtocol = sumNumberArray(currentData.protocol, false);
          const aprMerit = sourceDispatch.merit.sumCurrent(currentData.merit, aprCtx);
          const aprMerkl = sourceDispatch.merkl.sumCurrent(currentData.merkl, aprCtx);
          const aprBrevis = sourceDispatch.brevis.sumCurrent(currentData.brevis, aprCtx);
          return aprProtocol + aprMerit + aprMerkl + aprBrevis;
        })()
      : currentIncentive; // already APR when isApy=false

    // AAV-1113: Derive afterIncentive from per-source sum (single code path).
    // Per-source after already has Math.min(afterRaw, current) applied in the dispatch map loop.
    // No aggregate Math.min needed — per-source cap is the correct semantics.
    // This eliminates the buildIncentiveAfter independent path that could diverge from per-source sum.
    const afterIncentive = !blocked && shouldComputeAfter
      ? protocolCurrent + sr.merit.after + sr.merkl.after + sr.brevis.after
      : null;
    // APR variant: when isApy=true, run a lightweight APR pass for afterIncentiveApr.
    const afterIncentiveApr = !blocked && shouldComputeAfter
      ? (isApy
        ? (() => {
            const aprCtx = { ...ctx, isApy: false };
            const aprProtocol = sumNumberArray(currentData.protocol, false);
            const aprMeritAfter = shouldComputeAfter ? sourceDispatch.merit.sumAfter(currentData.merit, aprCtx) : null;
            const aprMerklAfter = shouldComputeAfter ? sourceDispatch.merkl.sumAfter(currentData.merkl, aprCtx) : null;
            const aprBrevisAfter = shouldComputeAfter ? sourceDispatch.brevis.sumAfter(currentData.brevis, aprCtx) : null;
            const aprMeritCurrent = sourceDispatch.merit.sumCurrent(currentData.merit, aprCtx);
            const aprMerklCurrent = sourceDispatch.merkl.sumCurrent(currentData.merkl, aprCtx);
            const aprBrevisCurrent = sourceDispatch.brevis.sumCurrent(currentData.brevis, aprCtx);
            return aprProtocol
              + (aprMeritAfter !== null ? Math.min(aprMeritAfter, aprMeritCurrent) : 0)
              + (aprMerklAfter !== null ? Math.min(aprMerklAfter, aprMerklCurrent) : 0)
              + (aprBrevisAfter !== null ? Math.min(aprBrevisAfter, aprBrevisCurrent) : 0);
          })()
        : afterIncentive)
      : null;
    afterIncentiveAprBySide[side] = afterIncentiveApr;

    const afterNative = blocked ? null : (isSupply ? supplyAfterNative : borrowAfterNative);
    const currentNative = isSupply ? supplyCurrentNative : borrowCurrentNative;
    const headlineIncentive = isSupply ? supplyHeadlineIncentive : borrowHeadlineIncentive;
    const currentTotal = isApy
      ? (isSupply ? calculateTotalSupplyApy(currentNative ?? 0, currentIncentive) : calculateTotalBorrowApy(currentNative ?? 0, currentIncentive))
      : (isSupply ? calculateTotalSupplyApr(currentNative ?? 0, currentIncentive) : calculateTotalBorrowApr(currentNative ?? 0, currentIncentive));
    currentTotalBySide[side] = currentTotal;

    const afterTotal = blocked ? null : (shouldComputeAfter && afterNative !== null && afterIncentive !== null
      ? (isApy
        ? (isSupply ? calculateTotalSupplyApy(afterNative, afterIncentive) : calculateTotalBorrowApy(afterNative, afterIncentive))
        : (isSupply ? calculateTotalSupplyApr(afterNative, afterIncentive) : calculateTotalBorrowApr(afterNative, afterIncentive)))
      : null);

    const meritOffsetNote = ctx.netForEligibility != null && ctx.grossForEligibility > 0 && ctx.netForEligibility < ctx.grossForEligibility
      ? [netEligibleToNote(buildNetEligibleNote(ctx.netForEligibility, ctx.grossForEligibility)!)]
      : undefined;
    const merklNetNote = ctx.netForEligibility != null && ctx.grossForEligibility > 0 && ctx.netForEligibility < ctx.grossForEligibility
      ? netEligibleToNote(buildNetEligibleNote(ctx.netForEligibility, ctx.grossForEligibility)!)
      : undefined;
    const firstMerklOpp = (currentData.merkl as MerklOpportunityGroup[] | undefined)?.[0];
    const merklCrossNote = firstMerklOpp ? merklCrossReserveNote(side)(firstMerklOpp) : null;
    const merklOffsetNote = merklCrossNote ? [netEligibleToNote(merklCrossNote)] : merklNetNote ? [merklNetNote] : undefined;

    lanes[side] = {
      hasInput: blocked ? false : sideHasInput,
      inputAmount: blocked ? 0 : (isSupply ? supplyAmount : borrowAmount),
      inputUsd: blocked ? 0 : (isSupply ? supplyInputUsd : borrowInputUsd),
      currentNative,
      currentIncentive,
      currentTotal,
      headlineIncentive,
      afterNative,
      afterIncentive,
      afterTotal,
      deltaNative: blocked ? null : (afterNative !== null && currentNative !== null ? afterNative - currentNative : null),
      deltaIncentive: blocked ? null : (afterIncentive !== null && currentIncentive !== null ? afterIncentive - currentIncentive : null),
      deltaTotal: blocked ? null : (afterTotal !== null && currentTotal !== null ? afterTotal - currentTotal : null),
      sources: {
        protocol: protocolDetail,
        merit: attachCampaigns(buildMetric(sr.merit.current, sr.merit.after), sr.merit.campaigns, meritOffsetNote),
        merkl: attachCampaigns(buildMetric(sr.merkl.current, sr.merkl.after), sr.merkl.campaigns, merklOffsetNote),
        brevis: attachCampaigns(buildMetric(sr.brevis.current, sr.brevis.after), sr.brevis.campaigns),
      },
    };
  }

  const supplyLane = lanes.supply!;
  const borrowLane = lanes.borrow!;
  const effectiveSupplyPrincipalUsd = totalSupplyUsd ?? supplyLane.inputUsd;
  const effectiveBorrowPrincipalUsd = totalBorrowUsd ?? borrowLane.inputUsd;

  const supplyUsdAccrualSide =
    supplyLane.hasInput && effectiveSupplyPrincipalUsd > 0
      ? buildSupplyUsdAccrualSide(
          effectiveSupplyPrincipalUsd,
          combinedNativeSimulation?.supplyAprPercent ?? null,
          afterIncentiveAprBySide.supply ?? null
        )
      : null;
  const borrowUsdAccrualSide =
    borrowLane.hasInput && effectiveBorrowPrincipalUsd > 0
      ? buildBorrowUsdAccrualSide(
          effectiveBorrowPrincipalUsd,
          combinedNativeSimulation?.borrowAprPercent ?? null,
          afterIncentiveAprBySide.borrow ?? null
        )
      : null;

  let scenarioNetUsdPerDay: number | null = null;
  if (
    supplyUsdAccrualSide?.totalUsdPerDay != null ||
    borrowUsdAccrualSide?.totalUsdPerDay != null
  ) {
    scenarioNetUsdPerDay =
      (supplyUsdAccrualSide?.totalUsdPerDay ?? 0) + (borrowUsdAccrualSide?.totalUsdPerDay ?? 0);
  }

  const scenarioUsdAccrual: ScenarioUsdAccrual | null =
    supplyUsdAccrualSide || borrowUsdAccrualSide
      ? {
          supply: supplyUsdAccrualSide,
          borrow: borrowUsdAccrualSide,
          netUsdPerDay: scenarioNetUsdPerDay,
        }
      : null;

  // ─── A 类字段: spread/utilization current (不随 simulation input 变化) ───

const spreadCurrent =
currentTotalBySide.supply != null && currentTotalBySide.borrow != null
? currentTotalBySide.supply - currentTotalBySide.borrow
: null;
  // ─── B 类字段: spread/utilization after/delta (随 simulation input 变化) ───

  const spreadAfter =
    supplyLane.afterTotal !== null && borrowLane.afterTotal !== null ? supplyLane.afterTotal - borrowLane.afterTotal : null;
  const spreadDelta = spreadAfter !== null && spreadCurrent !== null ? spreadAfter - spreadCurrent : null;

  const utilizationCurrent = currentNativeSimulation?.utilizationRatePercent ?? reserve.utilizationPct ?? null;
  const utilizationAfter = combinedNativeSimulation?.utilizationRatePercent ?? null;
  const utilizationOptimal = currentNativeSimulation?.optimalUtilizationPercent ?? reserve.optimalUtilization ?? null;
  const forecastUnavailableCampaignCount = countForecastUnavailable(supplyLane.sources.merkl.campaigns ?? [])
    + countForecastUnavailable(supplyLane.sources.brevis.campaigns ?? [])
    + countForecastUnavailable(borrowLane.sources.merkl.campaigns ?? [])
    + countForecastUnavailable(borrowLane.sources.brevis.campaigns ?? []);

  const deriveTotalBorrowedUsd = (
    reserveSizeUsd: number | null | undefined,
    utilizationPct: number | null | undefined,
  ): number | null => {
    if (
      reserveSizeUsd == null || utilizationPct == null ||
      !Number.isFinite(reserveSizeUsd) || !Number.isFinite(utilizationPct)
    ) return null;
    return reserveSizeUsd * (utilizationPct / 100);
  };

  const deriveAvailableLiquidityUsd = (
    reserveSizeUsd: number | null | undefined,
    totalBorrowedUsd: number | null | undefined,
  ): number | null => {
    if (
      reserveSizeUsd == null || totalBorrowedUsd == null ||
      !Number.isFinite(reserveSizeUsd) || !Number.isFinite(totalBorrowedUsd)
    ) return null;
    return reserveSizeUsd - totalBorrowedUsd;
  };

  const computeMarketMetrics = (): MarketMetrics => {
    // Use raw input values to determine if caps are exceeded (for warnings)
    // But use capped values for actual calculations (supplyInputUsd, borrowInputUsd are already capped)

    // ─── A 类字段 helpers: Current Snapshot (不随 simulation input 变化) ───

    const computeSupplyCapFields = () => {
      if (supplyCapUsd === null || supplyCapUsd <= 0) {
        return {
          availableSupplyRoomUsd: null,
          supplyCapExceeded: false,
          supplyCapExceededByUsd: null,
        };
      }
      // Use raw input to check if exceeded (only when user entered scenario supply).
      // On-chain reserve can already be above cap; without a scenario amount we do not warn.
      const rawAfterSizeUsd =
        currentReserveSizeUsd !== null ? currentReserveSizeUsd + rawSupplyInputUsd : null;
      const exceeded =
        rawSupplyInputUsd > 0 &&
        rawAfterSizeUsd !== null &&
        rawAfterSizeUsd > supplyCapUsd;
      const exceededBy = exceeded ? rawAfterSizeUsd - supplyCapUsd : null;
      return {
        availableSupplyRoomUsd: availableSupplyRoomUsd,
        supplyCapExceeded: exceeded,
        supplyCapExceededByUsd: exceededBy,
      };
    };

    const computeBorrowCapFields = (totalBorrowedUsdBase: number | null) => {
      // Available borrow room considers both liquidity and cap
      // Check if user input exceeds available room
      const exceeded = availableBorrowRoomUsd !== null && rawBorrowInputUsd > availableBorrowRoomUsd;
      const exceededBy = exceeded ? rawBorrowInputUsd - availableBorrowRoomUsd : null;
      
      return {
        availableBorrowRoomUsd,
        borrowCapExceeded: exceeded,
        borrowCapExceededByUsd: exceededBy,
        borrowLimitedByLiquidity,
      };
    };

    // ─── Fallback 分支: 无 reserveRateInput 时，A 类有值，B 类为 null ───

    if (!reserveRateInput || !tokenPrice) {
      const protocolVersion = getProtocolVersion(reserve.marketName);
      const isV3 = protocolVersion === 'v3';
      const computedReserveSizeUsd = nativeToUsd(reserve.supplied, reserve.decimals, reserve.tokenPrice);
      const fallbackTotalBorrowedUsd = isV3
        ? deriveTotalBorrowedUsd(computedReserveSizeUsd, reserve.utilizationPct)
        : null;
      const fallbackAvailableLiquidityUsd = isV3
        ? deriveAvailableLiquidityUsd(computedReserveSizeUsd, fallbackTotalBorrowedUsd)
        : null;
      const supplyCapFields = computeSupplyCapFields();
      const borrowCapFields = computeBorrowCapFields(fallbackTotalBorrowedUsd);
      return {
        // ─── A 类字段: Current Snapshot ───
        availableLiquidityUsd: fallbackAvailableLiquidityUsd,
        totalBorrowedUsd: fallbackTotalBorrowedUsd,
        supplyCapUsd,
        borrowCapUsd,
        protocolFee: reserve.protocolFee ?? null,
        optimalUtilization: reserve.optimalUtilization ?? null,
        // ─── B 类字段: After/Delta (无模拟 → null) ───
        availableLiquidityUsdAfter: null,
        availableLiquidityUsdDelta: null,
        totalBorrowedUsdAfter: null,
        totalBorrowedUsdDelta: null,
        ...supplyCapFields,
        ...borrowCapFields,
      };
    }

    // ─── A 类字段: On-chain current snapshot (有 fallback) ───

    const decimals = reserveRateInput.decimals ?? DEFAULT_TOKEN_DECIMALS;
    const scale = Math.pow(10, decimals);

    const liquidityRaw = Number(reserveRateInput.liquidity) / scale;
    const onChainAvailableLiquidityUsd = liquidityRaw * tokenPrice;

    const totalBorrowedRaw = Number(reserveRateInput.borrowed) / scale;
    const onChainTotalBorrowedUsd = totalBorrowedRaw * tokenPrice;

    const protocolVersion = getProtocolVersion(reserve.marketName);
    const isV3 = protocolVersion === 'v3';
    const computedReserveSizeUsd2 = nativeToUsd(reserve.supplied, reserve.decimals, reserve.tokenPrice);

    const totalBorrowedUsd =
      Number.isFinite(onChainTotalBorrowedUsd) && onChainTotalBorrowedUsd >= 0
        ? onChainTotalBorrowedUsd
        : isV3
          ? deriveTotalBorrowedUsd(computedReserveSizeUsd2, reserve.utilizationPct)
          : null;

    const availableLiquidityUsd =
      Number.isFinite(onChainAvailableLiquidityUsd) && onChainAvailableLiquidityUsd >= 0
        ? onChainAvailableLiquidityUsd
        : isV3
          ? deriveAvailableLiquidityUsd(computedReserveSizeUsd2, totalBorrowedUsd)
          : null;

    const protocolFee = Number.isFinite(reserveRateInput.protocolFee) && reserveRateInput.protocolFee >= 0
      ? reserveRateInput.protocolFee
      : reserve.protocolFee ?? 0;
    const optimalUtilization = Number.isFinite(reserveRateInput.optimalUtilization) && reserveRateInput.optimalUtilization >= 0
      ? reserveRateInput.optimalUtilization
      : reserve.optimalUtilization ?? null;

    // ─── B 类字段: After/Delta (随 simulation input 变化, 无模拟 → null) ───

    // Use capped inputs for after values (supplyInputUsd and borrowInputUsd are already capped)
    const availableLiquidityUsdAfter = hasAnyInput
      ? availableLiquidityUsd + effectiveSupplyInputUsd - borrowInputUsd
      : null;
    const totalBorrowedUsdAfter = (hasAnyInput && !borrowBlocked)
      ? totalBorrowedUsd + borrowInputUsd
      : null;

    const supplyCapFields = computeSupplyCapFields();
    const borrowCapFields = computeBorrowCapFields(totalBorrowedUsd);

    return {
      // ─── A 类字段: Current Snapshot ───
      availableLiquidityUsd,
      totalBorrowedUsd,
      supplyCapUsd,
      borrowCapUsd,
      protocolFee,
      optimalUtilization,
      // ─── B 类字段: After/Delta (hasAnyInput → 有值, 否则 null) ───
      availableLiquidityUsdAfter,
      availableLiquidityUsdDelta: availableLiquidityUsdAfter !== null
        ? availableLiquidityUsdAfter - availableLiquidityUsd
        : null,
      totalBorrowedUsdAfter,
      totalBorrowedUsdDelta: totalBorrowedUsdAfter !== null
        ? totalBorrowedUsdAfter - totalBorrowedUsd
        : null,
      ...supplyCapFields,
      ...borrowCapFields,
    };
  };

  const marketMetrics = computeMarketMetrics();

  return {
    // ─── A 类字段: Current Snapshot ───
    tokenPrice,
    supply: supplyLane,
    borrow: borrowLane,
    spread: {
      // ─── A 类: current ───
      current: spreadCurrent,
      // ─── B 类: after/delta ───
      after: spreadAfter,
      delta: spreadDelta,
      usesCurrentSide: null,
    },
    utilization: {
      // ─── A 类: current/optimal ───
      current: utilizationCurrent,
      optimal: utilizationOptimal,
      // ─── B 类: after/delta ───
      after: utilizationAfter,
      delta:
        utilizationCurrent !== null && utilizationAfter !== null
          ? utilizationAfter - utilizationCurrent
          : null,
    },
    marketMetrics,
    // ─── B 类字段: Scenario-only (无模拟 → null) ───
    forecastUnavailableCampaignCount,
    scenarioUsdAccrual,
  };
}

export const buildEmptyRateSimulationResult = (
  reserve: ReserveWithSpread,
  params: Omit<BuildRateSimulationResultParams, 'reserve'>
): RateSimulationResult => ({
  ...buildRateSimulationResult({
    reserve,
    ...params,
  }),
  tokenPriceLoading: false,
  forecastLoading: false,
  forecastErrors: {},
});

// Stable empty references shared across no-op renders so consumer useMemos
// do not re-run when nothing material changed.
export const EMPTY_PRICE_LOADING_LIST: readonly boolean[] = Object.freeze([]) as readonly boolean[];

/**
 * Build a stable structural signature for the price values returned by
 * `useQueries`. JSON.stringify (over a normalized array) is used instead of
 * a delimiter join to eliminate any theoretical ambiguity in this
 * financial-display path b— e.g. avoiding "[1, 23] vs [12, 3]" collisions
 * if the price type ever broadens beyond `number|null`.
 *
 * Exported for unit tests; `priceDataKey` consumers should treat the result
 * as opaque.
 */
export const buildPriceDataSignature = (
  prices: ReadonlyArray<{ data?: number | null }>,
): string =>
  JSON.stringify(prices.map((q) => (q.data == null ? null : q.data)));

/**
 * Build a stable structural signature for the loading state of the price
 * queries. When `needsTokenPrice` is false, no consumer reads the loading
 * map, so we collapse to an empty signature for ref stability.
 *
 * Exported for unit tests.
 */
export const buildPriceLoadingSignature = (
  prices: ReadonlyArray<{ isPending?: boolean; isFetching?: boolean }>,
  needsTokenPrice: boolean,
): string =>
  JSON.stringify(
    needsTokenPrice
      ? prices.map((q) => Boolean(q.isPending || q.isFetching))
      : EMPTY_PRICE_LOADING_LIST,
  );
