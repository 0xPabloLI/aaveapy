# Token icon source at runtime

Reserve token images (e.g. acred, USDC) are resolved in this order:

1. **logoURI** – If the reserve has a `logoURI` (from backend or from local config), it is used first.  
   - Local config: `src/ui-config/reservePatches.ts` builds a map from `@bgd-labs/aave-address-book` tokenlist (by `underlyingAsset` → `logoURI`) and optional `underlyingAssetMap` overrides.  
   - So if a token’s contract address is in the address-book tokenlist with a `logoURI`, that URL is used.

2. **Local static assets** – `getTokenIconSources(symbol)` in `src/lib/preloadUtils.ts` returns paths like `/icons/tokens/{symbol}.svg` (and .webp, .png).  
   - Files under `public/icons/tokens/` are tried in order; the first that loads wins.

3. **CoinGecko fallback** – If neither logoURI nor a local icon works, `useCoingeckoTokenImage(symbol)` in `src/hooks/useCoingeckoTokenImage.ts` fetches from CoinGecko’s search API by symbol and caches the result.

**How to see which source was used for a given token (e.g. acred):**

- In DevTools Network tab: if you see a request to `api.coingecko.com` with a path like `/api/v3/search?query=acred`, the icon came from CoinGecko (step 3).
- If there is no CoinGecko request for that symbol, the icon came from logoURI (step 1) or from local files (step 2).
- To confirm logoURI: in the app, the reserve data passed to `TokenIcon` includes `logoURI` when provided by `fetchIconSymbolAndName()` in `reservePatches.ts` (from tokenlist or `underlyingAssetMap`).
