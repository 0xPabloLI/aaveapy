# Aave APY

A React dashboard for displaying Aave V3 market data with yield comparisons across multiple chains.

🌐 **Live**: [aaveapy.com](https://aaveapy.com)

## Features

- **Multi-chain Support**: View Aave V3 markets across Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche, and more
- **Yield Comparison**: Compare supply/borrow APYs across all supported chains
- **Incentive Tracking**: Track additional yield from Merit, Merkl, and Brevis programs
- **Merkl Forecast**: Estimate next-run Merkl daily rewards/APR for hypothetical deposit amounts
- **Real-time Data**: Data fetched from [api.aaveapy.com](https://api.aaveapy.com)
- **Mobile Friendly**: Responsive design with optimized mobile experience

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS + shadcn/ui
- **Data Fetching**: TanStack Query

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/0xPabloLI/aaveapy.git
cd aaveapy

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:8080`.

### Environment Variables

Create your local environment file from the example:

```bash
cp .env.example .env
```

Then update values as needed:

```bash
# API base URL (optional, defaults to https://api.aaveapy.com/api)
VITE_API_BASE_URL=http://localhost:3001/api
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests |
| `npm run preflight:release` | Fast release readiness checks |

Full checks (includes lint/build/audit):

```bash
npm run preflight:release -- --full
```

## Data Freshness Policy (Frontend)

React Query staleTime config is centralized in `src/config/queryStaleTimes.ts`.

| Bucket | staleTime | Scope | Reasoning |
|---|---:|---|---|
| `marketApi` | 60s | `/markets` `/markets/stats` `/markets/list` | Same backend snapshot family, so freshness must stay aligned across views. |
| `coingeckoFdv` | 10m | `/coingecko-fdv` | Relevant for ranking/valuation UX, but not execution-critical; reduces external API pressure. |
| `tokenCategories` | 6h | `/coingecko-categories` | Low-change metadata, long cache window is acceptable. |
| `coingeckoTokenImage` | 24h | Coin symbol -> image lookup | Icon changes are infrequent; long cache + long GC avoids repeated fetches. |

Rule of thumb:
- Same-source snapshot data should share staleTime.
- External-source data should be bucketed by change frequency and quota cost.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting and a public-release security checklist.

## Merkl Forecast Notes

- Forecast state is loaded from backend:
  - `GET /api/campaigns/forecast-states`
  - `GET /api/campaigns/:campaignId/forecast-state`
- Frontend forecast math only changes hypothetical TVL (based on user input amount * token price).
- Token price is resolved from `/api/markets` `tokenPrices` first, with backup lookup if missing.
- Campaign type and regime are rendered from forecast-state + local calculation (`APR_CAPPED`, `CATCHING_UP`, `PLANNED`).

## License

[MIT](LICENSE)

## Author

**0xPabloLI** - [@0xPabloLI](https://github.com/0xPabloLI)
