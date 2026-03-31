import { chainIconMap, normalizeChainName } from './chainIconMap';
import { CHAIN_ICON_MANIFEST } from './chainIconManifest.generated';

function resolveChainIconPathFromBase(iconBase: string): string | undefined {
  const key = iconBase.toLowerCase();
  const exts = CHAIN_ICON_MANIFEST[key];
  if (!exts?.length) return undefined;
  const ext = exts[0];
  return `/icons/networks/${key}.${ext}`;
}

export const getChainIconSrc = (chain: string) => {
  const normalized = normalizeChainName(chain);
  const iconName = chainIconMap[normalized];
  if (!iconName) return undefined;
  return resolveChainIconPathFromBase(iconName);
};

/** Preferred-first URL list for a canonical icon base (manifest keys are lowercase). */
export function getChainIconSourcesForBase(iconBase: string): string[] {
  const key = iconBase.toLowerCase();
  const exts = CHAIN_ICON_MANIFEST[key];
  if (!exts?.length) return [];
  return exts.map((ext) => `/icons/networks/${key}.${ext}`);
}

export function getChainIconSources(chain: string): string[] {
  const normalized = normalizeChainName(chain);
  const iconName = chainIconMap[normalized];
  if (!iconName) return [];
  return getChainIconSourcesForBase(iconName);
}
