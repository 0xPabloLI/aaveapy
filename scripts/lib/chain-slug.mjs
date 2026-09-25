/**
 * Slug derivation for chainIconMap auto-sync (AAV-1297).
 *
 * Pure functions only: no fs, no network at module load. The chainid.network
 * lookup (Level 3.5) receives its fetch implementation via argument so tests
 * can inject fakes and production wires fetchWithTimeout.
 *
 * Priority chain (see docs/specs/chain-icon-map-auto-sync.md):
 *   0. upstream iconBase (resolved by caller before this module)
 *   1. overrides table  (scripts/data/chain-slug-overrides.json)
 *   2. address-book module name (AaveV4Arc -> arc)
 *   3. viem/chains local lookup (id -> name -> kebab)
 *   3.5 chainid.network API (3s timeout, catch -> Level 4)
 *   4. chain-<id> fallback
 */

const CHAINID_NETWORK_URL = 'https://chainid.network/chains.json';
const SLUG_SAFE_RE = /^[a-z0-9-]+$/;
const AAVE_MODULE_PREFIX_RE = /^AaveV[34]/;

export function kebabCase(input) {
  return String(input)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugFromModuleName(moduleName) {
  if (typeof moduleName !== 'string' || moduleName.length === 0) return null;
  const stripped = moduleName.replace(AAVE_MODULE_PREFIX_RE, '');
  if (stripped.length === 0) return null;
  const slug = kebabCase(stripped);
  return slug || null;
}

/**
 * Parse and validate the slug overrides table.
 * Values are lowercased; anything outside [a-z0-9-] after lowercasing fails
 * fast because this is a hand-maintained table and silent normalization would
 * hide typos.
 * @param {string} raw JSON text
 * @returns {Map<number, string>}
 */
export function loadSlugOverrides(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`chain-slug-overrides.json is not valid JSON: ${err.message}`);
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('chain-slug-overrides.json must be a JSON object of { "<chainId>": "<slug>" }');
  }
  const overrides = new Map();
  for (const [key, value] of Object.entries(data)) {
    const chainId = Number(key);
    if (!Number.isInteger(chainId) || chainId <= 0) {
      throw new Error(`chain-slug-overrides.json: key "${key}" is not a valid chainId`);
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`chain-slug-overrides.json: chainId ${key} has an empty slug`);
    }
    const slug = value.trim().toLowerCase();
    if (!SLUG_SAFE_RE.test(slug)) {
      throw new Error(
        `chain-slug-overrides.json: chainId ${key} slug "${value}" must match [a-zA-Z0-9-] (no spaces/underscores)`,
      );
    }
    overrides.set(chainId, slug);
  }
  return overrides;
}

/**
 * Monogram for the placeholder SVG: first two chars of the first kebab
 * segment, uppercased ('chainlink-arc' -> 'CL').
 * @param {string} slug
 * @returns {string}
 */
export function monogramFromSlug(slug) {
  const firstSegment = String(slug).split('-')[0] || '';
  return firstSegment.slice(0, 2).toUpperCase();
}

function escapeXml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Neutral placeholder chain SVG (mirrors the hand-made chainlink-arc.svg
 * shape: 200x200 rounded gradient disc + monogram).
 * @param {string} monogram
 * @returns {string}
 */
export function renderPlaceholderSvg(monogram) {
  const label = escapeXml(monogram);
  return `<svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse"><stop stop-color="#465061"/><stop stop-color="#1C2430"/></linearGradient></defs><rect width="200" height="200" rx="100" fill="url(#g)"/><text x="100" y="104" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="72" font-weight="600" fill="#E8EDF4" letter-spacing="2">${label}</text></svg>`;
}

async function fetchChainNameFromChainIdNetwork(chainId, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(CHAINID_NETWORK_URL, { signal: controller.signal });
    if (!response.ok) return null;
    const chains = await response.json();
    if (!Array.isArray(chains)) return null;
    const match = chains.find((c) => c && c.chainId === chainId);
    return typeof match?.name === 'string' && match.name.trim() ? match.name.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the slug for a registry-only chain via the fallback hierarchy.
 * Never throws: Level 4 guarantees a slug so verify stays closable.
 * @param {object} input
 * @param {number} input.chainId
 * @param {string} [input.moduleName] address-book module name (Level 2)
 * @param {Map<number, string>} [input.overrides] chainId -> slug (Level 1)
 * @param {Map<number, string>} [input.viemChains] chainId -> chain name (Level 3)
 * @param {typeof fetch} [input.fetchImpl] fetch for chainid.network (Level 3.5)
 * @param {number} [input.fetchTimeoutMs] Level 3.5 timeout, default 3000
 * @returns {Promise<{slug: string, source: 'overrides'|'module-name'|'viem'|'chainid.network'|'fallback'}>}
 */
export async function deriveChainSlug({
  chainId,
  moduleName,
  overrides,
  viemChains,
  fetchImpl,
  fetchTimeoutMs = 3000,
}) {
  const overrideSlug = overrides?.get(chainId);
  if (overrideSlug) {
    return { slug: overrideSlug, source: 'overrides' };
  }

  const moduleSlug = slugFromModuleName(moduleName);
  if (moduleSlug) {
    return { slug: moduleSlug, source: 'module-name' };
  }

  const viemName = viemChains?.get(chainId);
  if (typeof viemName === 'string' && viemName.trim()) {
    const slug = kebabCase(viemName.trim());
    if (slug) {
      return { slug, source: 'viem' };
    }
  }

  if (typeof fetchImpl === 'function') {
    const remoteName = await fetchChainNameFromChainIdNetwork(chainId, fetchImpl, fetchTimeoutMs);
    if (remoteName) {
      const slug = kebabCase(remoteName);
      if (slug) {
        return { slug, source: 'chainid.network' };
      }
    }
  }

  return { slug: `chain-${chainId}`, source: 'fallback' };
}
