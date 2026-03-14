# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React + TypeScript app. Key areas: `src/pages/` for routes, `src/components/` for UI and dashboard pieces, `src/hooks/` for reusable logic, `src/lib/` for helpers, `src/types/` for shared types.
- `public/` holds static assets (icons, robots.txt, favicon).
- `dist/` is build output from Vite. Treat as generated.
- `docs/` holds living implementation notes (for example `docs/frontend-interaction-guardrails.md` for tooltip/search/forecast UI pitfalls).

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
- Styling: Tailwind CSS classes in components; base styles live in `src/index.css` and `src/App.css`.
- Linting: ESLint config in `eslint.config.js`; keep `dist/` excluded.

## Testing Guidelines
- No test runner is configured in `package.json`. If you add tests, document the framework and add a script (e.g., `npm test`).
- Suggested conventions: co-locate tests under `src/` with `.test.ts(x)` names.

## Commit & Pull Request Guidelines
- Commit messages use short, imperative subjects with initial caps (e.g., `Fix leverage opportunity spread sign`, `Add logos to all markets`).
- PRs should include a concise description, link related issues, and add screenshots for UI changes. Note any manual testing you performed.

## Configuration & Secrets
- Use `.env` for local secrets and keep it out of version control.

## Local Git Hook Policy (Mandatory)
- This repo uses local `pre-commit` and `pre-push` hooks to run `npm run ci:remote`.
- If `ci:remote` fails, hooks must automatically attempt `npm run ci:auto-fix`, then rerun `ci:remote`.
- If checks still fail after auto-fix, stop the commit/push and fix the root cause before retrying.
- Do not bypass hooks as a normal workflow.
- Treat hook failures as release blockers for branch updates.

## UI Regression Guardrails
- When changing incentive tooltip behavior, search filtering, or forecast display semantics, review and update `docs/frontend-interaction-guardrails.md` in the same work session.

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
  - Use `IncentiveTooltip` for detailed incentive breakdowns
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
- Prefer Chinese for collaboration and implementation discussions.
- Prefer direct execution after confirmation (for example when saying "直接执行", "继续", or "你来处理"), including verifying and reproducing issues yourself (e.g. restart dev server, check API) instead of asking the user to do steps.
- Prefer evidence-based diagnosis with concrete runtime artifacts (such as CI logs and live API responses) before concluding root cause.
- Avoid default values for missing API or backend fields; keep schema and code minimal (e.g. no fallback values when the backend omits a field).
- For large design or architectural changes, provide a 方案 (plan) first without modifying code when the user asks (e.g. "先给我方案不要直接修改").
- When summarizing many items (e.g. APIs, warmup order, options), use tables for clarity (表格形式，一目了然).
- Follow explicit visual descriptions precisely (e.g., when user says "竖线" use vertical, not horizontal; when user says "圆环" use ring, not bar).
- Maintain design symmetry when adding complementary UI elements (e.g., if Supply info is in Size column, related Borrow info placement should be consistent).
- Tooltip content should not repeat information already visible in the parent element; only show supplementary context.
- Reserve semantic colors exclusively for their intended purpose (amber/warning for alerts only, not for regular data display).
- Non-core data fields (like Utilization) should use normal font weight, same as Price/Size; only core metrics (APY) get bold.
- Toggle/selection state changes must be visually obvious; subtle differences (e.g., slight opacity or background changes) are insufficient—use border color or other clear indicators.
- Visual elements in the same conceptual family should use the same color (e.g., Supply Size and Supply APY both green; Liquidity and Spread both purple).
- When switching input modes (USD/Token), clear existing values to avoid confusion from different token valuations.
- When only one item in a category (e.g., single incentive source), show it directly without a summary row.
- If APY only has Native (no incentives), don't show Native breakdown row; put the link arrow on APY row directly.
- Clickable breakdown items (Native, Incentive links) should not show underline on hover; the external link icon already indicates clickability.
- Use consistent typography hierarchy across related cards: titles same style, column headers same style, values same style.
- Grid layouts should use symmetric column counts (3x3, 4x4) for visual balance; avoid uneven column counts.
- Secondary info (like cap values "/ $20.00M") should use smaller font than main values, but not too small to read.
- Text content should never touch container edges; always maintain breathing room with proper padding (e.g., px-4 not px-2).
- Vertical and horizontal padding must be consistent throughout a component; if top has py-2, bottom must also have py-2. Same for left/right edges.
- Decorative borders (like indent indicators for nested items) should stay within text content boundaries; use inline elements (e.g., `ml-2 pl-2 border-l`) rather than negative margins that extend beyond alignment.
- Indent indicator borders should use contextual colors matching their parent section: emerald for Supply (`border-l-[rgb(var(--ds-emerald-500-rgb))]`), cyan for Borrow (`border-l-[rgb(var(--ds-brand-cyan-rgb))]`).
- Data values should have explicit labels when meaning is unclear; e.g., "Cap $20M" not just "/ $20M" to avoid ambiguity.
- When a section has no title, still maintain header row height for visual alignment with adjacent columns.
- In multi-column layouts, all columns should have the same outer dimensions for visual balance; don't vertically center shorter columns.

## Learned Workspace Facts
- Local git hooks in this setup are managed under the main repository `.git/hooks` and are local-only (not versioned).
- This workspace currently uses a local pre-push flow that runs lockfile consistency checks before the existing `ci:remote` checks.
- Prefer deriving values client-side when possible rather than adding backend fields (e.g., totalBorrowedUsd can be computed from reserveSizeUsd × utilizationPct).
- Borrow availability is constrained by BOTH pool liquidity AND borrow cap: `Available = min(Pool Liquidity, Borrow Cap Remaining)`.
