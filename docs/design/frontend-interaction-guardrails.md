# Frontend Interaction Guardrails

This note records recurring UI/interaction issues found during incentive/forecast work, so future changes keep behavior consistent.

This is a project-specific guardrail file, not the reusable design reference. If a rule is generic across projects, move it to `DESIGN-SYSTEM-REFERENCE.md`.

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
- **Multi-paragraph explanatory tooltips** (e.g. scenario strip Net help): When Radix `@/components/ui/tooltip` carries more than a one-line hint, match the **body rhythm** of `DesktopTooltip`/`MobileTooltip` inner content (see `AprApyToggle.tsx`, `FormulaBlock` + `InkAprCalculator.tsx`): **`rounded-xl border border-border shadow-lg`**, padding **`px-4 py-3`**, wrapper **`space-y-2.5`** (desktop shell between multiple direct children; mobile body often **`space-y-3`**), inner columns often **`space-y-3`**, copy **`ds-text-12`** + **`leading-relaxed`** (or `leading-snug`) + **`text-muted-foreground`**; optional **`border-t border-border pt-2.5`** only when two blocks need a hard visual break. Default TooltipContent padding plus stacked `mt-1.5` paragraphs alone reads cramped—override explicitly. **Cursor types, delays, and short summary:** **DESIGN-SYSTEM-REFERENCE.md** §6.
- **Ink incentive APR formula tooltip order** (`InkAprCalculator.tsx`): keep content in this order: **(1)** INK price row (`INK $x.xx`) **above**, **(2)** formula block (`APR = daily_points × $INK × 365%`) **below**. Use shared `FormulaBlock` chrome for the formula line.

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
- **Do not wrap click-to-open-sheet buttons with `<Tooltip>`**: if a button already opens a detailed overlay on click (bottom sheet, popover, modal), do **not** also wrap it in a Radix `<Tooltip>` for hover feedback. The hover tooltip will appear **alongside** the click overlay, creating a double-popup experience. The click target should have exactly **one** overlay mechanism. Example: `MobileReserveCard` frozen/paused status badge — clicking opens the `FrozenSheetContent` bottom sheet, so the redundant hover `<Tooltip>` wrapper was removed. Regression test: `MobileReserveCard.test.tsx` asserts that the badge button has no `data-state` attribute (which Radix `TooltipTrigger` adds).

- **`MobileReserveCard` Supply/Borrow tab vs parent `defaultTab`**: Parent may drive the default tab from sort (e.g. borrow column). Sync in `useEffect` with `setActiveTab(defaultTab ?? 'supply')`. If you only update when `defaultTab` is truthy, switching away from borrow sort leaves `defaultTab` as `undefined` and cards **stay stuck on Borrow** — wrong.

### Text-to-border spacing (mandatory)

- **Text must never touch borders**: Any bordered container (cards, table cells, warning banners, buttons) must have at least `--ds-space-2` (8px) padding between text and the border. See **DESIGN-SYSTEM-REFERENCE.md** §3（文字与边框）and §4（布局原则）.
- **Token symbols: single-line first, wrap-only-when-needed (all viewports)**: token symbols (`USDT`, `WETH`, `syrupUSDT`, etc.) must stay on one line whenever the cell can physically fit them. Only when the layout truly cannot fit may they **wrap to a new line** (`break-words` + `min-w-0` on the span, with the flex parent set to `flex w-full min-w-0`). **Never** use `truncate` / tail ellipsis (drops information), **never** use `break-all` (breaks per-character), and **never** force early abbreviation patterns like `U...`. This rule applies identically to mobile reserve cards, Top Opportunities rows, and the desktop Reserves table Token cell — and **supersedes** the previous \"tail truncation when it cannot fit\" rule.

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
| Utilization percentage (mobile header) | `text-foreground` below optimal, `ds-text-amber-600` above optimal | Matches `UtilizationIndicator` zone |
| General numeric data | `text-foreground` | Market size, prices |
| Secondary/muted info | `text-muted-foreground`, `text-secondary` | Labels, descriptions |

**Utilization display value (mobile vs desktop)**:
- Mobile reserve header and bottom sheet must use the same **display** utilization as the desktop Utilization column: `hasSharedScenario ? after ?? current : current` from rate simulation (not raw `reserve.utilizationPct` when a scenario is active).

**UtilizationIndicator color scheme** (minimize same-hue steps: one **zone tint** + one **full semantic** per state):
- Below optimal (borrow-friendly / flatter borrow curve): track zone `fill-[rgb(var(--ds-brand-cyan-rgb)/0.32)]`; dot **full** `fill-[rgb(var(--ds-brand-cyan-rgb))]` — same as Borrow (`ds-text-brand-cyan`), not emerald; avoid mixing `-70` text with other cyan opacities
- Above optimal (past kink): track `fill-[rgb(var(--ds-amber-600-rgb))]`; dot `fill-[rgb(var(--ds-amber-600-rgb))]` (same as warning copy), not a third amber step
- **Dot visibility (no extra hue, no outline habit)**: single **solid** dot (slightly larger radius is OK); **do not** add outer glow discs, `stroke` halos, or extra opacity rings by default
- Tooltip / mobile sheet: "Below optimal" uses `ds-text-brand-cyan`; "⚠️ Above optimal" uses `ds-text-amber-600`

**Supply / Borrow APY typography (desktop table + mobile hero)** — same hierarchy rules:
- **Primary total APY**: `font-bold`, `ds-text-14` (desktop) or `ds-text-24` (mobile hero), semantic fill `ds-text-emerald-500` (Supply) / `ds-text-brand-cyan` (Borrow)
- **Secondary row** (native + incentive): `ds-text-11`, native uses `ds-text-emerald-500-70` / `ds-text-brand-cyan-70` with optional `font-medium`; incentive chips stay on the existing tinted pill pattern (`ds-bg-*-10`, `-70` text). **This row is not the same as Size** (see below).
- **Pill visuals are interactive-only**: in this project, rounded/tinted pill style is reserved for clickable controls. Use `button`/`a` semantics with clear hover/focus states. For read-only values, use plain text (not pill styling).
- **Size column** (Supply/Borrow amounts): `ds-text-13` + `font-medium` + **full** semantic (`emerald-500` / `brand-cyan`)—aligned with APY **primary** color, **not** with the Native/Incentive row (which is smaller + `-70` by design).
- **Spread column**: `font-bold` + `ds-text-14` + purple semantic—treated as a **primary numeric** column alongside Supply/Borrow totals.
- **Mobile parity**: Supply/Borrow tab, **size row**, cap sheets, and incentive chips use the **same** emerald/cyan tokens as desktop (`emerald-500` / `brand-cyan`), not a darker step (e.g. avoid `emerald-600` for Supply size when desktop uses `emerald-500`); utilization figure next to the indicator uses at least `ds-text-11`
- **Mobile reserves sort strip**: Five independent dropdown chips in desktop-matching order: **Size → Util → Supply → Borrow → Extra**. The **Util** chip is a dedicated standalone dropdown (Utilization / Liquidity), matching the desktop Utilization column. The **Extra** chip groups Spread, Token, Market, and Price options (Utilization moved to its own chip). No reserves count text is rendered in the sort bar area. Re-selecting the active menu row toggles ascending/descending, matching the desktop header behavior.
- **Mobile sort bar dropdown boundary constraint**: Each chip container uses `relative overflow-visible` so absolute-positioned menus are never clipped by ancestors. Menu alignment follows a position-aware strategy: left-side chips (Size, Util, Supply) use `left-0` (expand rightward) while right-side chips (Borrow, Extra) use `right-0` (expand leftward). All menus use `max-w-[min(18rem,calc(100vw-1.5rem))]` as a viewport-aware **max** cap only — the actual width auto-fits content (no fixed width), same as desktop. This three-layer system (direction + auto-width + no-clip) prevents both left-edge and right-edge overflow on any viewport width.
- **Desktop sort dropdown width auto-adaptation**: `DesktopSortMenuPortal` uses `position: fixed` with `minWidth` (default 140px) and no explicit `width`, letting the menu auto-size to fit its longest option text via `fit-content` behavior. Do NOT set a fixed `minWidth` larger than needed — the portal should shrink/expand to match content naturally. Each sort column can override `minWidth` only when its options require a wider floor (e.g. long option labels).

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
- **Scope local overlay state to the owning subtree**: clicking a local trigger (for example the `TopOpportunities` incentive badge) must not update page-root state or cause the whole page shell to re-render. Keep open/close state in the smallest component that owns the trigger + overlay pair; use a portal for layering, not top-level page state.
- **Whitelist toggles must be scoped**: only show per-tooltip controls when the current reserve/source actually has applicable items (avoid leaking global state into unrelated tooltips).

