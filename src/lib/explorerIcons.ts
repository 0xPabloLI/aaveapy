import { explorerIconMap, normalizeExplorerBase } from './explorerIconMap';
import { EXPLORER_ICON_MANIFEST } from './explorerIconManifest.generated';

function resolveExplorerIconPathFromBase(iconBase: string): string | undefined {
  const key = iconBase.toLowerCase();
  const exts = EXPLORER_ICON_MANIFEST[key];
  if (!exts?.length) return undefined;
  const ext = exts[0];
  return `/icons/explorers/${key}.${ext}`;
}

function resolveBrand(base: string): string | undefined {
  return explorerIconMap[normalizeExplorerBase(base)];
}

export const getExplorerIconSrc = (base: string): string | undefined => {
  const brand = resolveBrand(base);
  if (!brand) return undefined;
  return resolveExplorerIconPathFromBase(brand);
};

/**
 * Map an explorer base URL to the brand label used in `explorerIconMap`.
 * The brand is the icon base (e.g. `etherscan`, `blockscout`, `routescan`,
 * `oklink`). For unknown bases returns `undefined`.
 */
export const getExplorerBrand = (base: string): string | undefined => resolveBrand(base);
