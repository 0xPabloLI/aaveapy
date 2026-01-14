// Merit incentive data structure
export interface MeritIncentive {
  apr: number;                         // APR 百分比值（如 5.2 表示 5.2%）
  selfApr?: number;                    // Self APR 百分比值（如果有对应的 self- 前缀的 key）
  link: string;                        // Merit 活动详情页链接
  startDate: string;                   // 活动开始日期
  endDate: string;                     // 活动结束日期
  requiredBorrowTokens?: string[];      // 需要 borrow 的 token 列表（用于 supply with borrow requirement），'multiple' 表示任意 token
  requiredSupplyTokens?: string[];      // 需要 supply 的 token 列表（用于 borrow with supply requirement），'multiple' 表示任意 token
}

// Merkl opportunity data structure
export interface MerklCampaignBreakdown {
  campaignApr: number;                 // 活动 APR（百分比数值）
  campaignStartedAt: string;           // 活动开始时间（ISO 8601）
  campaignEndedAt: string;             // 活动结束时间（ISO 8601）
  campaignId: string;                 // 活动 ID
  pointsPerThousandUsd?: number;       // Tydro 协议的 points/1000USD 值（可选）
  dailyPoints?: number;                // Tydro 协议的每日 points（可选）
}

export interface MerklOpportunityGroup {
  opportunityLink: string;            // Opportunity 详情页链接
  breakdowns: MerklCampaignBreakdown[]; // 该 opportunity 的所有 breakdowns
}

export interface PoolWithSpread {
  // 基础信息
  marketName: string;
  chainName: string;
  chainId: number;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  aTokenAddress?: string | null;
  vTokenAddress?: string | null;
  
  // 基础 APY（百分比数值，如 2.07 表示 2.07%）
  supplyApy?: number;
  borrowApy?: number;
  
  // 协议激励（来自 Aave 协议，百分比数值数组）
  supplyIncentives?: number[];
  borrowIncentives?: number[];
  
  // Merit APR 激励（对象数组，包含完整的活动信息）
  meritSupplys?: MeritIncentive[];
  meritBorrows?: MeritIncentive[];
  
  // Merkl 详细机会数据
  merklSupplys?: MerklOpportunityGroup[];
  merklBorrows?: MerklOpportunityGroup[];
  merklHolds?: MerklOpportunityGroup[];
  
  // Brevis APR 激励（百分比数值）
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
