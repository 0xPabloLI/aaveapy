import { chainIconMap } from './chainIconMap';
import { CHAIN_ICON_MANIFEST } from './chainIconManifest.generated';

function resolveChainIconPathFromBase(iconBase: string): string | undefined {
  const key = iconBase.toLowerCase();
  const exts = CHAIN_ICON_MANIFEST[key];
  if (!exts?.length) return undefined;
  const ext = exts[0];
  return `/icons/networks/${key}.${ext}`;
}

export const getChainIconSrc = (chainId: number) => {
  const iconName = chainIconMap[chainId];
  if (!iconName) return undefined;
  return resolveChainIconPathFromBase(iconName);
};
