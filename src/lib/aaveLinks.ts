const AAVE_APP_BASE = 'https://app.aave.com';

// Map API market names to interface CustomMarket values for reserve overview routing.
const MARKET_NAME_MAP: Record<string, string> = {
  AaveV3Ethereum: 'proto_mainnet_v3',
  AaveV3EthereumLido: 'proto_lido_v3',
  AaveV3EthereumEtherFi: 'proto_etherfi_v3',
  AaveV3EthereumHorizon: 'proto_horizon_v3',
  AaveV3Avalanche: 'proto_avalanche_v3',
  AaveV3Polygon: 'proto_polygon_v3',
  AaveV3Arbitrum: 'proto_arbitrum_v3',
  AaveV3Optimism: 'proto_optimism_v3',
  AaveV3Base: 'proto_base_v3',
  AaveV3Gnosis: 'proto_gnosis_v3',
  AaveV3Metis: 'proto_metis_v3',
  AaveV3BNB: 'proto_bnb_v3',
  AaveV3Scroll: 'proto_scroll_v3',
  AaveV3ZkSync: 'proto_zksync_v3',
  AaveV3Linea: 'proto_linea_v3',
  AaveV3Sonic: 'proto_sonic_v3',
  AaveV3Celo: 'proto_celo_v3',
  AaveV3Soneium: 'proto_soneium_v3',
  AaveV3Plasma: 'proto_plasma_v3',
  AaveV3Ink: 'proto_ink_v3',
  AaveV3InkWhitelabel: 'proto_ink_v3',
  AaveV3Mantle: 'proto_mantle_v3',
  AaveV3MegaEth: 'proto_megaeth_v3',
  AaveV3MegaETH: 'proto_megaeth_v3',
  AaveV2Ethereum: 'proto_mainnet',
  AaveV2Avalanche: 'proto_avalanche',
  AaveV2Polygon: 'proto_polygon',
  AaveV2Fuji: 'proto_fuji',
};

const resolveMarketName = (marketName: string): string | null => {
  if (!marketName) return null;
  if (marketName.startsWith('proto_')) return marketName;
  return MARKET_NAME_MAP[marketName] ?? null;
};

export const buildAaveReserveUrl = (market: {
  marketName: string;
  tokenAddress: string;
}): string | null => {
  const resolvedMarketName = resolveMarketName(market.marketName);
  if (!resolvedMarketName || !market.tokenAddress) return null;

  const underlyingAsset = market.tokenAddress.toLowerCase();
  return `${AAVE_APP_BASE}/reserve-overview/?underlyingAsset=${encodeURIComponent(
    underlyingAsset,
  )}&marketName=${encodeURIComponent(resolvedMarketName)}`;
};
