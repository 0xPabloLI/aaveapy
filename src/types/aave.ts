export type IncentiveMessageScalar = string | number | boolean | null;
export type IncentiveMessage = string | IncentiveMessage[] | {
  [key: string]: IncentiveMessageScalar | IncentiveMessage;
};

// Merit incentive data structure
export interface MeritIncentive {
  apr: number;                         // APR percentage value (e.g., 5.2 means 5.2%)
  selfApr?: number;                    // Self APR percentage value (if there's a corresponding self- prefixed key)
  link: string;                        // Merit campaign detail page link
  name?: string;                       // Merit campaign name (optional)
  message?: IncentiveMessage;          // Merit campaign message/description (optional)
  startDate: string;                   // Campaign start date
  endDate: string;                     // Campaign end date
  lastRoundRewardUsd?: number;         // Latest round total reward in USD
}

export interface BaseCampaignBreakdown {
  campaignApr: number;
  campaignStartedAt: string;
  campaignEndedAt: string;
  campaignId?: string;
}

export interface NetPositionConstraint {
  sourceSide: 'supply' | 'borrow';
  offsetReserveIds: string[];
}

export interface CampaignGroup<TBreakdown extends BaseCampaignBreakdown = BaseCampaignBreakdown> {
  link?: string;
  name?: string;
  message?: string;
  breakdowns: TBreakdown[];
  opportunityType?: string; // Kept: high debug value (aav_68_plan.md); future Ethena looping needs it
  netPositionConstraint?: NetPositionConstraint | null;
}

// Merkl opportunity data structure
export interface MerklCampaignBreakdown extends BaseCampaignBreakdown {
  campaignId: string;                 // Campaign ID
  whitelistOnly?: boolean;             // Merkl campaign is whitelist-only
  pointsPerThousandUsd?: number;       // Tydro protocol points/1000USD value (optional)
  campaignType?: string;
  totalBudget?: number;
  /** Max APR cap from API as percent points (e.g. 3.2 means 3.2%), same unit as `campaignApr`. */
  aprCap?: number | null;
  latestTvl?: number;
  plannedDaily?: number;
}

export type MerklOpportunityGroup = CampaignGroup<MerklCampaignBreakdown>;

export interface BrevisCampaignBreakdown extends BaseCampaignBreakdown {
  latestTvl?: number;
  totalBudget?: number;
  perUserRewardCapUsd?: number;
}

export interface BrevisIncentive extends Omit<CampaignGroup<BrevisCampaignBreakdown>, 'breakdowns' | 'link'> {
  link: string;
  breakdowns?: BrevisCampaignBreakdown[];
  campaignApr?: number;
  campaignStartedAt?: string;
  campaignEndedAt?: string;
  latestTvl?: number;
  totalBudget?: number;
  perUserRewardCapUsd?: number;
  campaignId?: string;
}

/**
 * Compile-time ban for reserve-derived USD fields.
 *
 * The backend NO LONGER returns precomputed `*Usd` fields on reserves
 * (e.g. `reserveSizeUsd`, `totalBorrowedUsd`, `availableLiquidityUsd`,
 * `totalSuppliedUsd`, `borrowedUsd`, `suppliableUsd`, `borrowableUsd`).
 *
 * All USD values MUST be derived in the frontend through the canonical
 * helpers in `src/lib/scenarioSize.ts`:
 *   - `nativeToUsd(raw, decimals, tokenPrice)` — base primitive
 *   - `getDisplayReserveSizeUsd` / `getDisplayTotalBorrowedUsd` /
 *     `getDisplayAvailableLiquidityUsd` — V4-aware display values
 *   - `getSuppliableUsd` / `getBorrowableUsd` / `getAvailableToBorrowUsd`
 *   - `getReserveTvlUsd` (for portfolio search)
 *
 * Each banned key is typed as `never` so any access like
 * `reserve.reserveSizeUsd` produces a TypeScript error and the build
 * fails at the compile step. Do NOT remove without team review.
 */
export type BannedReserveUsdFields = {
  reserveSizeUsd?: never;
  totalSuppliedUsd?: never;
  totalBorrowedUsd?: never;
  borrowedUsd?: never;
  availableLiquidityUsd?: never;
  suppliableUsd?: never;
  borrowableUsd?: never;
  supplyCapUsd?: never;
  borrowCapUsd?: never;
};

export interface ReserveWithSpread extends BannedReserveUsdFields {
  // Basic information
  marketName: string;
  chainName: string;
  chainId: number;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  aTokenAddress?: string | null;
  vTokenAddress?: string | null;
  /** Canonical backend reserve key. */
  reserveId: string;
  /** V4 SDK ReserveId for pro.aave.com deep-links. */
  aaveProReserveId?: string;
  
  // Base APY (percentage value, e.g., 2.07 means 2.07%)
  supplyApy?: number;
  borrowApy?: number;
  tokenPrice?: number;
  utilizationPct?: number;
  
