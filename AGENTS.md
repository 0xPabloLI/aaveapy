# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React + TypeScript app. Key areas: `src/pages/` for routes, `src/components/` for UI and dashboard pieces, `src/hooks/` for reusable logic, `src/lib/` for helpers, `src/types/` for shared types.
- `public/` holds static assets (icons, robots.txt, favicon).
- `dist/` is build output from Vite. Treat as generated.
- `docs/` holds living implementation notes (e.g. `docs/design/frontend-interaction-guardrails.md` for tooltip/search/forecast UI, desktop reserves **sticky stack + scrollport**, and **Simulation pin scroll (normative)** — scenario-key + sort-order gated pinning; `docs/PR_ANALYSIS.md` for PR merge and batching strategy).

## Build, Test, and Development Commands
- `npm run dev`: start the Vite dev server with hot reload.
- `npm run build`: production build into `dist/`.
- `npm run build:dev`: build using the development mode config.
- `npm run preview`: serve the production build locally.
- `npm run lint`: run ESLint across the codebase.

## Coding Style & Naming Conventions
- Language: TypeScript + React (TSX). Prefer functional components and hooks.
- Indentation: 2 spaces (match existing TS/TSX files).
- Naming: `PascalCase` for components/types, `camelCase` for functions/variables, `kebab-case` for asset files.
- Incentive constraints: keep API field names as returned by the backend (e.g. `perUserRewardCapUsd`). In new domain code, prefer *ceiling* naming (`depositCeilingUsd`, `rewardCeilingUsd`) and route simulation copy through `src/lib/incentiveCeilings.ts`; UI props remain `capNote` / `capWarning` (see `docs/rate-calculation-formulas.md` § Naming layers).
- Styling: Tailwind CSS classes in components; base styles live in `src/index.css` and `src/App.css`.
- Linting: ESLint config in `eslint.config.js`; keep `dist/` excluded.

## Testing Guidelines
- No test runner is configured in `package.json`. If you add tests, document the framework and add a script (e.g., `npm test`).
- Suggested conventions: co-locate tests under `src/` with `.test.ts(x)` names.

## Commit & Pull Request Guidelines
- Commit messages use short, imperative subjects with initial caps (e.g., `Fix leverage opportunity spread sign`, `Add logos to all markets`).
- PRs should include a concise description, link related issues, and add screenshots for UI changes. Note any manual testing you performed.

### Merge commits (see `docs/conventions/merge-summary.md`)
- Every merge (branch merge or conflict resolution) must have a **summary** in the commit body and/or PR description/comment. Summary = branches merged, conflicted files, resolution per file, optional follow-up. Full reusable convention: `docs/conventions/merge-summary.md` (copyable to other projects).
### PR Merge Strategy (see `docs/PR_ANALYSIS.md`)
- **Batch related changes**: Combine small optimizations, config/tool updates, and dependency bumps (minor/patch) into one PR when they belong together (e.g. "chore: token icon and config improvements").
- **Minimum scope**: Prefer opening a PR when there is a meaningful batch (e.g. several related files or 3+ related changes) rather than one-off micro-PRs.
- **Keep separate**: New features (independent review), bugfixes (fast merge), breaking changes (discuss first), and security updates (immediate) should be separate PRs.
- **Automerge**: Chore/docs/refactor PRs with no breaking changes and passing CI may use the `automerge` label per repo workflows.

## API Contract & Dependency Safety
- When backend API response format changes, follow `docs/conventions/api-contract-checklist.md` to ensure all consumers (types, schemas, hooks, scripts) are updated. If CI live schema fails with Cloudflare 403 from GitHub Actions, see `docs/conventions/ci-live-schema-cloudflare.md`.
- When upgrading React or other core libraries, follow `docs/conventions/peer-dependency-guard.md` to prevent version mismatch white-screen issues.
- Primary app reads from the backend: `GET /markets` and `GET /meta/side-data` (via `VITE_API_BASE_URL` / `src/lib/apiBase.ts`); rate simulation is computed client-side—there is no dedicated simulation endpoint.
- `forecast.errors[]` in side-data maps to `forecastErrors`; Merkl campaigns without forecast state fall back to current APR in simulation; `forecastUnavailableCampaignCount` signals partial forecast coverage.

## Configuration & Secrets
- Use `.env` for local secrets and keep it out of version control.

