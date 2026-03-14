# Backend API alignment

Frontend types and Zod schemas are aligned with the backend response shapes. This doc records the mapping and lists backend fields that the frontend does not use.

## Endpoints and alignment

| Endpoint | Frontend usage | Schema / type |
|----------|----------------|----------------|
| `GET /markets` | Manual check `snapshot.lastUpdated`, `reserves[]`; no Zod. Uses `snapshot.staleTimeMs` (when present) as React Query `staleTime`, falling back to local TTL. | `MarketsResponse`, `ReserveWithSpread` |
| `GET /rate-inputs` | Zod `RateInputsResponseSchema` | `RateInputsResponse`, `ReserveRateInput` |
| `GET /meta/side-data` | Zod `SideDataMetaResponseSchema`. Includes categories, FDV, and forecast (merged endpoint). Uses `min(categories.staleTimeMs, fdv.staleTimeMs, forecast.staleTimeMs)` as React Query `staleTime`, falling back to local TTL. Forecast data is also cached in module in-memory cache and localStorage. | `SideDataMetaResponse` (in useSideDataMeta) |

Reserve shape: backend sends `reserveId`, `tokenPrice`, `reserveSizeUsd`, `utilizationPct`; all are optional in frontend schema/type. Rate-input items: backend sends `deficit` and may omit `source` / `sourceDetail`; frontend treats source fields as optional. Rate-inputs root: frontend uses `staleTimeMs` (when present) as React Query `staleTime`, and falls back to local TTL when missing; `isStale` (if present) is ignored.

## Backend fields not used by the frontend

These fields are returned by the backend but are never read or displayed in the app.

- **`GET /rate-inputs`**
  - `sources` – `{ subgraphChains, onchainChains, subgraphMissingChains }` (root-level)
- **`GET /meta/side-data`** → `fdv.items[]`
  - `source` – per-item source label (e.g. coingecko)

All other response fields are used (for display, simulation, or caching).