### Expandable rows and scroll stability

- **Do not drive `window` scroll from “row index changed” while simulation is open**: After expanding, shared simulation updates can change computed sort keys (spread, APY, etc.) and reorder the list. Treating “index in `sortedData` changed” like a user re-sort and auto-scrolling to pin the row feels erratic and often fires even when there is already space below the card.
- **Sort from column headers collapses the expanded row** in `ReservesTable`, so index-based pinning does not correspond to a real “user re-sorted while expanded” flow here.

#### Simulation pin scroll (normative — do not regress)

These rules are **product constraints**. Any PR that changes reserve-table scrolling must preserve them unless there is an explicit spec change and this section is updated in the same work.

| Rule | MUST / MUST NOT |
|------|-----------------|
| Expand / collapse / switch expanded row **without** a change to debounced shared scenario | **MUST NOT** run pinning scroll (no “expand → jump”). |
| Debounced shared scenario **changes** and `sortedData` **order** (reserve id sequence) **changes** and a row **is expanded** and the active sort is scenario-driven | **MUST** run pinning scroll for that expanded row (desktop: pin below sticky stack; mobile: clip fix only). |
| Debounced scenario changes but sort order **unchanged** | **MUST NOT** scroll. |
| Filter-driven dataset changes (market/search/category), where `reserves` changes and then `sortedData` order changes while a row is expanded | **MUST** run pinning scroll once for the existing expanded row (desktop pin / mobile clip), even when debounced scenario key is unchanged. |
| Sort order changes from header toggles (`Token` / `Market` / `Price` / etc.) | **MUST NOT** trigger this pin path (header sort still collapses expanded row first). |
| Tie scroll to `sortedData` index or “every reorder” while expanded | **MUST NOT** (forbidden; see first bullet in this section). |

**Debounced scenario key** (must stay consistent with the effect): `` `${debouncedSharedSupplyInput}\0${debouncedSharedBorrowInput}\0${sharedInputMode}\0${meritMerklNetPosition ? '1' : '0'}` `` — shared inputs plus Merit/Merkl net-vs-per-side mode (not debounced; must match `useSharedRateSimulations` / sort inputs).

**Scenario-driven sort gate** (`expandScrollFollowsScenarioSort` in `ReservesTable.tsx`): pinning is allowed only when **`hasSharedScenario`** is true **and** the active column can change sort keys from shared scenario (`pickScenarioValue` / supply size USD). **Exclude**: Token, Market, Price; Size when `sizeSortMode === 'borrow'`. **Include**: Supply, Borrow, Spread, Util; Size when `sizeSortMode === 'supply'`. If you add a new sort column that uses scenario-sized or `after` totals, extend this `useMemo` in the same PR.

#### Simulation pin scroll — implementation reference (maintainers)

**Goal:** keep the spec above stable when refactoring; do not “simplify” the effect into expand-only or index-only scroll.

1. **Single call site** for `scrollExpandedSimulationIntoView`: the `useEffect` placed **immediately after** the `sortedData` `useMemo` in `ReservesTable.tsx` (comment: *Pin expanded row only when debounced scenario inputs change…*). Do **not** add a second effect on `expandedReserveId` for pinning.
2. **Refs** (names matter for grep / review): `lastScenarioKeyForPinScrollRef`, `lastReservesKeyForPinScrollRef`, `lastSortedIdsForPinScrollRef`, `scenarioPinScrollBaselineReadyRef`, `pendingScenarioPinScrollRef`, `pendingReservesPinScrollRef`.  
   - First run seeds baseline only (no scroll).  
   - Scenario path: when scenario key changes, mark `pendingScenarioPinScrollRef`; execute pin only after `orderChanged` is observed, gated by `expandScrollFollowsScenarioSort`.  
   - Filter path: when `reservesKey` changes (market/search/category), mark `pendingReservesPinScrollRef`; execute pin only after `orderChanged` is observed (no scenario-sort gate required).  
   - Always compare against previous `lastSortedIdsForPinScrollRef` to avoid false positives.
3. **Effect dependency array** must include: `debouncedSharedSupplyInput`, `debouncedSharedBorrowInput`, `sharedInputMode`, `meritMerklNetPosition`, `sortedData`, `expandedReserveId`, `isMobile`, `expandScrollFollowsScenarioSort`, `reserves`. If scenario debouncing moves to another layer, keep the **debounced** values here — never the raw typing state. `meritMerklNetPosition` is not debounced; it still belongs in the scenario key and this dependency array.
   - **`sortedData` useMemo dependency array** must also include **both** `debouncedSharedSupplyInput` **and** `debouncedSharedBorrowInput`. If either is missing, sort order won't update when that input changes, and pin scroll will see a stale `ids` array — effectively disabling the pin for that input side.
4. **Timing:** `setTimeout(320)` + **two** `requestAnimationFrame` ticks before measuring/scrolling — matches expand row CSS transition (~300ms) so layout matches post-sort DOM. Changing duration in `DesktopReserveRow` / `MobileReserveCard` grid transitions may require retuning this constant in the same PR.
5. **Scroll implementation** (`src/lib/scrollExpandedSimulationIntoView.ts`): desktop `pin-main-row-top` uses `window.scrollBy` so `tr[data-reserve-id]` top aligns to the **fully engaged sticky stack height** = `scenario height + sticky header height + GAP_BELOW_STICKY_STACK_PX` (fallback `VIEW_MARGIN_PX`). Do **not** derive this target from the live `<thead>` box alone: desktop sticky is applied on each **`th`**, so the `<thead>` element’s own `getBoundingClientRect()` can drift far above the visible sticky headers after scroll. Mobile expanded block: `[data-reserve-expanded-anchor]`. Do not remove these `data-*` hooks from the sticky wrappers without updating this function and this doc. **Expanded main-row sticky** (`DesktopReserveRow` sticky `td`, `top: var(--reserves-expanded-main-row-top)`) must stay **geometrically consistent** with the same stack: that variable is **scenario height + thead/header height** (px) on the card—do not change one without the other. **Simulation inner scroll**: product state should keep the expanded simulation on page scroll only; do not reintroduce a desktop `max-height` + `overflow-y` scrollport around `SimulationSubRow`. Filter-triggered pin scroll uses `instant` behavior (not `smooth`) to avoid race conditions with DOM reflow.
6. **Expanded-state cleanup when filtered out:** if expanded row id disappears from `reserves`, clear expansion only after a short delayed re-check (current implementation uses ~180ms) to avoid transient filter/re-sort frames incorrectly dropping expansion.

#### DOM contract (pin scroll)

| Attribute | Where | Purpose |
|-----------|--------|---------|
| `data-reserves-sticky-scenario` | Sticky wrapper around shared `ScenarioControls` (desktop + mobile table layouts) | Pin scroll vertical offset |
| `data-reserves-sticky-thead` | Sticky table header row wrapper (desktop) | Same — body row must sit below stacked stickies |
| `data-reserve-id` | Main `TableRow` in `DesktopReserveRow` | Target row for desktop pin |
| `data-reserve-expanded-anchor` | Mobile expanded pair + simulation container | Bounds for mobile clip scroll |

#### CSS variables (desktop reserves card — do not drop observers)

Set on the desktop table card (`desktopTableCardRef` in `ReservesTable.tsx`). **`ResizeObserver`** must watch **both** the scenario strip and **`thead[data-reserves-sticky-thead]`** (via `ref` on `TableHeader`) whenever both exist; removing either observer breaks thead `top` and/or expanded-row sticky.

| Variable | Definition |
|----------|------------|
| `--reserves-sticky-scenario-height` | Scenario strip height (px) — sticky `th` use `top: var(--reserves-sticky-scenario-height, 4.5rem)`. |
| `--reserves-expanded-main-row-top` | Scenario height **+** `thead` height (px) — expanded main row `td` `top` in `DesktopReserveRow.tsx`. |

