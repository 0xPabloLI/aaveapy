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

// Merkl opportunity data structure
export interface MerklCampaignBreakdown {
  campaignApr: number;                 // Campaign APR (percentage value)
  campaignStartedAt: string;           // Campaign start time (ISO 8601)
  campaignEndedAt: string;             // Campaign end time (ISO 8601)
  campaignId: string;                 // Campaign ID
  whitelistOnly?: boolean;             // Merkl campaign is whitelist-only
  pointsPerThousandUsd?: number;       // Tydro protocol points/1000USD value (optional)
  campaignType?: string;
  totalBudget?: number;
  aprCap?: number | null;
  latestTvl?: number;
  plannedDaily?: number;
}

export interface MerklOpportunityGroup {
  link?: string;                       // Opportunity detail page link
  name?: string;                       // Opportunity name (optional)
  message?: string;                    // Opportunity message/description (optional)
  breakdowns: MerklCampaignBreakdown[]; // All breakdowns for this opportunity
}

export interface BrevisIncentive {
  apr: number;                         // APR percentage value (e.g., 1.5 means 1.5%)
  link: string;                        // Brevis campaign detail link
  startDate: string;                   // Campaign start date
  endDate: string;                     // Campaign end date
  name: string;                        // Campaign name
  campaignApr?: number;                // Merkl-like aligned APR field
  campaignStartedAt?: string;          // Merkl-like aligned start time
  campaignEndedAt?: string;            // Merkl-like aligned end time
  message?: string;                    // Preferred description/message field
  latestTvl?: number;                  // Preferred TVL field
  totalBudget?: number;                // Preferred total budget field
  perUserRewardCapUsd?: number;        // Per-user cumulative reward ceiling for the campaign (e.g. 5000)
  sharedCapGroupId?: string;           // Campaigns with the same id share a single perUserRewardCapUsd budget
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
  reserveId?: string;
  
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
    version: string;
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

// Metrics-only fields from side-data forecast (10-min refresh).
// Opportunity-only fields (campaignType, totalBudget, aprCap, latestTvl, plannedDaily)
// live on MerklCampaignBreakdown via the markets endpoint (1-min refresh).
export interface MerklForecastStateResponse {
  campaignId: string;
  campaignType?: string;
  plannedDaily?: number;
  requiredDaily?: number;
  aprCap?: number | null;
  totalBudget?: number;
  distributedSoFar?: number;
  latestTvl?: number;
  endTimestamp?: number;
}

export interface MerklForecastStatesBatchResponse {
  requested?: number;
  staleTimeMs?: number;
  items: MerklForecastStateResponse[];
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
