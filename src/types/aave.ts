// Merit incentive data structure
export interface MeritIncentive {
  apr: number;                         // APR percentage value (e.g., 5.2 means 5.2%)
  selfApr?: number;                    // Self APR percentage value (if there's a corresponding self- prefixed key)
  link: string;                        // Merit campaign detail page link
  name?: string;                       // Merit campaign name (optional)
  message?: string;                    // Merit campaign message/description (optional)
  startDate: string;                   // Campaign start date
  endDate: string;                     // Campaign end date
  startBlock?: string;                 // Campaign start block (optional)
  endBlock?: string;                   // Campaign end block (optional)
  requiredBorrowTokens?: string[] | string; // List of tokens to borrow, 'multiple' means any token
  requiredSupplyTokens?: string[] | string; // List of tokens to supply, 'multiple' means any token
}

// Merkl opportunity data structure
export interface MerklCampaignBreakdown {
  campaignApr: number;                 // Campaign APR (percentage value)
  campaignStartedAt: string;           // Campaign start time (ISO 8601)
  campaignEndedAt: string;             // Campaign end time (ISO 8601)
  campaignId: string;                 // Campaign ID
  pointsPerThousandUsd?: number;       // Tydro protocol points/1000USD value (optional)
  dailyPoints?: number;                // Tydro protocol daily points (optional)
}

export interface MerklOpportunityGroup {
  link?: string;                       // Opportunity detail page link (preferred)
  opportunityLink?: string;            // Backward-compatible link field
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
}

export interface PoolWithSpread {
  // Basic information
  marketName: string;
  chainName: string;
  chainId: number;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  aTokenAddress?: string | null;
  vTokenAddress?: string | null;
  
  // Base APY (percentage value, e.g., 2.07 means 2.07%)
  supplyApy?: number;
  borrowApy?: number;
  
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
  data: PoolWithSpread[];
  lastUpdated: string;
  isStale: boolean;
  updateInProgress: boolean;
}

export interface MarketStats {
  totalPools: number;
  totalChains: number;
  totalTokens: number;
  chains: string[];
}

export interface MarketListItem {
  marketName: string;
  chainName: string;
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
