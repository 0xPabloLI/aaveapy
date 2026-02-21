import type { TokenPricesIndex } from '@/types/aave';
import { getCoingeckoBackupPriceTtlMs } from './merklForecastConfig';

type ForecastActionType = 'Supply' | 'Borrow' | 'Hold';
type FetchLike = typeof fetch;
type AssetPlatform = { id?: string; chain_identifier?: number | null };

interface ResolveForecastTokenPriceInput {
  tokenPrices?: TokenPricesIndex;
  chainId: number;
  actionType: ForecastActionType;
  tokenSymbol?: string | null;
  tokenAddress?: string | null;
  aTokenAddress?: string | null;
  vTokenAddress?: string | null;
}

const toKey = (chainId: number, address: string): string =>
  `${chainId}:${address.toLowerCase()}`;

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
const PLATFORM_TTL_MS = 24 * 60 * 60 * 1000;
const PLATFORM_FORCE_REFRESH_COOLDOWN_MS = 10 * 60 * 1000;
const HARDCODED_PLATFORM_BY_CHAIN_ID: Record<number, string> = {
  1: 'ethereum',
  10: 'optimistic-ethereum',
  56: 'binance-smart-chain',
  100: 'xdai',
  137: 'polygon-pos',
  146: 'sonic',
  250: 'fantom',
  324: 'zksync',
  8453: 'base',
  42161: 'arbitrum-one',
  43114: 'avalanche',
  59144: 'linea',
  534352: 'scroll',
};
const COINGECKO_COIN_ID_BY_SYMBOL: Record<string, string> = {
  usdt: 'tether',
  usdc: 'usd-coin',
  dai: 'dai',
  gho: 'gho',
  pyusd: 'paypal-usd',
  usde: 'ethena-usde',
  susde: 'ethena-staked-usde',
  usds: 'usds',
  eth: 'ethereum',
  weth: 'weth',
  btc: 'bitcoin',
  wbtc: 'wrapped-bitcoin',
  eurc: 'euro-coin',
};

const priceCache = new Map<string, { price: number; expiresAt: number }>();
const priceInFlight = new Map<string, Promise<number | undefined>>();
let platformMapCache:
  | {
      map: Map<number, string>;
      expiresAt: number;
    }
  | null = null;
let lastPlatformForceRefreshAt = 0;

const pushIfPresent = (into: string[], value?: string | null) => {
  if (!value) return;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return;
  if (!into.includes(normalized)) into.push(normalized);
};

const normalizeTokenSymbol = (symbol?: string | null): string | undefined => {
  if (!symbol) return undefined;
  const normalized = symbol
    .trim()
    .toLowerCase()
    .replace(/₮/g, 't')
    .replace(/[^a-z0-9]/g, '');
  return normalized || undefined;
};

const inferUnderlyingSymbolCandidates = (tokenSymbol?: string | null): string[] => {
  const normalized = normalizeTokenSymbol(tokenSymbol);
  if (!normalized) return [];

  const knownSymbols = Object.keys(COINGECKO_COIN_ID_BY_SYMBOL).sort((a, b) => b.length - a.length);
  const candidates: string[] = [];

  if (knownSymbols.includes(normalized)) {
    candidates.push(normalized);
  }

  for (const known of knownSymbols) {
    if (normalized !== known && normalized.endsWith(known)) {
      candidates.push(known);
    }
  }

  return Array.from(new Set(candidates));
};

const buildCandidateAddresses = ({
  actionType,
  tokenAddress,
  aTokenAddress,
  vTokenAddress,
}: Pick<ResolveForecastTokenPriceInput, 'actionType' | 'tokenAddress' | 'aTokenAddress' | 'vTokenAddress'>) => {
  const candidates: string[] = [];
  pushIfPresent(candidates, tokenAddress);

  if (actionType === 'Borrow') {
    pushIfPresent(candidates, vTokenAddress);
    pushIfPresent(candidates, aTokenAddress);
  } else {
    pushIfPresent(candidates, aTokenAddress);
    pushIfPresent(candidates, vTokenAddress);
  }

  return candidates;
};

