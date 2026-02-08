# Aave APY

A React dashboard for displaying Aave V3 market data with yield comparisons across multiple chains.

🌐 **Live**: [aaveapy.com](https://aaveapy.com)

## Features

- **Multi-chain Support**: View Aave V3 markets across Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche, and more
- **Yield Comparison**: Compare supply/borrow APYs across all supported chains
- **Incentive Tracking**: Track additional yield from Merit, Merkl, and Brevis programs
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
# Note: .npmrc has Linux platform settings for deployment
# Override for local development:
#   macOS:   NPM_CONFIG_PLATFORM=darwin npm i
#   Windows: NPM_CONFIG_PLATFORM=win32 npm i
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:8080`.

### Environment Variables

Create a `.env` file:

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

## License

[MIT](LICENSE)

## Author

**0xPabloLI** - [@0xPabloLI](https://github.com/0xPabloLI)