**Regression checklist** (before merge if touching reserves table / scroll / scenario debounce): (1) Expand with fixed scenario inputs → no scroll. (2) With expanded row, change debounced scenario so sort order changes (Spread + inputs) → row pins below sticky stack on desktop. (3) Change scenario but sort column is Token → no scroll. (4) Scenario change + sort change but row collapsed → no scroll. (5) **Desktop:** row expanded, long `SimulationSubRow` → scroll page: **main reserve row** (token/price/market) remains visible **directly under** sticky column headers (third sticky layer); simulation content scrolls beneath it—**do not** remove expanded `td` sticky or desync `--reserves-expanded-main-row-top`.

**Related (layout geometry):** § **Desktop reserves table: sticky stack and scrollport (normative)** — `ResizeObserver`, `--reserves-sticky-scenario-height`, **`--reserves-expanded-main-row-top`**, scrollport rules, and how sticky `thead` stacks under the scenario strip. `getPinnedRowTopY()` in `scrollExpandedSimulationIntoView.ts` must remain consistent with that stack (and with the `data-reserves-sticky-*` elements).

### Search behavior

- **Normalize token symbols for search**: search should match canonical aliases and symbol variants.
  - Example: `USDT` should match `USD₮`.
  - Normalize unicode / punctuation variants before filtering.

### Row-triggered filtering

- **Reserve row sub-actions should not own canonical filter state**: row-level chips/badges may trigger filtering, but the source of truth must remain page-level state (currently `Index.tsx`), with rows emitting intent upward.
- **Use canonical ids for filtering, display labels for UI only**: `marketName` or `hubId` should drive the predicate; `hubName` and formatted market labels are presentation only.
- **Keep table-local pin/expand helpers filter-agnostic**: if a row click narrows the list and the table preserves expansion/scroll position, naming and helper structure should describe a generic row-filter flow, not a single market-only case.
- **Do not overload dense mobile badges with two primary actions**: when a small mobile badge already represents a direct external navigation target, do not also make the same tiny surface a filter toggle. Prefer one primary action per compact target; move filtering to a larger chip, menu item, or dedicated control.

### Theme switching behavior

- **Default theme follows system**: on first visit, the app respects `prefers-color-scheme` via `next-themes` with `defaultTheme="system"` and `enableSystem={true}`.
- **Manual toggle is temporary override**: clicking the theme toggle switches between Light ↔ Dark immediately.
- **System change resets to follow system**: when the OS theme changes (e.g. macOS auto Light/Dark schedule), the app automatically calls `setTheme('system')` to re-sync.
  - This prevents the app from being "locked" to a manual choice after the user toggled once.
  - Implementation: `ThemeToggle.tsx` listens to `matchMedia('(prefers-color-scheme: dark)')` change events.
- **Resource cost**: the `matchMedia` listener is event-driven (not polling), triggers only on actual OS theme change, and has negligible overhead.
- **Theme transition CSS**: the `theme-transition` class is applied to `<html>` and `<body>` only (not `*` wildcard), limiting per-element transition computation to 2 nodes instead of the entire DOM tree. The class is removed after 350ms to avoid ongoing overhead.

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

### Top Opportunities frozen/paused filter (normative)

- **Top Opportunities 必须排除 frozen 和 paused 的 reserve**: `reservesWithTotals` 在 `map` 之后必须 `.filter(r => !r.isFrozen && !r.isPaused)`，这样 Stable / ETH / BTC / Looping 四个分类都不会展示不可操作的资产。
- **原因**: frozen/paused 的 reserve 无法进行 supply/borrow 操作，展示在 Top Opportunity 中会误导用户点击，且由于 `handleTopCardClick` 不重置 `showFrozenOrPaused` 过滤器，点击后无法跳转到 ReservesTable 中对应的行（该行被过滤隐藏），导致跳转静默失败。

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

### Garbage-collection time (`gcTime`) convention

- **Default is enough for most queries.** TanStack Query's default `gcTime` (5 min) is fine for queries whose `staleTime` ≤ 5 min—do not set `gcTime` explicitly in those cases.
- **Set explicit `gcTime` when:**
  - The query has localStorage persistence (`initialData` + `getCached*`). After GC the next mount restores from localStorage, so `gcTime` can be **shorter** than `staleTime` (e.g. `coingeckoTokenImage`: staleTime 24 h, gcTime 30 min).
  - The query's `staleTime` is significantly longer than 5 min and you want to keep data in memory between navigations (e.g. `sideDataMeta`: staleTime 5 min, gcTime 15 min).
- **Do not set `gcTime` for transient / on-demand queries** (e.g. `useRateSimulation` price queries)—default is appropriate.
- All `gcTime` values live in `QUERY_GC_TIMES` in `src/config/queryStaleTimes.ts`.

### Forecast UI consistency

- **Terminology (Tydro vs Merkl labels)**: only Merkl’s optional `pointsPerThousandUsd` path is treated as Tydro (`src/lib/tydro.ts`, `tydroPointToUsdRate`). `Merit` / `Brevis` / protocol incentives are not Tydro points. Aggregate UI labels can stay as **Merkl** / **Merkl Incentive**; use “Tydro” only when explaining the points-to-APR conversion or the global point-to-USD control. Unrelated “points” (e.g. Ink FDV reference points) are not Tydro.
- **Incentive tooltip vs shared simulation**: `IncentiveTooltip` shows **static** incentive context (campaign dates, messages, Merkl whitelist opt-in). **Deposit- and TVL-dependent** forecasts (Merkl hypothetical TVL, Merit Self deposit-ceiling lines, FIX rewardable horizon, Brevis per-user cap / days-to-cap, cap-binding warnings, etc.) belong in the **shared rate simulation** UI (`useRateSimulation` per-campaign rows on `SimulationSubRow` via `capNote` / `capWarning`), not inside the tooltip. Merit **Base** and Merkl **DUTCH_AUCTION** use **no** row `capNote` (scenario APR only); keep that policy in sync if it changes. **New** user-visible cap/ceiling lines should be produced via `src/lib/incentiveCeilings.ts` (then mapped to `capNote` / `capWarning`) where applicable—see `docs/rate-calculation.md` (Incentive Reward Cap Reference, naming layers).
- **Grouped incentive traversal**: Merkl and Brevis both enter shared UI helpers as **group + `breakdowns[]`** structures. Shared iteration/filtering/labeling belongs in `src/lib/campaignGroups.ts`; Brevis incentive resolution (flattened to top-level fields by `normalizeBrevisIncentives`, accessed via helpers in `src/lib/brevis.ts`) follows Merkl-aligned patterns. Do **not** spread `breakdown.foo ?? getBrevisFoo(group)` chains across tooltip / formatter / simulation code.
- **`capNote` copy family**: Prefer a consistent **“capped”** idiom where it fits—e.g. Merkl MAX **`APR capped for low TVL`**, Brevis **`Reward capped at …/user`**, Merit self **`Eligible supply capped at …`**. Shared horizon phrasing: **`~Nd earn`** (Merkl FIX pool-budget horizon at scenario TVL and Brevis per-user reward horizon) and **`~Nd to end`** (Brevis calendar-only). Join segments with **` · `** when a row combines cap + horizon.
- **`capNote` layout (`SimulationSubRow`)**: Render `capNote` on a **follow-up `<tr>`** with **`colSpan={4}`** so, in wide layouts, the line can use the **full width** of that Supply/Borrow mini-table (numeric columns stay on the row above). **Still allow multi-line wrap** when the panel is narrow (`whitespace-normal` / `break-words`); do **not** use `whitespace-nowrap`. Avoid `text-pretty` here if it causes premature line breaks on short copy.
- **APR/APY mode parity**: the global APR/APY toggle applies to **non-native rate displays only**. Headline incentive **percentages** in `IncentiveTooltip`, shared simulation incentive rows, and any other **forecast-derived / incentive-derived** numbers (`MerklForecastPanel`, per-campaign simulation rows, incentive totals) must follow the toggle. **Native Aave supply / borrow rates stay in APY** and do **not** switch to APR in table cells, cards, or shared simulation. `IncentiveTooltip` does not show scenario forecasts.
- **Label user-specific vs campaign-wide values** (simulation / forecast panels—not static tooltip copy):
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