export const resolveForecastTokenPrice = ({
  tokenPrices,
  chainId,
  actionType,
  tokenAddress,
  aTokenAddress,
  vTokenAddress,
}: ResolveForecastTokenPriceInput): number | undefined => {
  if (!tokenPrices) return undefined;

  const candidates = buildCandidateAddresses({
    actionType,
    tokenAddress,
    aTokenAddress,
    vTokenAddress,
  });

  for (const address of candidates) {
    const entry = tokenPrices[toKey(chainId, address)];
    if (entry && Number.isFinite(entry.price)) {
      return entry.price;
    }
  }

  return undefined;
};

const getAssetPlatformMap = async (
  fetchImpl: FetchLike,
  options?: { forceRefresh?: boolean }
): Promise<Map<number, string>> => {
  const now = Date.now();
  if (!options?.forceRefresh && platformMapCache && platformMapCache.expiresAt > now) {
    return platformMapCache.map;
  }

  const response = await fetchImpl(`${COINGECKO_API_BASE}/asset_platforms`);
  if (!response.ok) {
    throw new Error(`CoinGecko asset_platforms failed (${response.status})`);
  }

  const payload = (await response.json()) as AssetPlatform[];
  const map = new Map<number, string>();
  if (Array.isArray(payload)) {
    payload.forEach((item) => {
      const chainId = item.chain_identifier;
      const platformId = item.id;
      if (
        typeof chainId === 'number' &&
        Number.isFinite(chainId) &&
        chainId > 0 &&
        typeof platformId === 'string' &&
        platformId
      ) {
        map.set(chainId, platformId);
      }
    });
  }

  platformMapCache = {
    map,
    expiresAt: now + PLATFORM_TTL_MS,
  };
  return map;
};

const fetchTokenPriceByPlatform = async (
  platformId: string,
  normalizedAddress: string,
  fetchImpl: FetchLike
): Promise<number | undefined> => {
  const url =
    `${COINGECKO_API_BASE}/simple/token_price/${platformId}` +
    `?contract_addresses=${encodeURIComponent(normalizedAddress)}` +
    `&vs_currencies=usd`;
  const response = await fetchImpl(url);
  if (!response.ok) return undefined;

  const payload = (await response.json()) as Record<string, { usd?: number }>;
  if (!payload || typeof payload !== 'object') return undefined;
  const hit = payload[normalizedAddress] ?? payload[Object.keys(payload)[0] ?? ''];
  const usd = typeof hit?.usd === 'number' && Number.isFinite(hit.usd) ? hit.usd : undefined;
  return usd;
};

const fetchCoingeckoPriceBySymbol = async (
  symbol: string,
  tokenSymbol: string | null | undefined,
  fetchImpl: FetchLike
): Promise<number | undefined> => {
  const coinId = COINGECKO_COIN_ID_BY_SYMBOL[symbol];
  if (!coinId) return undefined;

  const cacheKey = `coin:${coinId}`;
  const cached = priceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.price;
  }

  const existing = priceInFlight.get(cacheKey);
  if (existing) return existing;

  const request = (async () => {
    try {
      const url =
        `${COINGECKO_API_BASE}/simple/price` +
        `?ids=${encodeURIComponent(coinId)}` +
        `&vs_currencies=usd`;
      const response = await fetchImpl(url);
      if (!response.ok) return undefined;

      const payload = (await response.json()) as Record<string, { usd?: number }>;
      const usd = payload?.[coinId]?.usd;
      if (typeof usd !== 'number' || !Number.isFinite(usd)) return undefined;

      priceCache.set(cacheKey, {
        price: usd,
        expiresAt: Date.now() + getCoingeckoBackupPriceTtlMs(tokenSymbol),
      });
      return usd;
    } catch {
      return undefined;
    } finally {
      priceInFlight.delete(cacheKey);
    }
  })();

  priceInFlight.set(cacheKey, request);
  return request;
};

