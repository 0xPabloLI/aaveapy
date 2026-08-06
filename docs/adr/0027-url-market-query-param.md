# URL Market Resolution via Query Params

**Status**: accepted

When a user selects a specific market (e.g., Ethereum Core), the URL must reflect
that market selection for shareability. We chose to extend the existing query-param
approach (`?chain=ethereum&market=core`) rather than adopt path-based routing
(`/chain/:chainSlug/:marketSlug`), because `selectedMarkets` is a multi-select
array and query params naturally support multi-value (comma-separated), while
path segments work best with single values. Path-based routing would also conflict
with the existing `/chain/:slug` SEO landing pages.

## Considered Options

- **A (rejected)**: `/chain/:chainSlug/:marketSlug` path segments — conflicts with
  existing `/chain/:slug` SEO pages; multi-select can't be expressed in path segments.
- **B (rejected)**: `/market/:chainSlug/:marketSlug` new prefix — low SEO value,
  non-intuitive.
- **C (accepted)**: `?chain=xxx&market=yyy` query params — multi-select friendly,
  no SEO page conflict, minimal change, natural backward compat.

## Consequences

- Market slugs use `getSubMarketLabel()` output slugified (e.g., `core`, `prime`,
  `horizon-rwa`). Reverse resolution scans `effectiveMarketsList` within the chain.
- `market` param omitted when all markets of a chain are selected (full-select =
  chain-level URL only).
- Cross-chain multi-select produces no `chain`/`market` params (URL can't express
  arbitrary cross-chain combinations).
- `market` param ignored when `chain` param is absent (no chain context = ambiguous).