  // Availability flags
  supplyDisabled?: boolean;
  borrowDisabled?: boolean;
  isFrozen?: boolean;
  isPaused?: boolean;
  /** V4 only: false when status.active is false. Absent = active (V3 / V4 normal). */
  isActive?: false;
  
  
  // Rate calculation fields (from /api/markets reserves)
  decimals?: number;
  supplied?: string;
  borrowed?: string;
  liquidity?: string;
  supplyCap?: string;
  borrowCap?: string;
  suppliable?: string;
  borrowable?: string;
  // Rate-model fields are percent numbers (e.g., 9 means 9%) for V3/V4 unified API.
  protocolFee?: number;
  slopeBelowOptimal?: number;
  slopeAboveOptimal?: number;
  optimalUtilization?: number;
  deficit?: string;
  baseBorrowRate?: number;

  // Protocol incentives (from Aave protocol, array of percentage values)
  supplyIncentives?: number[];
  borrowIncentives?: number[];
  
  // Merit APR incentives (array of objects containing complete campaign information)
  meritSupplys?: MeritIncentive[];
  meritBorrows?: MeritIncentive[];
  
  // Merkl detailed opportunity data
  merklSupplys?: MerklOpportunityGroup[];
  merklBorrows?: MerklOpportunityGroup[];
  merklHolds?: MerklOpportunityGroup[];
  
  // Brevis APR incentives (array of objects)
  brevisSupplys?: BrevisIncentive[];
  brevisBorrows?: BrevisIncentive[];

  // V4 Hub & Spoke addresses for contract interaction (only present for V4 markets)
  hubId?: string;
  hubName?: string;
  hubAddress?: string;
  /** Kept: future spoke detail page needs spoke identity. */
  spokeId?: string;
  spokeAddress?: string;

}

export interface MarketsResponse {
  snapshot: {
    lastUpdated: string;
    version?: string;
    staleTimeMs?: number;
    /** Kept: frontend uses hardcoded SCHEMA_FP for cache invalidation, not this backend value. Mechanism preserved. */
    schemaFingerprint?: string; // Hash of API response field names; changes when shape changes
  };
  reserves: ReserveWithSpread[];
}

export interface MarketListItem {
  marketName: string;
  chainName: string;
}

export interface TokenPriceEntry {
  price: number;
}

export type TokenPricesIndex = Record<string, TokenPriceEntry>;

// Wire contract for forecast side-data endpoints (`/api/campaigns/forecast-states`,
// `/api/meta/side-data.forecast.items`). Opportunity/static fields still come
// from the markets breakdowns and are merged in the frontend view model.
export type MerklForecastWireItem =
  | {
      campaignId: string;
      requiredDaily: number;
      distributedSoFar: number;
      endTimestamp: number;
    }
  | {
      campaignId: string;
      requiredDaily?: undefined;
      distributedSoFar: number;
      endTimestamp: number;
    };

// Campaign access — Merkl whitelist/blacklist per campaign (AAV-66).
// Embedded in side-data response; consumed by useCampaignAccess() gated on wallet connection.
export interface CampaignAccessEntry {
  chainId: number;
  whitelist: string[];
  blacklist: string[];
}

export interface CampaignAccessPayload {
  campaigns: Record<string, CampaignAccessEntry>;
  updatedAt: string;
}

export type SortField = 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null;
export type TokenCategory = 'stablecoin' | 'eth-related' | 'btc-related' | 'pendle' | 'all';

export const STABLECOINS = [
  'USDC',
  'USDT',
  'USD₮',
  'USD₮0',
  'USDG',
  'DAI',
  'FRAX',
  'LUSD',
  'PYUSD',
  'GHO',
  'CRVUSD',
  'USDS',
  'SUSDE',
  'USDE',
  'EURC',
  'USDBC',
  'RLUSD',
  'SDAI',
  'USDC.E',
  'EURE',
  'XDAI',
  'WXDAI',
];
export const ETH_RELATED = [
  'ETH',
  'WETH',
  'WETH.E',
  'STETH',
  'WSTETH',
  'CBETH',
  'WEETH',
  'EZETH',
  'WRSETH',
  'RSETH',
  'OSETH',
  'RETH',
  'ETHX',
];
export const BTC_RELATED = ['BTC', 'CBBTC', 'WBTC', 'LBTC', 'TBTC', 'EBTC'];
export const PENDLE_TOKENS = ['PT-', 'YT-', 'SY-'];

export const ETHEREUM_MARKET_NAMES: Record<string, string> = {
  'AaveV3Ethereum': 'Core',
  'AaveV3EthereumLido': 'Prime',
  'AaveV3EthereumHorizon': 'Horizon RWA',
  'AaveV3EthereumEtherFi': 'EtherFi',
};
