# Frontend Data Loading Matrix

This document summarizes data-loading behavior for the home page and simulation flows.

**Merkl forecast math** (how `forecast.items` from `/meta/side-data` feed `forecastWithTVL` in simulation): see [`rate-calculation.md`](./rate-calculation.md#merkl-incentive-forecast-forecastwithtvl).

## Key Terms

| Term | What it means |
| --- | --- |
| App-level prefetch | `queryClient.prefetchQuery(...)` started during app bootstrap before page components mount. |
| Post-home warm-up / delayed warm-up | Best-effort background fetch in `useEffect(...)` after page data loads (e.g. reserves), scheduled via `requestIdleCallback` or `setTimeout`. |
| Hook query | A regular `useQuery(...)` call inside a mounted component. |
| Warm-up | A best-effort background fetch in `useEffect(...)` (often delayed), used to reduce first-interaction latency. Prefetch is a form of warm-up. |
| React Query cache | Cache managed by TanStack Query by `queryKey` (`staleTime`, retries, dedupe by key). |
| Module in-memory cache | Custom `Map` caches in utility modules (for example forecast batch cache/in-flight dedupe). |
| Local storage cache | Persistent browser cache via `localStorage` wrappers in `src/lib/cache.ts`. |

## Prefetch/Preload at Different Layers

"Prefetch" and "preload" have different meanings depending on the layer:

| Layer | Technique | Meaning | Timing |
| --- | --- | --- | --- |
| **Browser (HTML)** | `<link rel="prefetch">` | Load resources for the **next page** | Current page idle time |
| **Browser (HTML)** | `<link rel="preload">` | Prioritize critical resources for **current page** | During page load |
| **React Query** | `prefetchQuery()` | Fetch data into cache before component needs it | When code executes |
| **Native JS** | `fetch()` | Make a network request | When code executes |

**This project uses React Query `prefetchQuery`**, which is NOT browser-level prefetch. It simply:
1. Calls the fetch function (e.g. `fetchSideDataMeta()`)
2. Stores the result in React Query cache
3. Subsequent `useQuery()` calls retrieve from cache

Browser-level `<link rel="preload" as="fetch">` could start API requests during HTML parsing, but we don't use it because:
- API responses typically need React Query's cache management (staleTime, retry, invalidation)
- React Query provides better control over cache lifecycle

## React Query vs Module In-Memory Cache

| Aspect | React Query layer | Module in-memory layer |
| --- | --- | --- |
| Scope | QueryClient-wide, shared by hooks/components | Specific utility module (for example forecast API helper) |
| Key type | `queryKey` arrays | Custom keys (for example sorted campaign id string) |
| Features | `staleTime`, retry, GC, status flags, hook subscriptions | Custom TTL and in-flight Promise dedupe |
| Lifetime | Page lifetime (or until GC) | Module lifetime (until reload) |
| Used for forecast states | Yes (`useSideDataMeta` → `useRateSimulation`) | No (removed; now uses React Query cache via `SIDE_DATA_META_QUERY_KEY`) |

## Home Page API Matrix

| API | Trigger type | Current trigger point | TTL / staleTime | gcTime | Caches used | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/markets` | App-level prefetch + hook query | `App.tsx` prefetch + `useAaveMarkets` in `Index` | 1 min (`coreSnapshotApi`) | default (5 min) | React Query + localStorage | Core snapshot. |
| `/meta/side-data` | App-level prefetch + hook query | `App.tsx` prefetch + `useSideDataMeta` (consumed by `useTokenCategories`, `useCoingeckoFdv`, `useRateSimulation`) | 5 min (`sideDataMeta`); backend TTL overrides (categories 6h, FDV 5m, forecast 10m) | 15 min | React Query + localStorage | Merged endpoint for categories, FDV, and forecast. Merkl campaign state for incentive simulation: formulas in [`rate-calculation.md` § Merkl incentive forecast](./rate-calculation.md#part-2-merkl-incentive-forecast). |
| `/rate-inputs` | App-level prefetch + hook query | `App.tsx` prefetch + `useReserveRateInputs` in simulation hooks | 1 min (`coreSnapshotApi`) | default (5 min) | React Query + localStorage | Used for native rate simulation. |
| CoinGecko `/search` | Hook query (third-party) | `useCoingeckoTokenImage` fallback only | 24 hours | 30 min | React Query + localStorage | Icon fallback when local/logo URI misses. |
| Forecast token price | Hook query (third-party) | `useRateSimulation` priceQueries (token mode only) | 5 min (`default`) | default (5 min) | React Query only | Transient; no localStorage persistence. |

## Forecast Token Price Backup

| Question | Current behavior |
| --- | --- |
| What is it? | Fallback path in `resolveForecastTokenPriceWithBackup` when `tokenPrices` from backend snapshot is missing. |
| Endpoint | Direct CoinGecko calls in resolver (`/asset_platforms`, `/simple/token_price/{platform}`, `/simple/price`). |
| Is it currently active in shared table simulation? | Yes, when backend `tokenPrices` misses a reserve price. |
| Why not always triggered? | It is skipped whenever backend snapshot already has the required token price entry. |
| Deduping/rate-limit controls | Has a concurrency limiter + in-flight dedupe + TTL cache in resolver module. |

### Endpoint Differences (CoinGecko price fallback chain)

| Endpoint | Primary role | Input key | Typical success condition | Why it exists in chain |
| --- | --- | --- | --- | --- |
| `/asset_platforms` | Resolve `chainId -> platformId` | `chainId` | A known platform id for the chain (for example `base`, `arbitrum-one`) | `simple/token_price/{platform}` requires a platform id, not a chain id. |
| `/simple/token_price/{platform}` | Fetch USD by contract address on a specific chain platform | Token contract address | Address exists on that platform and CoinGecko indexes it | Most precise path for ERC20-style assets because it is address-scoped. |
| `/simple/price` | Fetch USD by CoinGecko coin id (symbol-mapped fallback) | Coin id (for example `usd-coin`, `ethereum`) | Symbol/coin-id mapping exists and CoinGecko has that coin price | Last fallback when address-based lookup is unavailable/missing. |

Current lookup order is strict: first resolve platform, then try address price, and only then fall back to coin-id price.

## Icon Sources and Fallbacks

| Source | Meaning |
| --- | --- |
| Local icon files | `public/icons/...` static assets bundled with the app. |
| `logoURI` | Token logo URL from metadata/token lists (if available in the data path). |
| CoinGecko search fallback | Last resort image fetch by symbol via `useCoingeckoTokenImage`. |

## Can user interaction interrupt warm-ups?

| Item | Current behavior |
| --- | --- |
| API warm-ups (`/meta/side-data`, `/rate-inputs`) | Not automatically canceled by user interaction once started. |
| Image preloading | Can be deferred/paused by preload controls (`setPreloadPaused`, connection heuristics). |
| Weak network/save-data mode | Currently affects image preload aggressiveness, not a global "disable all warm-ups" switch. |

## App-level Prefetch vs Hook Query

| Item | App-level prefetch | Hook query |
| --- | --- | --- |
| Start time | Before page component mount | At component mount/render lifecycle |
| UI subscription | No direct UI subscription by itself | Yes (`data`, `isLoading`, `error`, `refetch`) |
| Should hook be removed if prefetch exists? | No | Keep hook; it is the consumer/subscriber. |

## Warm-up Priority and Timing (Current)

| Priority | Workload | Current timing |
|:---------|:---------|:---------------|
| P0 | `/markets` prefetch | App bootstrap |
| P0 | `/meta/side-data` prefetch (forecast, categories, FDV) | App bootstrap |
| P0 | `/rate-inputs` prefetch | App bootstrap |
| P1 | Reserve token/chain icon preload | 3000ms after reserves |
| P2 | Incentive icons preload | 4000ms after reserves |

**Design rationale:** All API data is prefetched at app bootstrap to ensure data is immediately available when users interact. Static asset preloading happens after reserves load since icons only affect visual polish.

## Frontend Layer Stack (System View)

| Layer | English term | Role |
| --- | --- | --- |
| L0 | Transport layer | Browser fetch + HTTP/HTTPS requests. |
| L1 | API client/util layer | `fetch*` helpers and resolver functions (e.g. `tokenPriceResolver`). |
| L2 | Module cache layer | In-memory Maps for request dedupe, TTL, in-flight sharing (used by token price resolver). |
| L3 | Query/cache layer | TanStack Query (`QueryClient`, `useQuery`, `prefetchQuery`, stale policies). |
| L4 | Persistence layer | `localStorage` cache wrappers in `src/lib/cache.ts`. |
| L5 | Hook consumption layer | Feature hooks (`useAaveMarkets`, `useTokenCategories`, `useRateSimulation`). |
| L6 | View/component layer | Pages/components rendering data, triggering user interactions. |

## Clarifications

| Question | Answer |
| --- | --- |
| Is "hook" only about localStorage? | No. Hooks include normal `useQuery` calls; localStorage is an optional cache source used by some query functions. |
| Should all icons be put into localStorage? | Usually no. Keep static icons in `public/`; localStorage is best for small metadata/URLs, not large binary icon sets. |
| "Mount" in English | `mount` (for example "component mount", "on mount"). |
| Does forecast-states have localStorage? | Yes. Forecast data is cached in localStorage via `useSideDataMeta` → `fetchSideDataMeta` → `setCachedMerklForecastStates`. |

## Warm-up Stage Terminology (中英对照)

| Stage | English | 中文 |
| --- | --- | --- |
| App bootstrap prefetch | App-level prefetch / bootstrap prefetch | 应用级预取 / 启动预取 |
| Home fetch | Home fetch / initial page query | 首页请求 / 首屏数据请求 |
| Post-home delayed fetch | Post-home warm-up / delayed warm-up | 首页加载后预热 / 延迟预热 |
| On-demand when needed | On-demand fetch / lazy fetch | 按需请求 / 懒加载 |
| Downgrade from prefetch to warm-up | Downgrade from prefetch to post-home warm-up | 从预取降级为延迟预热 |

Order in practice: **App prefetch** (all API data at bootstrap) → **Home fetch** (e.g. `useAaveMarkets` consumes prefetched `/markets`) → **Static asset preload** (reserve icons at 3s → incentive icons at 4s).

---

## Backend API Alignment

Frontend types and Zod schemas are aligned with the backend response shapes.

| Endpoint | Frontend usage | Schema / type |
|----------|----------------|----------------|
| `GET /markets` | Manual check `snapshot.lastUpdated`, `reserves[]`; no Zod. Uses `snapshot.staleTimeMs` (when present) as React Query `staleTime`, falling back to local TTL. | `MarketsResponse`, `ReserveWithSpread` |
| `GET /rate-inputs` | Zod `RateInputsResponseSchema` | `RateInputsResponse`, `ReserveRateInput` |
| `GET /meta/side-data` | Zod `SideDataMetaResponseSchema`. Includes categories, FDV, and forecast (merged endpoint). Uses `min(categories.staleTimeMs, fdv.staleTimeMs, forecast.staleTimeMs)` as React Query `staleTime`, falling back to local TTL. Forecast data is also cached in module in-memory cache and localStorage. **`forecast` → `forecastWithTVL`:** see [`rate-calculation.md`](./rate-calculation.md#merkl-incentive-forecast-forecastwithtvl). | `SideDataMetaResponse` (in useSideDataMeta) |

**Backend fields not used by frontend:**
- `GET /rate-inputs`: `sources` – `{ subgraphChains, onchainChains, subgraphMissingChains }` (root-level)
- `GET /meta/side-data` → `fdv.items[]`: `source` – per-item source label (e.g. coingecko)

---

## Token Icon Source at Runtime

Reserve token images (e.g. USDC, WETH) are resolved in this order:

1. **logoURI** – If the reserve has a `logoURI` (from backend or from local config), it is used first.
   - Local config: `src/ui-config/reservePatches.ts` builds a map from `@bgd-labs/aave-address-book` tokenlist (by `underlyingAsset` → `logoURI`) and optional `underlyingAssetMap` overrides.
   - So if a token's contract address is in the address-book tokenlist with a `logoURI`, that URL is used.

2. **Local static assets** – `getTokenIconSources(symbol)` in `src/lib/preloadUtils.ts` returns paths like `/icons/tokens/{symbol}.svg` (and .webp, .png).
   - Files under `public/icons/tokens/` are tried in order; the first that loads wins.

3. **CoinGecko fallback** – If neither logoURI nor a local icon works, `useCoingeckoTokenImage(symbol)` in `src/hooks/useCoingeckoTokenImage.ts` fetches from CoinGecko's search API by symbol and caches the result.

**Preload vs Runtime:** Preload only covers local static files (`/icons/tokens/`). Runtime display prioritizes logoURI first.

---

## FAQ

**Q3: Why is logoURI better than local hardcoded logos?**  
(1) **Single source of truth**: Token lists / chain metadata already carry logo URLs; duplicating in code gets out of date. (2) **Less bundle and maintenance**: No need to ship and version many assets; new tokens work without a frontend release. (3) **Consistency**: Same logo across apps that use the same list. Local `public/icons/` is still useful as a fallback for known tokens when metadata is missing.

**Q4: Why are high-frequency endpoints not suitable for meta aggregation?**  
High-frequency requests need low latency and often different cache keys/params per call. Putting them behind one meta endpoint adds an extra hop and forces every request to depend on meta freshness; one slow or stale meta response blocks or invalidates many calls. Meta aggregation fits low-frequency, coarse TTL data (e.g. config, categories) where one aggregated response can serve many cache entries.

**Q7: For our warm-up scenario, requestIdleCallback or fetch priority?**  
Use **fetch priority** (e.g. `fetch(..., { priority: 'low' })`) for warm-up requests. It keeps the request in the network stack with clear priority and lets the browser schedule it without blocking. `requestIdleCallback` is for **main-thread** work (e.g. non-urgent JS); it does not lower network priority and does not cancel when the page gets busy. For “fire after a delay” warm-ups, `setTimeout` + low-priority fetch is the right fit.

**Q8: 分成回避 — English term?**  
If you mean 分层回退 (layered fallback): **fallback chain** or **layered fallback**. If you mean 分步回避 (step-by-step avoidance): **progressive degradation** or **graceful degradation**.