### Merkl whitelist-only campaigns (per `campaignId`)

Merkl may mark a breakdown as **whitelist-only** (`whitelistOnly: true`). The app does **not** assume the viewer is eligible.

| Topic | Behavior |
|-------|------------|
| **Default** | **No** whitelist-only campaigns are included in totals. App state is `whitelistMerklCampaignIds: Set<string>` on `Index`, initially **empty**. |
| **User opt-in** | User checks **per campaign** by **`campaignId`** (same ID can appear on multiple reserves if Merkl reuses it). |
| **What changes when checked** | That campaign’s Merkl APR/APY counts toward: reserves table numbers, Top Opportunities, incentive totals in `IncentiveTooltip`, and `useRateSimulation` / shared table simulation. |
| **Where the UI lives** | **Incentive tooltip**: each whitelist Merkl row shows the same checkbox label **“Include as WL user”** (with or without a `campaignId`; no id uses an internal sentinel key in `whitelistMerklCampaignIds`). Full accessible name states that checking confirms whitelist participation and includes the campaign in totals. **Merkl Forecast panel** (dev or `VITE_SHOW_RATE_CHECK`): optional list of active whitelist-only campaigns (including a **“Whitelist Merkl (no campaign ID)”** row when applicable) with the same label as the section header before the list. |
| **Implementation** | `isMerklWhitelistBreakdownIncluded()` and `MERKL_WHITELIST_NO_CAMPAIGN_ID_SENTINEL` in `formatters.ts`; `useRateSimulation` / `useSharedRateSimulations`; `collectMerklCampaignOptions` / `collectWhitelistOnlyMerklCampaignEntries` in `merklCampaigns.ts`. |
| **Persistence** | None — selection is **session-only**; reload clears it. |

### InkAprCalculator mobile (CompactLayout): slider tooltip & Reference FDVs spacing

**文件**：`src/components/dashboard/InkAprCalculator.tsx`，非 XL 的 CompactLayout。

- **Thumb**：视觉 `w-4 h-4`，拖动时 `scale-[1.4]`（≈22.4px）。
- **数值 Tooltip**（slider 上方）：
  - 非拖动：`-top-8`（32px）；拖动中：`-top-10`（40px），用 `isDragging` 切换 class。
  - 必须带 `z-20`，避免被 thumb 的 ring/shadow 盖住。
  - 可加 `transition-[top] duration-150` 使切换自然。
- **Reference FDVs 区块**：紧贴 slider 下方的 Collapsible 使用 `mt-[var(--ds-space-0-5)]`（2px）；触控热区与可点击性保持不变。
- **验收**：拖动时 tooltip 与 thumb 间有明显空隙；松手后 tooltip 不贴 thumb 也不过高；slider 与 Reference 区更紧凑且仍易点。
- **Incentive APR formula tooltip**：在该卡片内保持「**INK 价格行在上、公式在下**」；公式用共享 `FormulaBlock`，与 APR/APY 说明弹窗的公式块样式一致。

## Debugging checklist for incentive UI regressions

When tooltip/forecast behavior looks wrong, check:

1. **Display mode**: APR vs APY toggle consistency
2. **Merkl whitelist-only**: default **excluded**; opt-in **per `campaignId`** — see § **Merkl whitelist-only campaigns** above
3. **Forecast source type**: Merkl vs Merit (campaign-wide vs user-specific semantics)
4. **Viewport constraints**: clipping, scrollability, fixed overlay behavior
5. **Token normalization**: symbol alias handling in search and display

---

## C. Reserves Table Simulation Notes

### Current behavior

- Native simulation uses one combined reserve state:
  - `supplyAmount` increases the utilization denominator
  - `borrowAmount` increases variable debt
  - denominator includes `deficit` from `/markets` reserve (rate calc fields)
  - utilization, borrow rate, and supply rate are recalculated from that same combined state
- Incentive simulation remains reserve-specific:
  - supply-side incentives react to the shared supply input
  - borrow-side incentives react to the shared borrow input

### Data-source boundaries

- Shared table simulation must treat backend snapshots as the primary data plane.
  - `markets` provides reserve rows plus any local `tokenPrices`.
  - `/markets` reserves embed the native-rate state (liquidity, debt, slope params, etc.) used for supply/borrow recomputation.
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

### Performance: simulation/sort dependency stability — MANDATORY

The shared simulation pipeline must preserve referential stability so unrelated
React re-renders do not trigger a full table re-sort + row re-render. These
invariants are **mandatory** for shared-simulation maintenance:

1. **`tokenPriceById` / `tokenPriceLoadingById` deps must derive from value
   signatures, not from the raw `priceQueries` array.**
   - `useQueries` returns a fresh array reference every render even when data
     is unchanged. Listing `priceQueries` as a `useMemo` dep makes the maps
     rebuild on every render, cascading into `simulationsById` rebuilds and
     full table re-sorts.
   - Required pattern: derive `priceDataKey` via
     [`buildPriceDataSignature`](../../src/hooks/useRateSimulation.ts) and
     `priceLoadingKey` via `buildPriceLoadingSignature`, then list those
     signatures as deps. Both functions are unit-tested for collision
     resistance (digit boundaries, ordering, length, null/undefined
     equivalence).
   - The signature contract is **opaque**: callers must not parse it.

2. **`ReservesTable` `sortedData` must gate `simulationsById` behind an
   "active sort actually reads simulation" check.**
   - Token / market / price sort bodies never read `simulation`; only compare
     raw reserve fields. Including a live `simulationsById` in those deps
     causes unnecessary re-sorts when scenario inputs or background price
     queries resolve.
   - Required pattern: pass `sortedDataSimGate` (a stable
     `EMPTY_SIMULATIONS_GATE` sentinel for token/market/price, the live
     `simulationsById` for everything else) instead of `simulationsById` to
     the `useMemo` deps array.
   - This gate **must not** be used to skip data updates: row components
     still receive fresh `simulation` props on every parent re-render. The
     gate only short-circuits sort recomputation.

3. **Fallback incentive computation must accept `forecastStates`.**
   - When `simulationsById` is absent for a row (e.g. transient empty
     state), the fallback path goes through
     `getReserveIncentiveValues(reserve, side, tydroPointToUsdRate, opts)`.
     `opts` **must** include `forecastStates`, otherwise Merkl forecast
     adjustments silently disappear from "current" incentive values, causing
     visible numeric drift in browse mode.

Regression check: any change touching `useSharedRateSimulations` or
`ReservesTable.tsx` `sortedData` deps must keep the existing
`buildPriceDataSignature` / `buildPriceLoadingSignature` tests green and
must not reintroduce `priceQueries` or a raw `simulationsById` into those
dependency arrays.

### Reserve simulation gating (frozen / paused / disabled) — MANDATORY

When a reserve is **frozen**, **paused**, or has the relevant side `supplyDisabled` /
`borrowDisabled`, the affected side MUST NOT show "after" values in response to user
input. This rule applies **identically on desktop and mobile**.

Locking matrix:

| Reserve flag         | Supply side | Borrow side | Spread / Utilization / Liquidity |
|----------------------|-------------|-------------|----------------------------------|
| `isFrozen`           | locked      | locked      | locked                           |
| `isPaused`           | locked      | locked      | locked                           |
| `supplyDisabled`     | locked      | live        | locked (depends on supply side)  |
| `borrowDisabled`     | live        | locked      | locked (depends on borrow side)  |

"Locked" means the displayed value falls back to `current*` (never `after*`), and
`renderRow` masks `after` / `delta` / `capNote` / `warning` to nullish.

Single source of truth:

- Desktop: `SimulationSubRow.tsx` derives `supplyDisabledNotice` / `borrowDisabledNotice`
  from `isReserveLocked` + `supplyDisabled` / `borrowDisabled` and threads a
  `disabled` flag into `renderRow`.
- Mobile (`MobileReserveCard.tsx`): MUST compute `supplyLocked` / `borrowLocked`
  from the same boolean rule above and use `useSupplyAfter` / `useBorrowAfter` /
  `useSpreadAfter` to gate every `simulation.*.after*` read (including
  `marketMetrics.totalBorrowedUsdAfter`, `availableLiquidityUsdAfter`,
  `utilization.after`, and the local display reserve size calculation's
  `rawSupplyInput`).

