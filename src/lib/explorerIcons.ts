import { explorerIconMap, normalizeExplorerBase } from './explorerIconMap';
import { EXPLORER_ICON_MANIFEST } from './explorerIconManifest.generated';

function resolveExplorerIconPathFromBase(iconBase: string): string | undefined {
  const key = iconBase.toLowerCase();
  const exts = EXPLORER_ICON_MANIFEST[key];
  if (!exts?.length) return undefined;
  const ext = exts[0];
  return `/icons/explorers/${key}.${ext}`;
}

export const getExplorerIconSrc = (base: string): string | undefined => {
  const normalized = normalizeExplorerBase(base);
  const iconName = explorerIconMap[normalized];
  if (!iconName) return undefined;
  return resolveExplorerIconPathFromBase(iconName);
};

/**
 * Map an explorer base URL to the brand label used in `explorerIconMap`.
 * The brand is the icon base (e.g. `etherscan`, `blockscout`, `routescan`,
 * `oklink`). For unknown bases returns `undefined`.
 */
export const getExplorerBrand = (base: string): string | undefined => {
  const normalized = normalizeExplorerBase(base);
  return explorerIconMap[normalized];
};