## Local Git Hook Policy (Mandatory)
- This repo uses local `pre-commit` and `pre-push` hooks to run `npm run ci:remote`.
- If `ci:remote` fails, hooks must automatically attempt `npm run ci:auto-fix`, then rerun `ci:remote`.
- If checks still fail after auto-fix, stop the commit/push and fix the root cause before retrying.
- Do not bypass hooks as a normal workflow.
- Treat hook failures as release blockers for branch updates.

## UI Regression Guardrails
- When changing incentive tooltip behavior, search filtering, or forecast display semantics, review and update `docs/design/frontend-interaction-guardrails.md` in the same work session.
- When changing desktop `ReservesTable` **overflow wrappers**, **sticky** scenario/`thead` stacking, **debounced scenario** wiring, **`sortedData` sort**, or **simulation expand scroll**, follow and preserve **§ Desktop reserves table: sticky stack and scrollport (normative)** and **§ Simulation pin scroll (normative)** in `docs/design/frontend-interaction-guardrails.md` (single effect after `sortedData`; `scrollExpandedSimulationIntoView` + `data-reserves-*` DOM contract).
- Reusable design habits and interaction patterns are consolidated in `docs/design/DESIGN-SYSTEM-REFERENCE.md`; update that doc when adding or changing cross-project design rules.

---

## Frontend Design & UX Skills

### Mobile-First Responsive Design
- **Breakpoints**: Use Tailwind's default breakpoints (sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px)
- **Mobile Detection**: Use `useIsMobile()` hook from `@/hooks/use-mobile` (breakpoint: 768px)
- **Responsive Patterns**:
  - Mobile: Single column, full-width cards, touch-friendly targets (min 44x44px)
  - Tablet: 2-column grids, optimized spacing
  - Desktop: Multi-column layouts (3-4 columns), hover states, more whitespace
- **Carousel/Swiper**: Use `embla-carousel-react` for mobile carousels. Always include:
  - Pagination indicators (dots) that update with current slide
  - Navigation arrows (left/right) positioned on card edges
  - Peek effect: show ~15% of adjacent cards (`basis-[85%]`)
  - Smooth scroll snap with `align: "center"` and `containScroll: "trimSnaps"`

### UI/UX Best Practices
- **Visual Hierarchy**:
  - Use consistent spacing scale (gap-2, gap-3, gap-4)
  - Maintain visual weight: primary actions > secondary > tertiary
  - Color coding: success (green), warning (amber), error (red), info (blue)
- **Accessibility**:
  - All interactive elements must have `aria-label` or visible text
  - Keyboard navigation support (Tab, Enter, Arrow keys)
  - Focus states visible (`focus-visible:ring-2`)
  - Color contrast meets WCAG AA (4.5:1 for text)
- **Loading & Empty States**:
  - Always show loading skeletons matching final layout
  - Provide helpful empty state messages with actionable guidance
  - Use `AnimatePresence` from framer-motion for smooth transitions
- **Touch Interactions**:
  - Swipe gestures for carousels and mobile navigation
  - Pull-to-refresh for data updates (use `PullToRefresh` component)
  - Avoid hover-only interactions on mobile (use tap/click)

### Component Design Patterns
- **Card Components**:
  - Use `glass-card` class for frosted glass effect
  - Consistent padding: `p-3` (mobile), `p-5` (desktop)
  - Rounded corners: `rounded-xl` for cards, `rounded-lg` for inner elements
  - Subtle borders: `border border-border`
- **Animations**:
  - Use `framer-motion` for complex animations
  - Keep animations subtle: duration 0.2-0.4s, ease `[0.25, 0.1, 0.25, 1]`
  - Stagger animations for lists: `delay: 0.2 + i * 0.08`
  - Hover effects: `hover:bg-accent`, `hover:scale-105` (subtle)
- **Typography**:
  - Headings: `font-bold`, sizes: `text-sm` (mobile) → `text-base` (desktop)
  - Body: `text-muted-foreground` for secondary text
  - Numbers: Always use `tabular-nums` for alignment
  - Truncate long text: `truncate` with `min-w-0` on parent

### Data Visualization
- **APY/APR Display**:
  - Color coding by value ranges (see `getApyColorClass` in TopOpportunities)
  - Format: Use `formatPercent()` and `formatSpread()` from `@/lib/formatters`
  - Show breakdown: Native + Incentive with `+` separator
  - Incentive badges: amber background (`bg-amber-50 text-amber-600`)
