# Frontend Data Loading Matrix

This document summarizes data-loading behavior for the home page and simulation flows.

## Key Terms

| Term | What it means |
| --- | --- |
| App-level prefetch | `queryClient.prefetchQuery(...)` started during app bootstrap before page components mount. |
| Post-home warm-up / delayed warm-up | Best-effort background fetch in `useEffect(...)` after page data loads (e.g. reserves), with a delay (e.g. 500–1200ms). |
| Hook query | A regular `useQuery(...)` call inside a mounted component. |
| Warm-up | A best-effort background fetch in `useEffect(...)` (often delayed), used to reduce first-interaction latency. Prefetch is a form of warm-up. |
| React Query cache | Cache managed by TanStack Query by `queryKey` (`staleTime`, retries, dedupe by key). |
| Module in-memory cache | Custom `Map` caches in utility modules (for example forecast batch cache/in-flight dedupe). |
| Local storage cache | Persistent browser cache via `localStorage` wrappers in `src/lib/cache.ts`. |

## React Query vs Module In-Memory Cache

| Aspect | React Query layer | Module in-memory layer |
| --- | --- | --- |
| Scope | QueryClient-wide, shared by hooks/components | Specific utility module (for example forecast API helper) |
| Key type | `queryKey` arrays | Custom keys (for example sorted campaign id string) |
| Features | `staleTime`, retry, GC, status flags, hook subscriptions | Custom TTL and in-flight Promise dedupe |
| Lifetime | Page lifetime (or until GC) | Module lifetime (until reload) |
| Used for forecast states | Yes (`useQuery` in `useRateSimulation`) | Yes (`batchCache` and `batchInFlight` in `merklForecastApi`) |

## Home Page API Matrix

| API | Trigger type | Current trigger point | TTL / staleTime | Caches used | Notes |
| --- | --- | --- | --- | --- | --- |
| `/markets` | App-level prefetch + hook query | `App.tsx` prefetch + `useAaveMarkets` in `Index` | 2 min (`coreSnapshotApi`) | React Query + localStorage | Core snapshot. |
| `/coingecko-categories` | Warm-up + hook query | Warm-up in `Index` (1200ms after reserves) + `useTokenCategories` in `Index` | 6 hours | React Query + localStorage | Lightweight side-data. |
| `/coingecko-fdv` | Hook query | `useCoingeckoFdv` in `InkAprCalculator` | 10 min | React Query + localStorage | Needed on first screen by calculator. |
| `/rate-inputs` | Warm-up + hook query | Warm-up in `Index` (`prefetchRateInputsSnapshot`) + on-demand in simulation hooks | 2 min | React Query + localStorage | Warm-up avoids first-tooltip lag. |
| `/campaigns/forecast-states` | Warm-up + hook query | Global warm-up in `Index` (800ms after reserves, `fetchMerklForecastStates()`), then id-based consumers | 2 min | Module in-memory + React Query (+ localStorage via simulation hook) | Subset requests can reuse full-batch cache. |
| CoinGecko `/search` | Hook query (third-party) | `useCoingeckoTokenImage` fallback only | 24 hours | React Query + localStorage | Icon fallback when local/logo URI misses. |

## Forecast Token Price Backup

| Question | Current behavior |
| --- | --- |
| What is it? | Fallback path in `resolveForecastTokenPriceWithBackup` when `tokenPrices` from backend snapshot is missing. |
| Endpoint | Direct CoinGecko calls in resolver (`/asset_platforms`, `/simple/token_price/{platform}`, `/simple/price`). |
| Is it currently active in shared table simulation? | Yes, when backend `tokenPrices` misses a reserve price. |
| Why not always triggered? | It is skipped whenever backend snapshot already has the required token price entry. |
| Deduping/rate-limit controls | Has a concurrency limiter + in-flight dedupe + TTL cache in resolver module. |

## Icon Sources and Fallbacks

