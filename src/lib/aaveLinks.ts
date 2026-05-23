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
  AaveV3Mantle: 'proto_mantle_v3',
  AaveV3MegaEth: 'proto_megaeth_v3',
  AaveV3MegaETH: 'proto_megaeth_v3',
  AaveV3Soneium: 'proto_soneium_v3',
  AaveV3Plasma: 'proto_plasma_v3',
  AaveV3Ink: 'proto_ink_v3',
  AaveV3InkWhitelabel: 'proto_ink_v3',
  AaveV2Ethereum: 'proto_mainnet',
  AaveV2Avalanche: 'proto_avalanche',
  AaveV2Polygon: 'proto_polygon',
  AaveV2Fuji: 'proto_fuji',
  AaveV3XLayer: 'proto_xlayer_v3',
};

const resolveMarketName = (marketName: string): string | null => {
  if (!marketName) return null;
  if (marketName.startsWith('proto_')) return marketName;
  const mapped = MARKET_NAME_MAP[marketName];
  if (mapped) return mapped;

  // Generic fallback for new standalone Aave v3 markets (e.g. AaveV3Mantle -> proto_mantle_v3).
  if (marketName.startsWith('AaveV3') && !marketName.startsWith('AaveV3Ethereum')) {
    const rawChain = marketName.slice('AaveV3'.length).replace(/Whitelabel$/i, '');
    if (rawChain) {
      return `proto_${rawChain.toLowerCase()}_v3`;
    }
  }

  return null;
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

/** Aave app markets list for a specific pool (same `marketName` encoding as reserve overview). */
export function buildAaveMarketUrl(marketName: string): string | null {
  const resolvedMarketName = resolveMarketName(marketName);
  if (!resolvedMarketName) return null;
  return `${AAVE_APP_BASE}/markets/?marketName=${encodeURIComponent(resolvedMarketName)}`;
}

const AAVE_V4_BASE = 'https://pro.aave.com';

/** Chain name to chain ID mapping for pro.aave.com asset URLs. */
const CHAIN_NAME_TO_ID: Record<string, string> = {
  Ethereum: '1',
  Arbitrum: '42161',
  Optimism: '10',
  Polygon: '137',
  Base: '8453',
  Gnosis: '100',
  BNB: '56',
  Avalanche: '43114',
  Scroll: '534352',
  ZkSync: '324',
  Linea: '59144',
  Metis: '1088',
  Sonic: '146',
  Celo: '42220',
  Mantle: '5000',
  Soneium: '1868',
  Ink: '57073',
  MegaEth: '999',
  Plasma: '992',
};

/** Build a pro.aave.com deep-link for a V4 asset. Returns null for non-V4 reserves. */
export function buildAaveV4AssetUrl(asset: {
  tokenAddress: string;
  chainName?: string;
}): string | null {
  if (!asset.tokenAddress || !asset.chainName) return null;
  const chainId = CHAIN_NAME_TO_ID[asset.chainName];
  if (!chainId) return null;
  return `${AAVE_V4_BASE}/explore/asset/${chainId}/${asset.tokenAddress.toLowerCase()}`;
}

/** Build a pro.aave.com deep-link for a V4 reserve. Returns null for non-V4 reserves. */
export function buildAaveV4Url(reserve: {
  aaveProReserveId?: string;
}): string | null {
  if (reserve.aaveProReserveId) {
    return `${AAVE_V4_BASE}/explore/reserve/${reserve.aaveProReserveId}`;
  }
  return null;
}

/** Build a pro.aave.com deep-link for a V4 hub. Returns null for non-V4 reserves. */
export function buildAaveV4HubUrl(reserve: {
  hubId?: string;
}): string | null {
  if (reserve.hubId) {
    return `${AAVE_V4_BASE}/explore/hub/${reserve.hubId}`;
  }
  return null;
}

/** Build a pro.aave.com deep-link for a V4 spoke (market). Returns null if no spokeId. */
export function buildAaveV4MarketUrl(reserve: {
  spokeId?: string;
}): string | null {
  if (reserve.spokeId) {
    return `${AAVE_V4_BASE}/explore/market/${reserve.spokeId}`;
  }
  return null;
}

/**
 * Best-effort Aave link: returns app.aave.com for V3, pro.aave.com for V4, or null.
 * Use this as the single entry-point for "Open on Aave" actions.
 */
export function buildAaveUrl(reserve: {
  marketName: string;
  tokenAddress: string;
  aaveProReserveId?: string;
}): string | null {
  return buildAaveV4Url(reserve) ?? buildAaveReserveUrl(reserve);
}
