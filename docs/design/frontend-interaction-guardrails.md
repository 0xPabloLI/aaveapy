# Frontend Interaction Guardrails

This note records recurring UI/interaction issues found during incentive/forecast work, so future changes keep behavior consistent.

## A. Frontend-wide guardrails (generic)

### Tooltip / Overlay behavior

- **Distinguish auto-show vs click-to-show tooltips**:
  - **Auto-show tooltip (hover reveals)**: Use `cursor-auto` (lets browser decide naturally). Add subtle hover feedback like `hover:opacity-80`, `hover:scale-[1.12]`, or `hover:bg-muted/70` so the user knows the element is interactive.
  - **Click-to-show tooltip/popover**: Use `cursor-pointer`. Add stronger hover feedback like `hover:ring-2`, `hover:bg-xxx` with increased opacity/saturation.
  - Never use `cursor-pointer` for auto-show tooltips — it implies a click action that doesn't exist.
  - Never use `cursor-help` (question mark cursor) — it's not part of our design system.
- **All interactive elements must have visible hover state**: even auto-show tooltips need visual feedback on hover (e.g. subtle scale, opacity change, or background highlight).
- **Tooltip delay configuration**:
  - Global `TooltipProvider` is set to `delayDuration={200}` (200ms) in `App.tsx`.
  - This only affects Radix UI `Tooltip` components (auto-show tooltips).
  - Custom click-to-show components (e.g. `IncentiveTooltip`) manage their own timing and are not affected by this setting.

#### Implementation examples

**Auto-show tooltip** (e.g. `CapProgressRing`):
```tsx
// cursor-auto lets browser decide, subtle hover feedback
<div className="inline-flex items-center p-0.5 -m-0.5 rounded-full transition-all duration-150 hover:bg-muted/70 hover:scale-[1.12] cursor-auto">
  {/* content */}
</div>
```

**Hybrid tooltip** (mobile: click-to-show, desktop: auto-show, e.g. `InfoIconButton`):
```tsx
// cursor-pointer on mobile (click), cursor-auto on desktop (hover auto-show)
<button className="... cursor-pointer md:cursor-auto">
  <Info className="h-2.5 w-2.5" />
</button>
```

**Click-to-show tooltip** (e.g. incentive badge):
```tsx
// cursor-pointer + stronger hover feedback (ring + bg)
<button
  className="cursor-pointer inline-flex items-center rounded-full px-1 ring-1 transition-all duration-150
    ds-bg-emerald-500-10 ds-text-emerald-500-70 ds-ring-emerald-500-15
    hover:bg-[rgb(var(--ds-emerald-500-rgb)/0.25)] hover:ring-2 hover:ring-[rgb(var(--ds-emerald-500-rgb)/0.3)]
    active:scale-95"
>
  {/* content */}
</button>
```

- **Mobile overlays (弹框) must use bottom-sheet style, not floating popover**:
  - On mobile, any tap-to-open overlay that shows detailed content (e.g. cap details, incentive details) must use the **bottom sheet** pattern: full-width panel from bottom with `rounded-t-2xl`, sticky header with title + close (X) button, and `max-h-[80vh] overflow-y-auto` for the body. Backdrop: `fixed inset-0 z-30 bg-background/20` with click-to-close.
  - Do **not** use a small floating Popover anchored to the trigger on mobile — that is the wrong pattern. Reference: `IncentiveTooltip` (mobile branch) and `MobileReserveCard` cap details sheet.

- **`MobileReserveCard` Supply/Borrow tab vs parent `defaultTab`**: Parent may drive the default tab from sort (e.g. borrow column). Sync in `useEffect` with `setActiveTab(defaultTab ?? 'supply')`. If you only update when `defaultTab` is truthy, switching away from borrow sort leaves `defaultTab` as `undefined` and cards **stay stuck on Borrow** — wrong.

### Text-to-border spacing (mandatory)

- **Text must never touch borders**: Any bordered container (cards, table cells, warning banners, buttons) must have at least `--ds-space-2` (8px) padding between text and the border. See DESIGN.md §5 布局原则.

### Visual consistency