| Source | Meaning |
| --- | --- |
| Local icon files | `public/icons/...` static assets bundled with the app. |
| `logoURI` | Token logo URL from metadata/token lists (if available in the data path). |
| CoinGecko search fallback | Last resort image fetch by symbol via `useCoingeckoTokenImage`. |

## Can user interaction interrupt warm-ups?

| Item | Current behavior |
| --- | --- |
| API warm-ups (`/rate-inputs`, `/forecast-states`) | Not automatically canceled by user interaction once started. |
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
| P1 | `/rate-inputs` warm-up | 700ms after reserves available |
| P2 | `/forecast-states` warm-up | 800ms after reserves available |
| P3 | `/token-categories` warm-up | 1200ms after reserves available |
| P4 | Non-critical image preloading (reserve icons, incentive icons) | Immediate/adaptive + delayed incentive icons (2000ms) |

## Frontend Layer Stack (System View)

| Layer | English term | Role |
| --- | --- | --- |
| L0 | Transport layer | Browser fetch + HTTP/HTTPS requests. |
| L1 | API client/util layer | `fetch*` helpers and resolver functions (`tokenPriceResolver`, `merklForecastApi`). |
| L2 | Module cache layer | In-memory Maps for request dedupe, TTL, in-flight sharing. |
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
| Does forecast-states have localStorage? | Yes. `setCachedMerklForecastStates(payload)` in `useRateSimulation` persists to localStorage via `src/lib/cache.ts`. |

## Warm-up Stage Terminology (中英对照)

| Stage | English | 中文 |
| --- | --- | --- |
| App bootstrap prefetch | App-level prefetch / bootstrap prefetch | 应用级预取 / 启动预取 |
| Home fetch | Home fetch / initial page query | 首页请求 / 首屏数据请求 |
| Post-home delayed fetch | Post-home warm-up / delayed warm-up | 首页加载后预热 / 延迟预热 |
| On-demand when needed | On-demand fetch / lazy fetch | 按需请求 / 懒加载 |
| Downgrade from prefetch to warm-up | Downgrade from prefetch to post-home warm-up | 从预取降级为延迟预热 |

Order in practice: **App prefetch** → **Home fetch** (e.g. `useAaveMarkets` consumes prefetched `/markets`) → **Post-home warm-up** (rate-inputs, forecast-states, token-categories at 700 / 800 / 1200ms).

## FAQ

**Q3: Why is logoURI better than local hardcoded logos?**  
(1) **Single source of truth**: Token lists / chain metadata already carry logo URLs; duplicating in code gets out of date. (2) **Less bundle and maintenance**: No need to ship and version many assets; new tokens work without a frontend release. (3) **Consistency**: Same logo across apps that use the same list. Local `public/icons/` is still useful as a fallback for known tokens when metadata is missing.

**Q4: Why are high-frequency endpoints not suitable for meta aggregation?**  
High-frequency requests need low latency and often different cache keys/params per call. Putting them behind one meta endpoint adds an extra hop and forces every request to depend on meta freshness; one slow or stale meta response blocks or invalidates many calls. Meta aggregation fits low-frequency, coarse TTL data (e.g. config, categories) where one aggregated response can serve many cache entries.

**Q7: For our warm-up scenario, requestIdleCallback or fetch priority?**  
Use **fetch priority** (e.g. `fetch(..., { priority: 'low' })`) for warm-up requests. It keeps the request in the network stack with clear priority and lets the browser schedule it without blocking. `requestIdleCallback` is for **main-thread** work (e.g. non-urgent JS); it does not lower network priority and does not cancel when the page gets busy. For “fire after a delay” warm-ups, `setTimeout` + low-priority fetch is the right fit.

**Q8: 分成回避 — English term?**  
If you mean 分层回退 (layered fallback): **fallback chain** or **layered fallback**. If you mean 分步回避 (step-by-step avoidance): **progressive degradation** or **graceful degradation**.