- **Tables & Lists**:
  - Mobile: Card-based layout (see `MobilePoolCard`)
  - Desktop: Table layout with sortable columns
  - Always show sort indicators and active state
- **Tooltips**:
  - Use `IncentiveTooltip` for static incentive breakdowns (dates, messages, Merkl whitelist toggles); do not duplicate text already in campaign messages or put deposit/TVL forecasts here—those belong in the expanded shared simulation (`SimulationSubRow` / `useRateSimulation` per-campaign rows and `capNote`).
  - Position dynamically based on trigger element
  - Close on outside click or Escape key

### Performance Optimization
- **Code Splitting**: Use React.lazy() for route-level splitting
- **Image Optimization**: Use WebP format, lazy loading, proper sizing
- **Bundle Size**: Keep components small, avoid heavy dependencies
- **Re-renders**: Use `React.memo()` for expensive components, `useMemo()` for calculations
- **Animations**: Prefer CSS transforms over layout properties (translate, scale, opacity)

### Design System Reference
- **Colors**: Defined in `tailwind.config.ts` - use semantic tokens (primary, secondary, success, warning)
- **Components**: Use shadcn/ui components from `@/components/ui/`
- **Icons**: Use `lucide-react` for consistent iconography
- **Spacing**: Follow 4px base unit (0.5rem = 8px, 1rem = 16px)
- **Shadows**: Use predefined shadow scale (sm, md, lg, xl)

### Mobile-Specific Patterns
- **Carousel Implementation**:
  ```tsx
  // Always include these features:
  - Pagination dots at bottom
  - Navigation arrows (conditional, only when scrollable)
  - Peek effect (basis-[85%] for 15% peek)
  - Smooth scroll snap
  - Touch/swipe support
  ```
- **Grid to Carousel**: Convert grid layouts to carousels on mobile
- **Touch Targets**: Minimum 44x44px for all interactive elements
- **Swipe Gestures**: Support left/right swipe for navigation
- **Pull to Refresh**: Use `PullToRefresh` wrapper component

### Example: Mobile Carousel Pattern
When implementing mobile carousels:
1. Check `isMobile` hook
2. Use `Carousel`, `CarouselContent`, `CarouselItem` from `@/components/ui/carousel`
3. Track state: `current`, `canScrollPrev`, `canScrollNext`
4. Add pagination dots with click handlers
5. Show navigation arrows conditionally
6. Set `basis-[85%]` for peek effect
7. Use `align: "center"` for centered snap