- **Related visual elements must share the same color**: auxiliary indicators (progress rings, icons, badges) placed adjacent to text should inherit from or match that text's color.
  - Example: a cap progress ring next to "14M/15M" should use `currentColor` so it stays visually tied to the size value.
  - Only use distinct accent colors (emerald, amber, red) when conveying semantic status (success, warning, danger), not for decoration.
- **Warning/danger thresholds override base color**: when an indicator crosses a threshold (e.g. >80% utilization), it can switch to amber/red to signal urgency — this is intentional divergence from the adjacent text color.

### Color semantic guidelines (告警色专用原则)

**Reserved semantic colors** — use exclusively for their intended purpose:

| Color | Semantic token | Usage | Examples |
|-------|---------------|-------|----------|
| **Amber/Orange** | `warning`, `text-warning` | ⚠️ Warnings only | Supply cap exceeded, over-optimal utilization, risk alerts |
| **Red** | `destructive` | 🚫 Errors/danger | Transaction failed, critical errors |
| **Green/Emerald** | `success`, `text-emerald-*` | ✅ Normal/positive state | Supply-side highlights, successful actions |

**Non-semantic data display** — use neutral colors:

| Data type | Recommended color | Example |
|-----------|------------------|---------|
| Utilization percentage (desktop) | `text-foreground` | "75.2%" in Utilization column |
| Utilization percentage (mobile header) | `text-foreground` below optimal, `text-amber-600` above optimal | Matches `UtilizationIndicator` zone |
| General numeric data | `text-foreground` | Market size, prices |
| Secondary/muted info | `text-muted-foreground`, `text-secondary` | Labels, descriptions |

**Utilization display value (mobile vs desktop)**:
- Mobile reserve header and bottom sheet must use the same **display** utilization as the desktop Util. column: `hasSharedScenario ? after ?? current : current` from rate simulation (not raw `reserve.utilizationPct` when a scenario is active).

**UtilizationIndicator color scheme**:
- Below optimal (borrow-friendly / flatter borrow curve): `fill-[rgb(var(--ds-brand-cyan-rgb)/0.32)]` on track; dot `fill-[rgb(var(--ds-brand-cyan-rgb))]` — aligns with Borrow (`ds-text-brand-cyan`), not emerald
- Above optimal (past kink: higher borrow, tighter liquidity): `fill-amber-500` on track; dot `fill-amber-700`
- Tooltip: “Below optimal” (cyan) vs “⚠️ Above optimal” (amber)

**Key principle**: Amber/warning colors must NOT be used for regular data display. This ensures that when amber appears, users immediately recognize it as a warning signal.

### Geometry and layout

- **If a UI requirement is stated as exact geometry, implement exact geometry** (not "close enough" heuristics).
  - Example: when the requested top/bottom arrow gap must match, pass full trigger geometry (or at least trigger height) and compute the same gap from trigger edges.
  - Do not ship an approximation first if the requested exact geometry is already available from the trigger element (`getBoundingClientRect()`).
- **Clamp desktop tooltips to viewport**: floating tooltips must not render below the viewport bottom.
  - Use a max height (`max-h`) and internal scroll (`overflow-y-auto`).
  - Recompute position on resize, scroll, and content-size changes (e.g. `ResizeObserver`).
- **Use flip placement before aggressive clamping**: if bottom space is insufficient, prefer rendering above the trigger (and vice versa).
  - Keep a consistent trigger/arrow gap for both placements.
  - Prefer passing trigger geometry (at least trigger height; ideally full trigger rect) into the tooltip so top/bottom gaps can be computed exactly instead of approximated.
  - Add a flip threshold (not just `space < height`) to avoid jitter near the viewport midpoint.
  - If the tooltip is heavily clamped and the arrow can no longer point cleanly to the trigger, hide the arrow rather than showing a misleading one.
- **Do not rely on page scroll for fixed overlays**: fixed-position tooltip content should remain usable even when the underlying page cannot scroll.
- **Whitelist toggles must be scoped**: only show per-tooltip controls when the current reserve/source actually has applicable items (avoid leaking global state into unrelated tooltips).

### Expandable rows and scroll stability