const resolvePlatformId = (chainId: number, dynamicMap: Map<number, string>): string | undefined => {
  return HARDCODED_PLATFORM_BY_CHAIN_ID[chainId] ?? dynamicMap.get(chainId);
};

const fetchCoingeckoTokenPrice = async (
  chainId: number,
  address: string,
  tokenSymbol: string | null | undefined,
  fetchImpl: FetchLike
): Promise<number | undefined> => {
  const normalizedAddress = address.toLowerCase();
  const cacheKey = toKey(chainId, normalizedAddress);
  const now = Date.now();
  const cached = priceCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.price;
  }

  const existingRequest = priceInFlight.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    try {
      const cachedPlatforms = platformMapCache?.map ?? new Map<number, string>();
      let platformId = resolvePlatformId(chainId, cachedPlatforms);
      let forceRefreshedPlatforms = false;
      if (!platformId) {
        const mappedPlatforms = await getAssetPlatformMap(fetchImpl);
        platformId = resolvePlatformId(chainId, mappedPlatforms);
        const now = Date.now();
        const shouldForceRefresh =
          now - lastPlatformForceRefreshAt >= PLATFORM_FORCE_REFRESH_COOLDOWN_MS;
        if (!platformId && shouldForceRefresh) {
          lastPlatformForceRefreshAt = now;
          const refreshedPlatforms = await getAssetPlatformMap(fetchImpl, { forceRefresh: true });
          platformId = resolvePlatformId(chainId, refreshedPlatforms);
          forceRefreshedPlatforms = true;
        }
      }
      if (!platformId) return undefined;

      let usd = await fetchTokenPriceByPlatform(platformId, normalizedAddress, fetchImpl);
      if (usd === undefined && !forceRefreshedPlatforms) {
        const now = Date.now();
        const shouldForceRefresh =
          now - lastPlatformForceRefreshAt >= PLATFORM_FORCE_REFRESH_COOLDOWN_MS;
        if (shouldForceRefresh) {
          lastPlatformForceRefreshAt = now;
          const refreshedPlatforms = await getAssetPlatformMap(fetchImpl, { forceRefresh: true });
          const refreshedPlatformId = resolvePlatformId(chainId, refreshedPlatforms);
          if (refreshedPlatformId) {
            usd = await fetchTokenPriceByPlatform(refreshedPlatformId, normalizedAddress, fetchImpl);
          }
        }
      }
      if (usd === undefined) return undefined;

      priceCache.set(cacheKey, {
        price: usd,
        expiresAt: Date.now() + getCoingeckoBackupPriceTtlMs(tokenSymbol),
      });
      return usd;
    } catch {
      return undefined;
    } finally {
      priceInFlight.delete(cacheKey);
    }
  })();

  priceInFlight.set(cacheKey, request);
  return request;
};

export const resolveForecastTokenPriceWithBackup = async (
  input: ResolveForecastTokenPriceInput,
  fetchImpl: FetchLike = fetch
): Promise<number | undefined> => {
  const localPrice = resolveForecastTokenPrice(input);
  if (localPrice !== undefined) return localPrice;

  const candidates = buildCandidateAddresses(input);
  for (const address of candidates) {
    const backup = await fetchCoingeckoTokenPrice(input.chainId, address, input.tokenSymbol, fetchImpl);
    if (backup !== undefined) return backup;
  }

  // Last fallback: infer underlying symbol (e.g. aCelUSDT -> USDT) and fetch coin-level USD price.
  const symbolCandidates = inferUnderlyingSymbolCandidates(input.tokenSymbol);
  for (const symbol of symbolCandidates) {
    const backup = await fetchCoingeckoPriceBySymbol(symbol, input.tokenSymbol, fetchImpl);
    if (backup !== undefined) return backup;
  }

  return undefined;
};

export const __resetForecastTokenPriceBackupCachesForTests = (): void => {
  priceCache.clear();
  priceInFlight.clear();
  platformMapCache = null;
  lastPlatformForceRefreshAt = 0;
};
