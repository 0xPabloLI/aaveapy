# Aave APY

A React dashboard for displaying Aave V3 market data with yield comparisons across multiple chains.

🌐 **Live**: [aaveapy.com](https://aaveapy.com)

📦 **Backend Repo**: [aave-protocol-analysis](https://github.com/0xPabloLI/aave-protocol-analysis)

## Features

- **Multi-chain Support**: View Aave V3 markets across Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche, and more
- **Yield Comparison**: Compare supply/borrow APYs across all supported chains
- **Incentive Tracking**: Track additional yield from Merit, Merkl, and Brevis programs
- **Merkl Forecast**: Estimate next-run Merkl daily rewards/APR for hypothetical deposit amounts
- **Real-time Data**: Fetched from your configured API base (`VITE_API_BASE_URL`); when unset locally, the app defaults to staging (`https://staging-api.aaveapy.com/api`). Production is [api.aaveapy.com](https://api.aaveapy.com).
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
cp .env.example .env.local
```

Then update values as needed:

```bash
# API base URL (optional). If omitted, the app uses staging API (see src/lib/apiBase.ts).
# Point at production, local backend, or Railway — see docs/conventions/api-base-urls.md
VITE_API_BASE_URL=http://localhost:3001/api
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (auto-clears Vite dep cache) |
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

Canonical source: [`docs/frontend-data-loading-matrix.md`](docs/frontend-data-loading-matrix.md).

Docs ownership index: [`docs/DOCS-INDEX.md`](docs/DOCS-INDEX.md).

PR batching and automerge conventions: [`docs/PR_ANALYSIS.md`](docs/PR_ANALYSIS.md). Merge hygiene, `/merge`, and review-thread rules: [`AGENTS.md`](AGENTS.md) (see Commit & Pull Request Guidelines).

Vercel post-deploy smoke test, deploy SHA meta tag, and rollback behavior: [`docs/conventions/vercel-deployment-smoke-test.md`](docs/conventions/vercel-deployment-smoke-test.md).

Quick rule:
- Keep one snapshot source per UI state.
- Prefer endpoint-level TTL and centralized stale-time buckets.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting and a public-release security checklist.

## Docs Quick Start

| If you need... | Read this first |
|---|---|
| Project look and feel | [`docs/design/DESIGN.md`](docs/design/DESIGN.md) |
| Reusable design rules | [`docs/design/DESIGN-SYSTEM-REFERENCE.md`](docs/design/DESIGN-SYSTEM-REFERENCE.md) |
| Project-specific UI behavior | [`docs/design/frontend-interaction-guardrails.md`](docs/design/frontend-interaction-guardrails.md) |
| Engineering conventions to migrate | [`docs/conventions/README.md`](docs/conventions/README.md) |
| Docs ownership map | [`docs/DOCS-INDEX.md`](docs/DOCS-INDEX.md) |
| **Reusable docs index (what to migrate)** | [`docs/DOCS-INDEX.md`](docs/DOCS-INDEX.md) |

## Merkl Forecast Notes

- Forecast state is loaded from `GET /meta/side-data` (`forecast.items`).
- Frontend forecast math only changes hypothetical TVL (based on user input amount * token price).
- Campaign type and regime are rendered from forecast state + local calculation (`APR_CAPPED`, `CATCHING_UP`, `PLANNED`).
- Canonical formulas and semantics: [`docs/rate-calculation.md`](docs/rate-calculation.md).

## CoinGecko Token Price Fallback

- Primary source is backend snapshot token prices from `GET /markets`.
- CoinGecko fallback runs only when required reserve token prices are missing from snapshot data.
- Canonical behavior and endpoint details: [`docs/frontend-data-loading-matrix.md`](docs/frontend-data-loading-matrix.md) (`Forecast Token Price Backup`).

## License

[MIT](LICENSE)

## Author

**0xPabloLI** - [@0xPabloLI](https://github.com/0xPabloLI)