Do NOT introduce a new ad-hoc check; if you add a new derived field that consumes
`*.after*`, gate it through the existing `useSupplyAfter` / `useBorrowAfter` /
`useSpreadAfter` flags so desktop and mobile stay byte-equivalent.

Visual / interaction parity for the frozen/paused badge:

- Same lucide icons on both sides: `Snowflake` (frozen) and `PauseCircle` (paused).
- Same semantic colors: `bg-sky-500` for frozen, paused state uses the local
  paused token (`ds-paused` / `bg-[rgb(var(--ds-paused-rgb))]`) so it stays
  consistent with the amber/paused design-system semantics.
- Same tooltip strings: `Frozen` / `Paused` / `Paused & frozen`.
- **Desktop**: `FrozenStatusBadge` renders both icons inline side-by-side
  (`inline-flex gap-[3px]`) when both `isFrozen` and `isPaused` are active.
- **Mobile**: status badge overlay on token icon renders two compact circular
  pills side-by-side (`w-3 h-3` each, `gap-[1px]`) when both flags are active,
  with container width expanding from `1.75rem` (single) to `2rem` (dual).
  Single-flag behavior is unchanged. The badge retains its Tooltip wrapper for
  hover context, with click opening the frozen/paused bottom sheet.
- Mobile badge MUST keep an enlarged transparent hit area (≥ 28×28 CSS px) around
  the small visual pill so it satisfies the 44px touch-target spirit without
  enlarging the visual mark.

Regression coverage: see `e2e/top-opportunities-mobile-layout.spec.ts`
(`mobile frozen / paused badge uses frozen/paused semantic color tokens`),
the desktop `SimulationSubRow` tests, and
`MobileReserveCard.test.tsx` (frozen/paused badge rendering tests
covering single-flag and dual-flag states).


### Desktop reserves table: sticky stack and scrollport (normative)

This section is **mandatory** for anyone changing desktop `ReservesTable` layout, overflow, or sticky headers.

#### Why (one-line mental model)

`position: sticky` **`top` is resolved against the element’s nearest scrollport**, not always the viewport. If the scenario bar uses viewport-relative `sticky top-0` (page scroll) while `<thead>` sits inside a wrapper with `overflow-x-auto` (or similar), the header’s `top: …px` is measured from **that wrapper’s top**, not the viewport. The two layers then **misalign**: a **large empty band** appears under the scenario strip, and **tbody content scrolls through that band** above the header (visible “bleed” / clipped row fragments).

#### Rules

1. **Do not** wrap the **entire** `<table>` (including the sticky `<thead>`) in an ancestor with a non-default overflow that creates a **scrollport** between the card and the table—most commonly **`overflow-x-auto`** or **`overflow: hidden`** on a full-table wrapper—while the shared scenario strip above uses **`sticky top-0`** against page scroll and `<thead>` uses **`top: var(--reserves-sticky-scenario-height, …)`** meant to stack under the scenario strip in **viewport** coordinates.
2. **Do** keep the **reference structure** in `ReservesTable.tsx`:
   - **Desktop reserves card shell**: outer wrapper uses **`rounded-2xl bg-border/60 p-px`** plus an inner **`rounded-[calc(1rem-1px)] bg-card`** that holds scenario + table. This **1px gutter** draws a continuous outline without `overflow: hidden` (which would break viewport `sticky`). It avoids the common bug where a full-bleed sticky child’s opaque **`bg-card`** paints **over** the parent’s native **`border`** so **top rounded corners look clipped**—see **DESIGN-SYSTEM-REFERENCE** § 轮廓与圆角拼接 (structural fix, not mask stacks).
   - **`data-reserves-sticky-scenario`**: shared scenario strip, `sticky top-0 z-20`, **`bg-card`** (same opaque surface as sticky **`th`** headers so the control bar and column headers read as one continuous card top—avoid **`bg-muted/…` + backdrop blur on this wrapper**, which fights the thead). **`ScenarioControls`** on desktop may use a **borderless** tinted well (`bg-card/60`, `backdrop-blur-sm`) inside the padded strip; do **not** add a second full **`border`** around the entire control row (the reserves card gutter already frames the block). **Supply / Borrow**: labels keep emerald / brand cyan; **empty** inputs use **neutral** border (`border-border/…`) + transparent fill (no semantic border hue until filled); **filled** tint matches border hue via **`cnDsInputSurface`**—see **DESIGN.md** §4.1 / §4.8.
   - **Mobile scenario strip: Batch & expand icon per-section centering (normative)**: On mobile, the right column beside `ScenarioControls` contains the Batch toggle (`PortfolioModeToggle`) above and the expand icon (`SlidersHorizontal`) below. These **must** each be vertically centered within their respective halves of the strip, matching the two visual rows of `ScenarioControls`: (1) **upper half** = input row (USD/Token segmented control + Supply/Borrow inputs), (2) **lower half** = Net lending & borrowing checkbox area (visible when `mobileNetOpen`). Implementation: outer row uses `flex items-stretch` (not `items-start`) so the right column stretches to the full height of `ScenarioControls`; the right column is split into two `flex-1` blocks, each with `flex items-center justify-center`. When the Net panel is collapsed (`mobileNetOpen === false`), the lower block has zero height and the expand icon sits directly below the Batch toggle. Do **not** revert to a single `flex-col gap-1.5` container that stacks both controls without per-section centering.
   - **Mobile scenario strip: expand icon position stability (normative)**: When the Net lending & borrowing panel opens/closes inside `ScenarioControls`, the Batch toggle and expand icon **must not move**. Implementation: the Net panel uses `position: absolute` (`absolute left-0 right-0 top-full z-10`) so it renders below the input row without affecting `ScenarioControls`'s in-flow height. The parent `<div>` of `ScenarioControls` mobile render uses `relative` to anchor this absolute panel. Do **not** revert the Net panel to in-flow layout (e.g. `mt-1.5 px-0.5 pb-0.5`), as that would cause `ScenarioControls` height to change when the panel opens, shifting the right column's Batch toggle and expand icon positions. This rule and the per-section centering rule above are **simultaneously required**: absolute positioning keeps positions stable; `items-stretch` + two `flex-1` centering blocks keep each control centered in its half.
   - **`data-reserves-sticky-thead`**: column header `<thead>` whose **`th`** cells use **`position: sticky`** (not only the `<thead>` itself—some engines composite tbody “through” a sticky thead unless each **`th`** paints its own opaque layer), **`top: var(--reserves-sticky-scenario-height, 4.5rem)`**, **`z-30`** (implementation in `ReservesTable.tsx`; must stay **above** expanded main-row `td` at **`z-[25]`**), **`bg-card`**, bottom border / light shadow; header **`tr`** should not use translucent row hover (`hover:bg-card` overrides the shared `TableRow` default).
   - **Expanded reserve main row (desktop)**: when a row is expanded, its **main data `tr`**’s **`td`** cells use **`position: sticky`** with **`top: var(--reserves-expanded-main-row-top, …)`** (px sum of scenario strip + `<thead>` height, set on the card via `ResizeObserver` in `ReservesTable.tsx`), **`z-[25]`** (below sticky **`th`** at `z-30`), opaque **`bg-card`**, and a light bottom border/shadow so the token/price/market row stays visible while the user scrolls the large **`SimulationSubRow`** block—aligned with **§ Simulation pin scroll** (anchor row identity, not only the sub-panel).
3. **Horizontal overflow**: With `table-fixed` and `%` columns, prefer **page-level** horizontal scroll on narrow desktop. If table-local horizontal scrolling is **required**, **do not** reintroduce a full-table `overflow-x-auto` wrapper; use a **documented** pattern instead (e.g. tbody-only scroll with explicit column sync)—not implemented in the reference layout.
4. **Expand scroll (geometry only)**: `scrollExpandedSimulationIntoView` / `getPinnedRowTopY` in `src/lib/scrollExpandedSimulationIntoView.ts` must stay consistent with the stack: **`max(scenario.bottom, thead.bottom)`** plus gap when pinning the body row. **When** pinning runs is **not** expand-only — see **§ Simulation pin scroll (normative)** above (scenario key + sort order + `expandScrollFollowsScenarioSort`).

### Desktop reserves table column layout

