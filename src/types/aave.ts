// Merit incentive data structure
export interface MeritIncentive {
  apr: number;                         // APR percentage value (e.g., 5.2 means 5.2%)
  selfApr?: number;                    // Self APR percentage value (if there's a corresponding self- prefixed key)
  link: string;                        // Merit campaign detail page link
  startDate: string;                   // Campaign start date
  endDate: string;                     // Campaign end date
  requiredBorrowTokens?: string[];      // List of tokens that need to be borrowed (for supply with borrow requirement), 'multiple' means any token
  requiredSupplyTokens?: string[];      // List of tokens that need to be supplied (for borrow with supply requirement), 'multiple' means any token
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
  opportunityLink: string;            // Opportunity detail page link
  breakdowns: MerklCampaignBreakdown[]; // All breakdowns for this opportunity
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
  
  // Brevis APR incentives (percentage value)
  brevisSupplyApr?: number;
  brevisBorrowApr?: number;
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

export const STABLECOINS = ['USDC', 'USDT', 'DAI', 'FRAX', 'LUSD', 'PYUSD', 'GHO', 'crvUSD', 'USDS', 'sUSDe', 'USDe'];
export const ETH_RELATED = ['WETH', 'ETH', 'stETH', 'wstETH', 'rETH', 'cbETH', 'WETH.e', 'weETH', 'ezETH', 'rsETH', 'osETH'];
export const BTC_RELATED = ['WBTC', 'BTC', 'tBTC', 'cbBTC', 'LBTC', 'eBTC'];
export const PENDLE_TOKENS = ['PT-', 'YT-', 'SY-'];

export const ETHEREUM_MARKET_NAMES: Record<string, string> = {
  'AaveV3Ethereum': 'Core',
  'AaveV3EthereumLido': 'Prime',
  'AaveV3EthereumHorizon': 'Horizon RWA',
  'AaveV3EthereumEtherFi': 'EtherFi',
};