- **Do not drive `window` scroll from “row index changed” while simulation is open**: After expanding, shared simulation updates can change computed sort keys (spread, APY, etc.) and reorder the list. Treating “index in `sortedData` changed” like a user re-sort and auto-scrolling to pin the row feels erratic and often fires even when there is already space below the card.
- **Sort from column headers collapses the expanded row** in `ReservesTable`, so index-based pinning does not correspond to a real “user re-sorted while expanded” flow here.
- **If** we ever need to keep the expanded panel in view, prefer an **intersection-style check** (e.g. whether the panel’s bottom is clipped by the viewport) before adjusting scroll, rather than index-based `window.scrollTo`.

### Search behavior

- **Normalize token symbols for search**: search should match canonical aliases and symbol variants.
  - Example: `USDT` should match `USD₮`.
  - Normalize unicode / punctuation variants before filtering.

### Theme switching behavior

- **Default theme follows system**: on first visit, the app respects `prefers-color-scheme` via `next-themes` with `defaultTheme="system"` and `enableSystem={true}`.
- **Manual toggle is temporary override**: clicking the theme toggle switches between Light ↔ Dark immediately.
- **System change resets to follow system**: when the OS theme changes (e.g. macOS auto Light/Dark schedule), the app automatically calls `setTheme('system')` to re-sync.
  - This prevents the app from being "locked" to a manual choice after the user toggled once.
  - Implementation: `ThemeToggle.tsx` listens to `matchMedia('(prefers-color-scheme: dark)')` change events.
- **Resource cost**: the `matchMedia` listener is event-driven (not polling), triggers only on actual OS theme change, and has negligible overhead.

### Link generation

- Prefer rule-based URL generation with explicit overrides for exceptions.
- Keep hardcoded mappings only for special cases (legacy market names, naming mismatches).

### API schema boundaries

- Use bounded schemas for polymorphic API fields.
  - If an upstream field can be string-or-object-or-array, model that union explicitly.
  - Do not replace uncertain payloads with `z.unknown()` unless the field is truly opaque and never interpreted by the UI.
- Keep runtime validation and TypeScript types aligned.
  - If the parser accepts recursive structured content, the exported type should describe that same recursive shape.
  - Avoid "runtime accepts anything, compile time says something narrower" drift.

## B. AaveAPY-specific guardrails (app-specific)

### API freshness guardrail (`staleTime` + HTTP cache)

- Treat `staleTime` as the single source of truth for **when** the UI should re-check backend freshness.
- For core APY/simulation APIs, backend should use `no-cache + ETag` rather than long browser/edge TTL.
  - This ensures each `staleTime`-triggered refetch performs freshness validation.
  - If data is unchanged, transport cost stays low via `304 Not Modified`.
- Avoid broad assumptions like "HTTP cache replaces React Query staleTime".
  - `staleTime` controls fetch schedule.
  - HTTP cache controls response delivery path and payload size.
- For side-data (lower business criticality), TTL caching is acceptable and can be longer than core APIs.
- If strict freshness is required for a view, do not rely on strong cache hit behavior (`max-age` only) for its primary data path.

### Forecast UI consistency

- **APR/APY mode parity**: any forecast number shown inside a tooltip/panel must follow the same APR/APY mode selected in the main UI.
- **Label user-specific vs campaign-wide values**:
  - Merkl forecast rows usually show campaign-wide `Daily Rewards`.
  - Merit self-bonus forecast is user-specific and should be labeled clearly (e.g. `Your Daily Rewards`).
- **Avoid ambiguous eligibility wording**: if eligibility depends on external user state (e.g. Self verification) and is not known client-side, do not claim the user is currently eligible.
- **Use global scenario inputs when the core job is cross-row comparison**:
  - If the user is comparing multiple reserves under the same notional assumption, prefer a shared table-level `Supply amount` / `Borrow amount`.
  - Keep row expansion for detail inspection, not as the only place where the scenario can be changed.
- **Hide empty source rows in breakdown UIs**:
  - Summary rows such as `Native` / `Incentive total` can stay visible.
  - Source rows like `Protocol Incentive`, `ACI`, `Merkl`, `Brevis` should disappear when both current and simulated values are effectively zero.