The desktop reserves table uses `table-fixed` with a `<colgroup>` so column widths and spacing are predictable. When changing column count or visual balance, update all three places: `ReservesTable.tsx` (colgroup + header cells + skeleton row) and `DesktopReserveRow.tsx` (body cells).

Sticky scenario + sticky `<thead>` and **scrollport** constraints are **normative** in **§ Desktop reserves table: sticky stack and scrollport (normative)** above—do not regress them when editing column layout.

**Column order and widths (percentages, sum = 100%):**

Column order follows the **DeFi/lending convention**: Asset → Network/Market sit adjacent (Aave UI / Compound / Spark / Morpho). The mental model is "*which token, on which market, at what price*" — Market belongs next to Token, not after Price.

| Column  | Width | Notes |
|---------|-------|--------|
| Token   | 14%   | identifier — `[max-width:max-content]` on symbol so ↗ stays adjacent to text |
| Market  | 14.5% | Sits adjacent to Token (DeFi convention) |
| Price   | 8%    | Tabular number ($X.XX); narrow on purpose so chip→price visual gap doesn't gape |
| Size    | 12%   | |
| Utilization | 13%   | |
| Supply  | 12.5% | |
| Spread  | 12%   | |
| Borrow  | 14%   | |

**Cell padding (horizontal):** — column-gap and edge-padding are centrally controlled by **three** CSS variables in `src/index.css` and applied through a small set of utility classes. Do **not** sprinkle ad-hoc `pl-*` / `pr-*` on individual cells — it makes the table impossible to retune and makes it trivial to drift below the minimum-visible-gap floor. The variables are **breakpoint-driven** (this is L2 of the 4-layer adaptive compression model — see `DESIGN-SYSTEM-REFERENCE.md` §4.2): they shrink on narrow desktops and expand on wide ones, so padding doesn't sit there as a px constant while the column-width percentages are doing all the responsive work.

The split between column-gap and edge-padding is intentional: the edge of the table (Token's left side, Borrow's right side) borders the **card / container**, which is a different visual relationship than column-to-column. Edge padding therefore runs **1.5–2× the column gap** so the table's outer bounds get more breathing room than the column-to-column seams.

```css
:root {
  /* < 1024 px — narrow desktop (base values) */
  --ds-reserves-col-gap-header: 8px;
  --ds-reserves-col-gap-body:  10px;
  --ds-reserves-edge-pad:      12px;   /* outer padding for first/last cols */
}
@media (min-width: 1024px) {
  :root {
    /* 1024 – 1439 px — typical desktop */
    --ds-reserves-col-gap-header: 10px;
    --ds-reserves-col-gap-body:  12px;
    --ds-reserves-edge-pad:      16px;
  }
}
@media (min-width: 1440px) {
  :root {
    /* ≥ 1440 px — wide desktop, more breathing room */
    --ds-reserves-col-gap-header: 12px;
    --ds-reserves-col-gap-body:  14px;
    --ds-reserves-edge-pad:      20px;
  }
}
```

Resulting visible-gap-per-tier table (every adjacent column pair, uniform across the row; edge column outer-pad shown alongside):

| Viewport tier | `<th>` col gap | `<td>` col gap | Edge pad | Edge / col-gap ratio |
|---|---|---|---|---|
| < 1024 px (narrow desktop) | **8 px** | **10 px** | **12 px** | 1.5× / 1.2× |
| 1024 – 1439 px | **10 px** | **12 px** | **16 px** | 1.6× / 1.33× |
| ≥ 1440 px | **12 px** | **14 px** | **20 px** | 1.67× / 1.43× |

> **Narrow-tier note**: at < 1024 px, the header col-gap sits *exactly* at the trailing-icon floor (10 px is the body, header is 8 px which is below the icon floor — but headers do **not** have trailing icons, only sort arrows, so the plain 8 px floor applies and the table is still safe). If a future change adds a trailing icon to a header cell, the narrow-tier header col-gap must rise to ≥ 10 px.

Each interior cell side pads = `gap / 2` (so `pr` of column N + `pl` of column N+1 = exactly the configured gap). Edge sides — Token's left padding and Borrow's right padding — use `--ds-reserves-edge-pad` so the table's outer bounds breathe more than its column-to-column seams (1.4–1.7× across tiers). **Don't** silently revert edge padding to `var(--ds-space-2)` (which equals or under-runs the col-gap); it makes the table look "stuck to the card walls".

Utility classes (defined in `src/index.css`, must be used unchanged on every cell):

| Class | Where to use |
|---|---|
| `ds-reserves-cell-th` | header middle columns (Price, Market, Size, Utilization, Supply, Spread) |
| `ds-reserves-cell-th-edge-l` | header Token cell |
| `ds-reserves-cell-th-edge-r` | header Borrow cell |
| `ds-reserves-cell-td` | body middle columns |
| `ds-reserves-cell-td-edge-l` | body Token cell |
| `ds-reserves-cell-td-edge-r` | body Borrow cell |

**Header / body / skeleton must use the same utility set** (see `LoadingState.tsx` for skeleton). To retune the whole table, change the values inside the three tier blocks (`:root` base + the two `@media` overrides) — never ad-hoc-override an individual cell back to a raw `pl-*` / `pr-*`. Outer edges (Token left, Borrow right) follow `--ds-reserves-edge-pad` (12 / 16 / 20 px per tier).

**Cross-column minimum visible gap (mandatory, generic)** — *this is the portable rule; see `DESIGN-SYSTEM-REFERENCE.md` §4 「相邻列最小可见 gap」 for the cross-project version.* Every adjacent column pair in any multi-column layout (table, grid, side-by-side panels) must keep a **fixed minimum visible gap** so that text, numbers, and trailing icons in adjacent columns never read as one merged blob or overlap at narrow viewports. Floor: **≥ `--ds-space-2` (8 px)** for plain text columns; **≥ 10 px** when one side ends with a trailing icon (external link `↗`, menu trigger, chevron). Header / body / skeleton must share the same gap; only-grow-never-shrink — never let a single row type drop below the floor. In this codebase, the floor is enforced via `--ds-reserves-col-gap-*` and the `ds-reserves-cell-*` utilities described above.

**Column alignment contract (mandatory, see `DESIGN-SYSTEM-REFERENCE.md` §4.3)** — the desktop reserves table assigns alignment by content type, not by aesthetic preference. **Visual gap = padding gap + center-margin余量**, so the only way to keep the table from looking "uneven" while keeping a uniform padding gap is to eliminate center余量 by switching to left / right alignment for content-leading columns:

| Column | `<th>` / `<td>` | Inner flex | Sort arrow position |
|---|---|---|---|
| **Token** (identifier) | `text-left` | `flex w-full justify-start`; `group/token … justify-start`; symbol span `[max-width:max-content]` | label right (`<span>Token</span> ↓`) |
| **Market** (chip) | `text-center` | `flex justify-center` (unchanged) | label right (default) |
| **Price** (tabular num) | `text-right` | — | label left (`↓ <span>Price</span>`) |
| **Size** (num + ring) | `text-right` | `flex flex-col items-end`; per-row `inline-flex items-center gap-1.5`; **rows without cap render a transparent 12×12 ring placeholder** (`<span aria-hidden className="inline-block w-3 h-3 shrink-0" />`) | dropdown chip; outer `flex justify-end` |
| **Utilization** (num + bar) | `text-right` | `inline-flex items-center justify-end gap-1.5 w-full`; bar prefix → `flex flex-col items-end` numeric stack | dropdown chip; outer `flex justify-end` |
| **Supply** (APY + incentive) | `text-right` | `flex flex-col items-end`; secondary row `justify-end` | dropdown chip; outer `flex justify-end` |
| **Spread** (tabular num) | `text-right` | — | label left (`↓ <span>Spread</span>`) |
| **Borrow** (APY + incentive) | `text-right` (edge-r) | `flex flex-col items-end`; secondary row `justify-end` | dropdown chip; outer `flex justify-end` |

