export interface PoolWithSpread {
  marketName: string;
  chainName: string;
  chainId: number;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  aTokenAddress?: string;
  vTokenAddress?: string;
  supplyApy?: string;
  borrowApy?: string;
  supplyIncentives?: string[];
  borrowIncentives?: string[];
  meritSupplyApr?: string[];
  meritBorrowApr?: string[];
  meritSelfSupply?: string[];
  meritSelfBorrow?: string[];
  meritSupplyWithBorrowRequirement?: Array<{
    apr: string;
    requiredBorrowTokens: string[];
    isSelf?: boolean;
  }>;
  meritBorrowWithSupplyRequirement?: Array<{
    apr: string;
    requiredSupplyTokens: string[];
    isSelf?: boolean;
  }>;
  merklSupplyApr?: number;
  merklBorrowApr?: number;
  merklHoldApr?: number;
  merklSupplyOpportunities?: Array<{
    opportunityLink: string;
    breakdowns: Array<{
      campaignApr: number;
      campaignStartedAt: string;
      campaignEndedAt: string;
      campaignId: string;
      pointsPerThousandUsd?: number;
      dailyPoints?: number;
    }>;
  }>;
  merklBorrowOpportunities?: Array<{
    opportunityLink: string;
    breakdowns: Array<{
      campaignApr: number;
      campaignStartedAt: string;
      campaignEndedAt: string;
      campaignId: string;
      pointsPerThousandUsd?: number;
      dailyPoints?: number;
    }>;
  }>;
  merklHoldOpportunities?: Array<{
    opportunityLink: string;
    breakdowns: Array<{
      campaignApr: number;
      campaignStartedAt: string;
      campaignEndedAt: string;
      campaignId: string;
      pointsPerThousandUsd?: number;
      dailyPoints?: number;
    }>;
  }>;
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
