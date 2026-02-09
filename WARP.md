# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**Aave APY** is a React frontend dashboard for displaying Aave V3 market data with yield comparisons across multiple chains. It fetches data from a backend API (`api.aaveapy.com`) and displays supply/borrow APYs, incentive programs (Merit, Merkl, Brevis), and provides filtering/sorting capabilities.

**Tech Stack**: Vite + React 18 + TypeScript + TailwindCSS + shadcn/ui + TanStack Query

## Development Commands

```bash
npm install              # Install dependencies (see platform notes below)
npm run dev              # Start Vite dev server (http://localhost:8080)
npm run dev:production   # Dev server using production API
npm run build            # Production build → dist/
npm run build:dev        # Development build
npm run preview          # Preview production build locally
npm run lint             # Run ESLint
npm run test             # Run Vitest tests
```

### Platform-Specific Installation
The `.npmrc` file contains Linux platform settings for Lovable deployments. Override during local development:
```bash
# macOS
NPM_CONFIG_PLATFORM=darwin npm i

# Windows
NPM_CONFIG_PLATFORM=win32 npm i

# Linux (uses .npmrc defaults)
npm i
```

## Code Architecture

### Directory Structure
```
src/
├── pages/           # Route components (Index.tsx is main page)
├── components/
│   ├── dashboard/   # Main dashboard components
│   │   ├── PoolsTable.tsx        # Main data table (desktop table, mobile cards)
│   │   ├── TopOpportunities.tsx  # Top yield opportunities carousel/cards
│   │   ├── FilterBar.tsx         # Search, market, category filters
│   │   ├── IncentiveTooltip.tsx  # Detailed incentive breakdown popup
│   │   ├── InkAprCalculator.tsx  # Tydro/INK APR calculator widget
│   │   └── MobilePoolCard.tsx    # Card layout for mobile
│   ├── ui/          # shadcn/ui primitives
│   └── primitives/  # Custom base components
├── hooks/
│   ├── useAaveMarkets.ts   # Data fetching with TanStack Query + localStorage cache
│   ├── use-mobile.tsx      # Mobile breakpoint detection (768px)
│   └── usePreloadPoolAssets.ts  # Icon preloading optimization
├── lib/
│   ├── formatters.ts       # APY/APR formatting, percent formatting
│   ├── sorters.ts          # Pool sorting utilities
│   ├── cache.ts            # localStorage cache utilities
│   ├── tokenCategories.ts  # Token categorization (stablecoins, ETH, BTC)
│   └── tydro.ts            # Tydro points conversion constants
├── types/
│   └── aave.ts             # TypeScript interfaces for API data
```

### Data Flow
```
Backend API (api.aaveapy.com) → useAaveMarkets hook → localStorage cache → Components
```

**Key Endpoints**:
- `GET /api/markets` - All market data (sorting/filtering done client-side)
- `GET /api/markets/stats` - Statistics (pool/chain/token counts)
- `GET /api/markets/list` - Market-chain combinations for filter dropdown

**Caching Strategy**: SWR pattern - show cached data immediately, fetch fresh data in background, update on success.

### Key Data Types

```typescript
interface PoolWithSpread {
  marketName: string;           // e.g., "AaveV3Ethereum"
  chainName: string;            // e.g., "Ethereum"
  tokenSymbol: string;          // e.g., "USDC"
  supplyApy?: number;           // Base supply APY (percentage)
  borrowApy?: number;           // Base borrow APY (percentage)
  meritSupplys?: MeritIncentive[];    // Merit APR incentives
  merklSupplys?: MerklOpportunityGroup[];  // Merkl campaign data
  brevisSupplys?: BrevisIncentive[];  // Brevis incentives
  // ... similar for borrow side
}
```

## Configuration & Environment

### Environment Variables
Configure in `.env` (local) or `.env.production`:
```bash
VITE_API_BASE_URL=http://localhost:3001/api  # Backend API URL (default: https://api.aaveapy.com/api)
PORT=8080                                     # Dev server port
```

### TypeScript Configuration
- Path alias: `@/` → `src/`
- ES Modules with `.js` extensions not required (Vite handles it)
- `tsconfig.app.json` for app code, `tsconfig.node.json` for Vite config

## Design System

See `DESIGN.md` for full visual design specifications. Key points:

### Colors
- Primary: Amber gold (#f59b0a)
- Success: Emerald (#38b28c)
- Warning: Orange (#f8a149)
- Brand gradient: Magenta (#c242b1) → Cyan (#23cdbf)

### Component Patterns
- Cards: `glass-card` class for frosted glass effect, `rounded-xl`
- Numbers: Always use `tabular-nums` for alignment
- Mobile: Single column, carousel with 85% basis peek effect
- Desktop: Multi-column grids, table layouts

### Responsive Breakpoints
- Mobile: < 768px (use `useIsMobile()` hook)
- Tablet: 768px - 1024px
- Desktop: > 1024px

## Frontend Patterns

### APY/APR Display
- Use `formatPercent()` from `@/lib/formatters`
- Color coding by value ranges (see `getApyColorClass`)
- Show breakdown: Native APY + Incentive APRs
- Incentive badges use amber background

### Incentive Data Matching
- Merit: Match by `chainId-tokenAddress` keys
- Merkl: Match by chain name + token symbol
- Brevis: Match by `chainId-tokenAddress` index

### Performance Optimizations
- Lazy load `IncentiveTooltip` and `InkAprCalculator`
- Preload token/chain icons during idle time
- Use `React.memo()` and `useMemo()` for expensive calculations
- Vendor chunk splitting in Vite config for optimal caching

## Testing

```bash
npm run test           # Run all tests once
npx vitest             # Watch mode
npx vitest run --coverage  # With coverage
```

Test files use `.test.ts` suffix, co-located in `src/lib/`.

## Common Tasks

### Adding a New Token Category
1. Update `STABLECOINS`, `ETH_RELATED`, or `BTC_RELATED` in `src/types/aave.ts`
2. Or add dynamic overrides via Supabase `token_categories` table

### Adding New Incentive Source
1. Define interface in `src/types/aave.ts`
2. Update `PoolWithSpread` interface
3. Add rendering logic in `IncentiveTooltip.tsx`
4. Update formatters if needed

### Modifying Filter/Sort Logic
- Filters: `src/pages/Index.tsx` → `filteredPools` memo
- Sort: `src/lib/sorters.ts` and `PoolsTable.tsx`

## Gotchas

- **Platform Lock**: `.npmrc` has Linux platform lock for Lovable deployment - use override flags locally
- **API Fallback**: If API fails, app shows cached data with warning banner
- **Frozen Reserves**: Backend excludes frozen/paused reserves automatically
- **Empty Fields**: API omits `undefined` fields and empty arrays from JSON response
