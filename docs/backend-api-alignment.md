# Backend API alignment

Frontend types and Zod schemas are aligned with the backend response shapes. This doc records the mapping and lists backend fields that the frontend does not use.

## Endpoints and alignment

| Endpoint | Frontend usage | Schema / type |
|----------|----------------|----------------|
| `GET /markets` | Manual check `snapshot.lastUpdated`, `reserves[]`; no Zod | `MarketsResponse`, `ReserveWithSpread` |
| `GET /rate-inputs` | Zod `RateInputsResponseSchema` | `RateInputsResponse`, `ReserveRateInput` |
| `GET /meta/side-data` | Zod `SideDataMetaResponseSchema` | `SideDataMetaResponse` (in useSideDataMeta) |
| `GET /campaigns/forecast-states` | Cast to `MerklForecastStatesBatchResponse`; no Zod | `MerklForecastStatesBatchResponse`, `MerklForecastStateResponse` |

Reserve shape: backend sends `reserveId`, `tokenPrice`, `tvlUsd`, `utilizationPct`; all are optional in frontend schema/type. Rate-input items: backend does not send `source` / `sourceDetail`; frontend has them optional.

## Backend fields not used by the frontend

These fields are returned by the backend but are never read or displayed in the app.

- **`GET /rate-inputs`**
  - `isStale` – root-level flag
  - `staleTimeMs` – root-level
  - `sources` – `{ subgraphChains, onchainChains, subgraphMissingChains }` (root-level)
- **`GET /campaigns/forecast-states`**
  - `requested` – number of requested campaign IDs (root-level)
- **`GET /meta/side-data`** → `fdv.items[]`
  - `source` – per-item source label (e.g. coingecko)

All other response fields are used (for display, simulation, or caching).