## Learned User Preferences
- Prefer Chinese for collaboration and implementation discussions; prefer direct execution after confirmation (e.g. "直接执行", "继续", "你来处理"), including verifying and reproducing issues yourself; prefer evidence-based diagnosis with concrete runtime artifacts (CI logs, live API responses) before concluding root cause.
- Avoid default values for missing API or backend fields; keep schema and code minimal.
- For large design or architectural changes, provide a 方案 (plan) first without modifying code when asked (e.g. "先给我方案不要直接修改").
- When summarizing many items (APIs, options), use tables for clarity (表格形式，一目了然).
- Follow explicit visual descriptions and scoped regions precisely (e.g. "竖线" → vertical, "圆环" → ring); keep complementary UI symmetric (e.g. Supply/Borrow placement); when the user caps work to named areas and forbids global tokens or unrelated components, stay within that scope.
- Tooltip content should not repeat information already visible in the parent; selection and toggle state must be visually obvious (borders/contrast), not subtle opacity or background alone. For paired opt-in states (e.g. Merkl whitelist rows counting toward totals), prefer very short symmetric labels; when the visible label is minimal, give the control a full accessible name via `aria-label`.
- In simulation incentive breakdown rows, avoid showing opaque identifiers (e.g. `campaignId` suffixes) or campaign-type labels when they don’t help users; when multiple rows share the same display name, use a simple `#1/#2/...` disambiguator regardless of scenario input, and prefer placing outbound incentive links on the specific expanded row rather than the aggregate row. Prefer short, plain-language simulation labels; avoid abstract budget or eligible-ratio lines unless the meaning is obvious to users.
- Reserve semantic colors for their purpose; avoid introducing new colors just to show selection/active state (prefer neutral borders + thickness/contrast). Keep each UI element focused on one semantic role (e.g. amber for alerts only, not regular data). When implementing the same control on mobile and desktop, reuse the same design tokens and visual style; only layout may differ (e.g. vertical vs horizontal). For utilization vs optimal (kink), use borrow-aligned brand cyan for the below-optimal zone (not emerald); keep amber for above-optimal (past kink / tighter pool), not green. Prefer fewer opacity steps within the same hue for utilization (one zone tint + full semantic for marker and labels; see `docs/design/frontend-interaction-guardrails.md`). **Data markers** (e.g. utilization dot): prefer stronger fill or slightly larger radius—avoid outline/stroke halos as a default decorative habit.
- Multi-column panels (e.g. simulation Supply/Spread/Borrow): use equal column widths and uniform compression; do not give one column fixed or favored width. Bordered UI (including tables) must keep clear breathing room between text and borders; when space is tight prefer wrapping over ellipsis. For TVL-gated incentive APR cap messaging when current pool TVL is not shown in the same surface, avoid displaying numeric TVL thresholds; use qualitative copy (e.g. APR capped for low TVL) instead of computed dollar cutoffs.
- Mobile reserve collapsed row and expand affordance should read as opening the full reserve simulation/detail, not only spread; prefer familiar expand patterns over novel decorative divider treatments.
- **UI geometry & SVG**: Fix root cause with a single contour source—no patch-on-top-of-patch. For 1px strokes use half-pixel alignment; for inner module corners prefer one path (vertical + `A` arc + horizontal) with locally disconnected underlying borders over stacked masks and hand-tuned cubic Béziers when a quarter-circle fits.
- Repo `/sync` means full **git** sync with remote: `fetch`, inbound update (`pull --ff-only`, or **stash → `pull --rebase` → stash pop** when diverged—**stop for confirmation** on conflicts), then **`git push` when the branch is ahead** of upstream; use **`push --force-with-lease`** only when the user explicitly updates remote after rewriting published history. **Artifact** sync stays separate (`artifacts-all` or individual `sync:*` npm targets). Keep **`.claude/commands/sync.md`** and **`~/.cursor/commands/sync.md`** aligned; treat the repo file as source of truth when they drift.

