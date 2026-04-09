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

export interface CampaignGroup<TBreakdown extends BaseCampaignBreakdown = BaseCampaignBreakdown> {
  link?: string;
  name?: string;
  message?: string;
  breakdowns: TBreakdown[];
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
  link: string;                        // Brevis campaign detail link
  breakdowns?: BrevisCampaignBreakdown[]; // Canonical breakdown-level metadata, aligned with Merkl
  campaignApr?: number;                 // Legacy canonical APR fallback
  campaignStartedAt?: string;           // Legacy canonical start time fallback
  campaignEndedAt?: string;             // Legacy canonical end time fallback
  latestTvl?: number;                  // Legacy preferred TVL field
  totalBudget?: number;                // Legacy preferred total budget field
  perUserRewardCapUsd?: number;        // Legacy per-user cumulative reward ceiling
  campaignId?: string;                 // Legacy shared campaign id fallback
}

export interface ReserveWithSpread {
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
  
  // Base APY (percentage value, e.g., 2.07 means 2.07%)
  supplyApy?: number;
  borrowApy?: number;
  tokenPrice?: number;
  reserveSizeUsd?: number;
  supplyCapUsd?: number;
  borrowCapUsd?: number;
  utilizationPct?: number;
  
  // Availability flags
  supplyDisabled?: boolean;
  borrowDisabled?: boolean;
  
  // Rate calculation fields (from /api/markets reserves)
  decimals?: number;
  availableLiquidity?: string;
  totalVariableDebt?: string;
  reserveFactor?: string;
  variableRateSlope1?: string;
  variableRateSlope2?: string;
  optimalUsageRate?: string;
  deficit?: string;
  baseVariableBorrowRate?: string;

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

}

export interface MarketsResponse {
  snapshot: {
    lastUpdated: string;
    version?: string;
    staleTimeMs?: number;
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
export interface MerklForecastWireItem {
  campaignId: string;
  requiredDaily?: number;
  distributedSoFar?: number;
  endTimestamp?: number;
}

export interface MerklForecastStatesBatchResponse {
  requested?: number;
  staleTimeMs?: number;
  items: MerklForecastWireItem[];
  errors: Array<{
    campaignId: string;
    status?: number;
    message: string;
  }>;
}

export type SortField = 'totalSupplyApy' | 'totalBorrowApy' | 'apySpread' | null;
export type SortOrder = 'asc' | 'desc';
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