**Ring / decorator placeholder contract (mandatory)** — Size column has rows with cap rings (`CapProgressRing` / `BorrowCapProgressRing`) and rows without (when `supplyCapUsd` / `borrowCapUsd` is null). Without a placeholder, the numeric column shifts horizontally between "has-ring" and "no-ring" rows because the ring takes 12 px + 6 px gap on the right of the number. The fallback (no-cap) branch must render a 12×12 transparent placeholder (`<span aria-hidden className="inline-block w-3 h-3 shrink-0" />`) so the numeric right edge stays in the same column position across rows. Same principle applies to any future right-aligned column that mixes "decorated" and "plain" cells.

The `LoadingState.tsx` skeleton **must** mirror this alignment per cell (`ml-auto` for right-aligned numeric placeholders, `items-end` for stacked numeric placeholders, `justify-start` for the Token icon + symbol pair). A loading-to-loaded transition that shifts content horizontally is a regression — fix the skeleton, don't accept the flicker.

The single jsdom test that locks this in is `DesktopReserveRow.test.tsx` *"aligns numeric columns ... to the right per industry-standard dense-table convention"* — it asserts `text-right` on Price/Supply/Spread/Borrow, `items-end` on the Supply/Borrow column flex, and reverse-asserts that no numeric cell silently drifts back to `text-center`.

**Pairwise padding rule (mandatory)** — when a cell contains a trailing icon (external-link, overflow-menu trigger, chevron) and the adjacent cell starts with tabular digits (price, percent, size), **both** must contribute padding. Do **not** try to solve the overlap by padding only one side; the side with the icon needs `pr ≥ space-2`, and the receiving side needs `pl ≥ space-1-5`. With the breakpoint-driven utility classes above, this is automatically satisfied at every tier because every interior side contributes `gap/2`: header 4 / 5 / 6 px, body 5 / 6 / 7 px (narrow / mid / wide). The narrow-tier body sum (5 + 5 = 10 px) sits exactly at the trailing-icon floor, which is the worst case in this table — anything narrower than 1024 px is by design the tightest layout the desktop view supports.

**Token cell overflow-containment invariants (mandatory, narrow-viewport regression guard)** — at ~768–900 px desktop widths the Token column (13%) is too tight to fit icon + symbol + optional snowflake + `AssetActionMenu` on one line. Padding alone cannot fix this because the inner `inline-flex` grows to content width and overflows **past** the cell boundary into the Price column. All four invariants must hold (enforced by `DesktopReserveRow.test.tsx`):

1. `TableCell` for Token has `overflow-hidden` as a containment fallback.
2. The cell's inner flex is `flex w-full min-w-0 items-center justify-center` (**not** `inline-flex`), so the container matches cell width and can shrink.
3. The `tokenSymbol` `<span>` uses `break-words min-w-0`. This is the only element allowed to shrink; the symbol stays on one line whenever it fits and **wraps** to a second line when it does not (single-line first, wrap-only-when-needed — see DESIGN-SYSTEM-REFERENCE §3 / §4 / §4.1 path B). **Never** use `truncate` / tail ellipsis (information loss) or `break-all` (per-character wrapping) on token symbols.
4. `TokenIcon`, the snowflake `<span>`, and `AssetActionMenu` (via `triggerClassName="shrink-0"`) all carry `shrink-0`. Without this, flex pressure squashes them out of view and the cell silently loses the action icon at narrow widths.

**Diagnosis workflow when an icon/arrow "overlaps" an adjacent column:**

