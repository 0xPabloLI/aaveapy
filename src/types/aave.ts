export interface MarketWithSpread {
  marketName: string;
  chainName: string;
  chainId: number;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  supplyApy: string;
  borrowApy: string | null;
  totalSupplyApy: number;
  totalBorrowApy: number | null;
  apySpread: number | null;
  totalIncentiveSupplyApy: number;
  totalIncentiveBorrowApy: number;
  meritSupplyApr?: string[];
  meritBorrowApr?: string[];
  merklSupplyApr?: number;
  merklBorrowApr?: number;
  brevisSupplyApr?: number | null;
  brevisBorrowApr?: number | null;
}

export interface MarketsResponse {
  data: MarketWithSpread[];
  lastUpdated: string;
  isStale: boolean;
  updateInProgress: boolean;
}

export interface MarketStats {
  totalMarkets: number;
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
