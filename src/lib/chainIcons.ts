const chainIconMap: Record<string, string> = {
  ethereum: 'ethereum',
  arbitrum: 'arbitrum',
  arbitrumone: 'arbitrum',
  optimism: 'optimism',
  polygon: 'polygon',
  avalanche: 'avalanche',
  base: 'base',
  bnbchain: 'binance',
  bsc: 'binance',
  binance: 'binance',
  binancesmartchain: 'binance',
  gnosis: 'gnosis',
  scroll: 'scroll',
  metis: 'metis',
  metisandromeda: 'metis',
  zksync: 'zksync',
  zksyncera: 'zksync',
  linea: 'linea',
  celo: 'celo',
  sonic: 'sonic',
  soneium: 'soneium',
  plasma: 'plasma',
  ink: 'ink',
  mantle: 'mantle',
  megaeth: 'megaeth',
};

const normalizeChainName = (chain: string) => chain.toLowerCase().replace(/[^a-z0-9]/g, '');

export const getChainIconSrc = (chain: string) => {
  const normalized = normalizeChainName(chain);
  const iconName = chainIconMap[normalized];
  return iconName ? `/icons/networks/${iconName}.svg` : undefined;
};