0. **Measure the current gap first (cheapest step)**: sum `pr-*` of the icon's column and `pl-*` of the receiving column. If the result is below the floor (8 px / 10 px-with-trailing-icon), **fix the gap before doing anything else** — most "merged blob" symptoms vanish here. If the table already uses the centralized `ds-reserves-cell-*` utilities, retune `--ds-reserves-col-gap-{header,body}` once instead of editing per-cell.
1. **Reproduce at wide viewport first**: if it only breaks below ~1000 px, treat it as an **overflow** problem (invariants above), not a padding problem.
2. Identify which cell the icon lives in (the overlap is almost always a *trailing* element of the previous column — e.g. the `↗` seen next to Price is really the Token cell's `AssetActionMenu`).
3. **Padding path**: inspect that column's `pr-*` and the next column's `pl-*`; their sum is the visible gap. Prefer raising both sides by one step (or, again, retune the central CSS variable).
4. **Overflow path**: verify the four invariants above; `overflow-hidden` + `flex w-full min-w-0` + `break-words` + `shrink-0` siblings. Padding tweaks are a no-op here.
5. Update header **and** body **and** any skeleton row together; header-only fixes look correct at rest but regress the moment data renders. With the centralized utilities, this is automatic — *as long as nobody re-introduces a raw `pl-*` / `pr-*`*.
6. jsdom unit tests cannot verify real layout — guard with **structural class assertions** (as done in `DesktopReserveRow.test.tsx`) and, when pixel accuracy matters, a Playwright e2e with `getBoundingClientRect` on the trailing icon vs the next cell's first text node.

### Borrow availability constraint

- Available to borrow = `min(Available Liquidity + Supply Input, Borrow Cap Remaining)`
- When user input exceeds limit, show which constraint is binding ("limited by available liquidity" or "limited by borrow cap")
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
- **Inner Corner (Concave curve) Implementation**: The junction where the inactive side connects to the simulation panel must look like a continuous native rounded corner.
  - **Core Principle (Root Cause Fixes over Patches)**: When facing visual artifacts (residual lines, seams, discontinuity), solve the architectural root cause (e.g., removing the conflicting underlying border) instead of masking the symptom. Do not stack patches on top of patches.
  - **Avoid Multi-layer Patching**: Do NOT use overlapping masks, CSS boxes, or "background patches" to hide the underlying border. This always leaves 1px residual lines or antialiasing seams.
  - **Single Source of Truth (Clip-path + SVG)**: Use `clipPath` on the lower container to cleanly cut out its native top border exactly at the connection point. Then, place a single SVG element to draw the entire transition (vertical line → arc → horizontal line).
  - **Geometric Precision**: Use standard SVG `A` (Arc) commands to draw the curve. Do not use `C` (Cubic Bezier) to hand-tune a fake corner, as it lacks the correct visual rhythm of a native `border-radius`.
  - **Sub-pixel Alignment & Mirroring Exactness**: When drawing a 1px stroke in SVG to match CSS borders, coordinates must be aligned to `.5` (e.g., `M 0.5 0 L 0.5 0.5 A ...`) to ensure pixel-perfect rendering without blurry antialiased edges. **Crucially, when mirroring the right side of a container, the x-coordinate must be `width - 0.5` (e.g., `16.5` for a `17px` box), not integer-rounded, to prevent 1px offset gaps.**
- **Rule**: Never add `rounded-t-*` to the simulation panel container; the top edge is always joined to the card above.
- The simulation sub-row does not show a “Shared APY/APR simulation” heading (desktop or mobile); table inputs and the Simulation toggle already establish context.

#### Bridge + SVG junction debugging playbook (normative)

When the expanded-card / simulation-panel junction shows visual artifacts (seam lines, corner notches, gaps), follow this checklist **in order**. Each item is a known root cause discovered through systematic debugging.

##### 1. Bridge must cover the panel's top border (z-10 overlay approach)

The bridge div (`bg-card`, `position: absolute`, `z-10`) sits above the simulation panel (`z-0`) and physically covers the panel's `border-top` on the expanded side. **Do NOT use `clipPath` to hide the panel's top border** -- clipPath anti-aliasing creates a visible seam line even when covered by a z-10 bridge. Instead, let the bridge's opaque `bg-card` at a higher z-index simply paint over the panel's border.

##### 2. Bridge border -- outer side only, inner side drawn by SVG

The bridge must have only the **outer** border (`border-l` when expanded card is on the left, `border-r` when on the right) to continue the expanded card's outer border through the gap. The **inner** border (fillet side) must NOT be on the bridge -- the SVG stroke already draws that vertical line and continues it into the arc. If both the bridge CSS border and the SVG stroke draw at the same x-coordinate, **Safari/WebKit renders a doubled vertical line** (sub-pixel overlap artifact) that is invisible on desktop and Android but visible on iPhone.

##### 3. Bridge height must account for grid row height mismatch

**Key pitfall**: In the `grid-cols-2` layout, the `variant="upperOnly"` card (expanded) is shorter than the `variant="full"` card (inactive) because the inactive card includes a collapsed simulation grid container (`gridTemplateRows: '0fr'`). CSS grid stretches both cell wrappers to the taller row height, creating **invisible extra space below the shorter card**.

The bridge's `top: calc(-1 * var(--ds-space-2))` only reaches the grid row bottom, NOT the expanded card's actual bottom. This leaves a gap where page background shows as a visible horizontal line.

**Fix**: Extend the bridge upward by an extra margin (currently `4px`) beyond the `mt` gap:
```css
top:    calc(-1 * var(--ds-space-2) - 4px)
height: calc(var(--ds-space-2) + 5px)      /* gap + overlap + extra */
```
Since both card and bridge use `bg-card`, the overlap into the card area is invisible.

**Diagnostic technique**: Temporarily set the bridge to `bg-red-500` to visualise its exact coverage. If the red area sits below the visible line, the bridge isn't reaching far enough -- increase the upward extension.

##### 4. SVG fill must start at y=0 -- no sub-pixel gap at top

The SVG fill path must extend to the SVG's top edge (`y=0`), not start at `y=0.5`. A `0.5px` unfilled strip at the top creates a visible notch where the bridge's right border meets the SVG.

##### 5. SVG stroke must start at y=0 -- continuous vertical line

The SVG stroke path must begin at `y=0` (e.g., `M 0.5 0 L 0.5 4.5 A ...`), drawing the vertical border line from the SVG top all the way down to the arc start. If the stroke begins at the arc start (e.g., `M 0.5 4`), the gap between `y=0` and `y=4` has only a fill edge with no stroke, creating a visible notch at the fillet's starting point.

##### 6. SVG dimensions must match bridge extensions

When the bridge is extended (e.g., extra 4px upward), the SVG must be extended by the same amount:
- `viewBox` and `height`: increase to match (e.g., `0 0 17 13` for a 13px-tall SVG)
- `top`: same as bridge top (e.g., `calc(-1 * var(--ds-space-2) - 4px)`)
- Fill and stroke y-coordinates: shift the arc/horizontal portions down by the same offset (e.g., arc at `y=12.5` instead of `y=8.5`)

##### Summary of current implementation values

| Element | Property | Value | Reason |
|---------|----------|-------|--------|
| Bridge | `top` | `calc(-1 * var(--ds-space-2) - 4px)` | Covers grid row height mismatch |
| Bridge | `height` | `calc(var(--ds-space-2) + 5px)` | Gap (8px) + panel overlap (1px) + extra (4px) |
| Bridge | `border` | `border-l` or `border-r` (outer only) | Inner side drawn by SVG; `border-x` causes Safari doubled-line |
| SVG | `viewBox` | `0 0 17 13` | Matches bridge height |
| SVG | `top` | Same as bridge | Aligned with bridge |
| SVG fill | Start | `y=0` | No sub-pixel gap |
| SVG stroke | Start | `M 0.5 0` / `M 16.5 0` | Continuous vertical line |
| Panel | `clipPath` | **None** | Removed -- bridge covers top border |
| Panel | `border` | `border border-border/60` | Full border; bridge hides top on expanded side |

##### Component extraction safety checklist (normative)

When extracting the card–panel junction into a separate component (e.g. `MobileExpandedReserveShell`), every visual contract listed above must be preserved. The following items have been lost in past refactors and caused regressions:

| Must preserve | What to check | Why it breaks if lost |
|---|---|---|
| **Bridge `border-l` / `border-r`** | Bridge div must have the outer-side CSS border class | Without it, the expanded card's outer border is not continued through the gap — visible gap on all browsers |
| **SVG fillet** | Must import and render `getMobileSimulationJunctionFilletPaths` + `MOBILE_SIMULATION_JUNCTION_GEOMETRY` from `mobileSimulationJunction.ts` | Without it, the inner concave corner is a hard right angle — breaks the continuous-card illusion |
| **Bridge geometry constants** | Must use `MOBILE_SIMULATION_JUNCTION_GEOMETRY` (`bridgeTop`, `bridgeHeight`, `filletTop`, `filletWidth`, `filletHeight`), not simplified values | Simplified values (e.g. `calc(-1 * var(--ds-space-2))` without the extra `4px`) do not cover the grid row height mismatch — causes iOS Safari subpixel seam |
| **`border-b-transparent`** on upper card | The `connectedBelow` branch in `MobileReserveCard` must use `border-b-transparent`, **not** `border-b-0` | `border-b-0` removes border width from the box model, shifting layout by 1px; `border-b-transparent` keeps width and only hides the color |

**Rule**: When refactoring visual junction code into a new component, diff the old inline rendering output against the new component's output. Every `className`, `style`, and SVG element in the junction area must produce identical DOM. A visual-only refactor must not change any computed style.

## Simulation breakdown table — Grid layout (mobile)

The Simulation expansion table (`SimulationSubRow.tsx`, compact layout) renders
four columns: label, Current, After, Δ. The compact layout uses **CSS Grid**
(not `<table>`) so the long label `Supplied / Cap $19.50M` can naturally wrap
onto a second line when both pieces cannot fit, instead of triggering horizontal
overflow.

Evolution: the original `table-auto` allowed Δ overflow on extreme inputs;
`table-fixed` + percentage `<col>` widths fixed overflow but could not gracefully
wrap a long label. The current Grid approach gets both: no horizontal scroll AND
clean two-line wrapping when needed.

Rules — must hold for any future change:

1. **Use Grid `grid-cols-[1fr_auto_auto_auto]`** in `renderCompactLayout` so the
   label column flexes (`1fr`) and numeric columns size to content (`auto`).
   Do not reintroduce `<table>`, `table-fixed`, or `<colgroup>` in the compact
   path. Desktop `renderTable` keeps `table-fixed` and is unaffected.
2. **Label cell wraps via flex-wrap between unbreakable spans**: the label cell
   contains a `<div className="flex flex-wrap items-baseline">` with the label
   `<span>` and the cap `<span>` as children, both `whitespace-nowrap`. This
   keeps each token unbroken but lets the cap drop to a second line when needed.
3. **Numeric cells** (Current / After / Δ + their `columnheader` cells) must
   carry `whitespace-nowrap` on both the cell `<div>` and the inner `<span>`,
   plus `tabular-nums ds-text-11` on the span so values fit and align.
4. **A11y**: container is `<div role="table" aria-label="Simulation breakdown">`;
   each row uses `display: contents` with `role="row"`; cells use `role="cell"`;
   header cells use `role="columnheader"`. Backgrounds (warning / disabled
   opacity) must be applied **per-cell** because `display: contents` parents do
   not paint.
5. **No horizontal overflow**: never reintroduce `overflow-x-auto` /
   `overflow-x-scroll` on the compact wrapper or any ancestor inside
   `MobileExpandedReserveShell`.
6. **Cap progress / cap note rows** span all 4 columns via `col-span-4`. Do not
   introduce custom rows that break the 4-column rhythm.

Regression tests:

- Source-level invariants (Grid classes, no `<table>`, role attributes):
  `src/components/dashboard/SimulationSubRow.compact.test.tsx`.
- RTL render behavior (label cell flex-wrap structure, no overflow-x, a11y
  roles, cap warning highlighting, frozen-state mask):
  `src/components/dashboard/SimulationSubRow.compact.render.test.tsx`.

Do not delete either test. The full design plan lives at
[`docs/specs/2026-05-10-mobile-simulation-grid-layout-plan.md`](../specs/2026-05-10-mobile-simulation-grid-layout-plan.md).

## Mobile ReservesTable bottom spacing (normative)

The mobile `ReservesTable` component ends with a bottom padding that reserves space so the last rows are not hidden behind the mobile browser's bottom navigation bar (safe-area inset). **This padding must stay compact** — large values create a visible empty gap when `FaqSection` renders immediately below the table.

- **Rule**: Bottom padding must not exceed `pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]`. A previous `+5rem` (~80px) was reduced to `+1rem` (~16px) because it produced a blank gap between "Show More Reserves" and the FAQ section on mobile.
- The `+1rem` breathing room plus the safe-area inset is sufficient to keep the last card above the browser chrome without wasting vertical space.
- Implementation: `src/components/dashboard/ReservesTable.tsx` — the `isMobile` return block's outer `<div>` class.
- **Do not** increase this padding without verifying the gap between ReservesTable and FaqSection in a full mobile build.