- **Align placeholder state with numeric columns**:
  - Empty placeholders like `-` must use the same fixed column widths and alignment as real numbers.
  - Do not let `auto` width columns cause headers and placeholders to drift.
- **Shared simulation must stay on bounded data sources**:
  - Use backend `tokenPrices` for table-wide scenario math.
  - Do not fan out browser-side third-party price lookups across the whole table after one shared input change.
  - If backup pricing is required for broad coverage, put it behind a backend batch/proxy endpoint.
- **Shared same-side incentive monotonicity**:
  - In table-level shared simulation, adding `Supply` must not increase the simulated `Supply incentive` for that same row.
  - Likewise, adding `Borrow` must not increase that row's simulated `Borrow incentive`.
  - Apply this rule both to the incentive total and each source breakdown row (`ACI`, `Merkl`) so totals and rows stay directionally consistent.

### InkAprCalculator mobile (CompactLayout): slider tooltip & Reference FDVs spacing

**文件**：`src/components/dashboard/InkAprCalculator.tsx`，非 XL 的 CompactLayout。

- **Thumb**：视觉 `w-4 h-4`，拖动时 `scale-[1.4]`（≈22.4px）。
- **数值 Tooltip**（slider 上方）：
  - 非拖动：`-top-8`（32px）；拖动中：`-top-10`（40px），用 `isDragging` 切换 class。
  - 必须带 `z-20`，避免被 thumb 的 ring/shadow 盖住。
  - 可加 `transition-[top] duration-150` 使切换自然。
- **Reference FDVs 区块**：紧贴 slider 下方的 Collapsible 使用 `mt-[var(--ds-space-0-5)]`（2px）；触控热区与可点击性保持不变。
- **验收**：拖动时 tooltip 与 thumb 间有明显空隙；松手后 tooltip 不贴 thumb 也不过高；slider 与 Reference 区更紧凑且仍易点。

## Debugging checklist for incentive UI regressions

When tooltip/forecast behavior looks wrong, check:

1. **Display mode**: APR vs APY toggle consistency
2. **Source scoping**: current reserve/source only (especially whitelist toggles)
3. **Forecast source type**: Merkl vs Merit (campaign-wide vs user-specific semantics)
4. **Viewport constraints**: clipping, scrollability, fixed overlay behavior
5. **Token normalization**: symbol alias handling in search and display

---

## C. Reserves Table Simulation Notes

### Current behavior

- Native simulation uses one combined reserve state:
  - `supplyAmount` increases the utilization denominator
  - `borrowAmount` increases variable debt
  - denominator includes `deficit` from `/rate-inputs`
  - utilization, borrow rate, and supply rate are recalculated from that same combined state
- Incentive simulation remains reserve-specific:
  - supply-side incentives react to the shared supply input
  - borrow-side incentives react to the shared borrow input

### Data-source boundaries

- Shared table simulation must treat backend snapshots as the primary data plane.
  - `markets` provides reserve rows plus any local `tokenPrices`.
  - `rate-inputs` provides the native-rate state used for supply/borrow recomputation.
  - `forecast` (in side-data) provides Merkl campaign state when a campaign is actually being forecast.
- Browser-side third-party price backup is enabled for shared simulation as a bounded fallback.
  - Primary path remains backend snapshot `tokenPrices`.
  - Fallback is only used when snapshot misses price entries and is protected by query-key dedupe, module in-flight dedupe, limiter, and TTL caches.
- Keep monitoring fan-out and provider limits.
  - If request volume rises, prefer backend batch/proxy consolidation over unbounded client scatter/gather.

### Interaction direction

- Row expansion is acceptable for detailed inspection.
- If the primary product goal becomes comparing many reserves under the same hypothetical size, move the scenario inputs to a shared table-level control bar.
- In that model:
  - main table cells should update from the shared scenario
  - row expansion should only expose the detailed breakdown, not own the scenario state

### UI rules

- Keep `Native` and `Incentive total` visible even when simulated values are empty.
- Hide downstream source rows when both current and simulated values are effectively zero.
- Use fixed numeric column widths so placeholders align with headers.

