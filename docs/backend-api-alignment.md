# Backend API alignment

Frontend types and Zod schemas are aligned with the backend response shapes. This doc records the mapping and lists backend fields that the frontend does not use.

## Endpoints and alignment

| Endpoint | Frontend usage | Schema / type |
|----------|----------------|----------------|
| `GET /markets` | Manual check `snapshot.lastUpdated`, `reserves[]`; no Zod. Uses `snapshot.staleTimeMs` (when present) as React Query `staleTime`, falling back to local TTL. | `MarketsResponse`, `ReserveWithSpread` |
| `GET /rate-inputs` | Zod `RateInputsResponseSchema` | `RateInputsResponse`, `ReserveRateInput` |
| `GET /meta/side-data` | Zod `SideDataMetaResponseSchema` | `SideDataMetaResponse` (in useSideDataMeta) |
| `GET /campaigns/forecast-states` | Cast to `MerklForecastStatesBatchResponse`; no Zod. Uses root `staleTimeMs` (when present) for in-memory cache TTL, falling back to 60s when missing. | `MerklForecastStatesBatchResponse`, `MerklForecastStateResponse` |

Reserve shape: backend sends `reserveId`, `tokenPrice`, `marketSizeUsd`, `utilizationPct`; all are optional in frontend schema/type. Rate-input items: backend does not send `source` / `sourceDetail`; frontend has them optional. Rate-inputs root: frontend uses `staleTimeMs` (when present) as React Query `staleTime`, and falls back to local TTL when missing; `isStale` (if present) is ignored. Side-data root: frontend uses `categories.staleTimeMs` / `fdv.staleTimeMs` (when present, via their minimum) as React Query `staleTime`, and falls back to local TTL when missing.

## Backend fields not used by the frontend

These fields are returned by the backend but are never read or displayed in the app.

- **`GET /rate-inputs`**
  - `sources` – `{ subgraphChains, onchainChains, subgraphMissingChains }` (root-level)
- **`GET /campaigns/forecast-states`**
  - `requested` – number of requested campaign IDs (root-level)
- **`GET /meta/side-data`** → `fdv.items[]`
  - `source` – per-item source label (e.g. coingecko)

All other response fields are used (for display, simulation, or caching).
