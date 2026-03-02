import { chainIconMap, normalizeChainName } from './chainIconMap';

export const getChainIconSrc = (chain: string) => {
  const normalized = normalizeChainName(chain);
  const iconName = chainIconMap[normalized];
  return iconName ? `/icons/networks/${iconName}.svg` : undefined;
};