### Desktop reserves table column layout

The desktop reserves table uses `table-fixed` with a `<colgroup>` so column widths and spacing are predictable. When changing column count or visual balance, update all three places: `ReservesTable.tsx` (colgroup + header cells + skeleton row) and `DesktopReserveRow.tsx` (body cells).

**Column order and widths (percentages, sum = 100%):**

| Column  | Width | Notes |
|---------|-------|--------|
| Token   | 13%   | Left three columns kept slightly wider for readability |
| Price   | 10.5% | |
| Market  | 11.5% | |
| Size    | 13%   | |
| Util.   | 12%   | |
| Supply  | 13.5% | Right three (Supply / Spread / Borrow) slightly tighter |
| Spread  | 12%   | |
| Borrow  | 14.5% | |

**Cell padding (horizontal):**

- **Token**: `pl-[var(--ds-space-1-5)] pr-[var(--ds-space-0-5)]` — tight right so Token and Price sit close.
- **Price**: `px-[var(--ds-space-0-5)]` — minimal so Price/Market gap stays small.
- **Market**: `pl-[var(--ds-space-0-5)] pr-[var(--ds-space-1)]` — tight left; right bridges to Size.
- **Size, Util, Supply, Spread**: `px-[var(--ds-space-1-5)]` — uniform.
- **Borrow**: `pl-[var(--ds-space-1-5)] pr-[var(--ds-space-2)]` — right keeps a small outer margin.

Keep header, body, and skeleton row padding in sync so alignment and spacing stay consistent.

### Borrow availability constraint

- Available to borrow = `min(Pool Liquidity + Supply Input, Borrow Cap Remaining)`
- When user input exceeds limit, show which constraint is binding ("limited by pool liquidity" or "limited by borrow cap")
- Borrow input is automatically capped to the effective limit in simulation calculations

### Simulation breakdown panel layout

- **Row 1 (Market Metrics)**: Supply Size (with cap), Liquidity, Total Borrowed (with cap) — 3 cards
- **Row 2 (Rates)**: Supply, Spread, Borrow, Utilization (with optimal, amber warning when exceeded) — 4 cards
- **Row 3 (Breakdowns)**: Supply Breakdown, Borrow Breakdown — 2 cards
- **Removed elements**: Reserve Factor (not necessary), standalone Cap cards (merged into metrics), standalone Optimal Utilization card (merged into Utilization)
- **Utilization warning**: When `after` or `current` utilization exceeds optimal, show amber color on delta and after values

### Row expansion auto-extends visible count

- When a reserve row is expanded (showing the simulation breakdown panel), the visible row count automatically extends to include 5 additional rows after the expanded row.
- This behavior mirrors the TopOpportunities card click jump behavior (`targetIndex + 6 = expanded row + 5 buffer`).
- **Persistence**: The extended visible count is persisted to `minVisibleCount` state, so collapsing the row does NOT hide the extra rows. Users can continue browsing nearby reserves after closing the simulation panel.
- Implementation: A `useEffect` watches `expandedReserveId`, computes `neededCount = expandedIndex + 6`, and updates `minVisibleCount` if needed.
- This prevents the expanded row from appearing at the very bottom of the visible list, giving users context of nearby reserves for comparison.

### Card–Simulation panel junction (mobile)

- When a card expands to show the simulation panel below, the upper card and lower simulation panel must appear as **one continuous card** with a single unbroken outline.
- **Upper card**: `rounded-t-xl rounded-b-none border-b-0` — removes bottom rounding and border.
- **Simulation panel**: `rounded-b-xl` only (NO `rounded-t-xl`) — top corners are straight so they align flush with the card above.
- The junction mask (concave curve overlay) handles the **inactive side** transition; the active side must be a seamless vertical edge with no rounding or gap.
- **Rule**: Never add `rounded-t-*` to the simulation panel container; the top edge is always joined to the card above.
- The simulation sub-row does not repeat the desktop heading “Shared APY/APR simulation” in **compact (mobile)** layout; the card’s Simulation toggle already establishes context.