## Learned Workspace Facts
- Mobile overlays (cap details, incentive details) use bottom sheet with title bar and close button, not floating popover; see docs/design/frontend-interaction-guardrails.md.
- Aave reserve `optimalUsageRate` (and similar on-chain rate fields) is RAY; convert to a display percent with `Number(value) / 1e25` or reuse `simulation.utilization.optimal` from rate simulation—never treat the raw integer as a 0–1 fraction and multiply by 100.
- Mobile Top Opportunities mini cards do not link out to external Aave URLs; elsewhere, shared helpers in `src/lib/externalNavigation.ts` open external URLs in the same tab on mobile and a new tab on desktop where that pattern is applied.
- Mobile reserve simulation: utilization and `UtilizationIndicator` should match desktop/`ReservesTable` scenario-based utilization when simulating; do not drive full-page `scrollTo` from expanded-row index changes when `sortedData` reorders; pinning scroll is only the scenario-key + sort-order path documented as **Simulation pin scroll** in `docs/design/frontend-interaction-guardrails.md`, not expand-only. Desktop pinning is implemented via `scrollExpandedSimulationIntoView` (sticky scenario and thead per the normative desktop reserves table section there). The expanded simulation block should read as one piece with its parent card only—no visual overlap with neighboring cards.
- `.github/dependabot.yml` uses `open-pull-requests-limit: 0` for npm/github-actions so Dependabot **version** PRs are off (an empty `updates: []` list did not reliably stop version PRs here); security-related dependency PRs can still be opened when Dependabot security updates are enabled in GitHub repo settings (Code security and analysis).
- Prefer deriving values client-side when possible rather than adding backend fields; borrow availability is `min(Pool Liquidity, Borrow Cap Remaining)` (e.g. totalBorrowedUsd from reserveSizeUsd × utilizationPct).
- Desktop reserves: **Spread** uses **`font-bold`** and purple semantic color (same weight tier as Supply/Borrow APY totals); **Size** Supply/Borrow amounts use the same tokens as those APY primaries (`ds-text-emerald-500` / `ds-text-brand-cyan`) with `font-medium tabular-nums` next to cap rings; **Native/Incentive** rows under APY use smaller `ds-text-11` + `*-70` (secondary tier—not the same spec as Size).
- Merkl `whitelistOnly` campaigns are excluded from incentive totals until the user opts in via `whitelistMerklCampaignIds` (per `campaignId`, or a fixed sentinel when `campaignId` is missing after trim); default is none selected; see `docs/design/frontend-interaction-guardrails.md` § Merkl whitelist-only campaigns. For APR from a breakdown, prefer `campaignApr > 0` over Tydro-points conversion when both exist. For points-style Merkl rows (`campaignApr` not positive and `pointsPerThousandUsd` set), treat API budget and flow fields used in forecast (`totalBudget`, `plannedDaily`, `requiredDaily`, `distributedSoFar`, `latestTvl`, etc.) as **points-denominated** until explicitly converted to USD—do not assume USD from the payload alone. In rate simulation, native Aave rates use capped supply and borrow token amounts together; Merit/Merkl incentive forecasts use per-lane USD (`supplyInputUsd` / `borrowInputUsd`) for hypothetical TVL, not a single shared TVL field with native.
- Desktop `ReservesTable` bridge **inner corners** between hero cards and the list: prefer a single SVG path per corner (local border disconnect + vertical / `A` arc / horizontal) over iterative mask tweaks; half-pixel alignment for 1px strokes.
- Local git hooks live under the repository `.git/hooks` (local-only, not versioned); pre-push runs lockfile consistency checks before `ci:remote`. When bulk-deleting remote branches with `git push origin --delete`, use `--no-verify` so each delete does not run the pre-push hook (ci:remote).
- Merit Self deposit ceiling (`selfCapUsd`) is parsed from `MeritIncentive.message` via `extractMeritSelfCapUsd` in `meritForecast.ts` (no separate API cap field). Merit Base forecast (`meritForecast.ts`, `useRateSimulation`): when `reserveSizeUsd` is available, anchor daily rewards with reserve TVL × headline Base APR (supply); borrow-side Merit uses `reserveSizeUsd × utilizationPct` as TVL proxy; otherwise fall back to `lastRoundRewardUsd`. See `docs/rate-calculation-formulas.md` § Merit Base reserve TVL anchor and `docs/merit-base-anchor-vs-last-round-staging.md` for anchor vs last-round staging comparison.
- Brevis incentive forecasting lives in `src/lib/brevisForecast.ts` with per-user reward caps (`perUserRewardCapUsd`), canonical shared campaigns keyed by `campaignId`, and `isCampaignActive(allowOpenEnd: true)` for campaigns without `endDate`. Incentive reward cap taxonomy (pool budget / deposit ceiling / per-user reward ceiling) and rate formulas are documented in `docs/rate-calculation-formulas.md`. When both a per-user reward ceiling and a campaign end date limit the accrual window, use the minimum of the applicable horizons for effective reward-duration semantics.

## Cursor Cloud specific instructions

### Services overview
This is a **client-side only** React SPA (no backend in this repo). The sole required service is the Vite dev server (`npm run dev`, port 8080). All data comes from a remote REST API; with no `.env` file the app defaults to `https://staging-api.aaveapy.com/api` (set in `src/lib/apiBase.ts`), so no local backend or database is needed.

### Quick reference
| Task | Command |
|------|---------|
| Dev server | `npm run dev` (port 8080) |
| Lint | `npm run lint` |
| Unit tests | `npm test` (Vitest) |
| Build | `npm run build` |
| Live schema tests | `npm run test:live` (hits staging API) |

All commands are documented in the `README.md` Scripts table and `package.json`.

### Non-obvious caveats
- `npm run dev` runs `scripts/generate-token-icon-manifest.mjs` before starting Vite; if `public/token-icons/` changes, the generated manifest at `src/lib/tokenIconManifest.generated.ts` will be regenerated automatically.
- No `.env` file is needed for basic development; the staging API fallback is baked into `src/lib/apiBase.ts`. Only create `.env` if you need to override `VITE_API_BASE_URL` (e.g. to point at a local backend).
- The repo uses local git hooks (`.git/hooks/`) for `pre-commit` and `pre-push` that run `npm run ci:remote`. These hooks are not version-controlled and will not be present in a fresh clone. They are not required for cloud agent operation.
- `npm run ci:remote` runs lint + test + build + audit sequentially; if it fails, `npm run ci:auto-fix` attempts remediation.
- Supabase client code exists under `src/integrations/supabase/` but is dead code (not imported by any application module); ignore it.
