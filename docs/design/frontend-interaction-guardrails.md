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
- **Multi-paragraph explanatory tooltips** (e.g. scenario strip Net help): When Radix `@/components/ui/tooltip` carries more than a one-line hint, match the **body rhythm** of `DesktopTooltip`/`MobileTooltip` inner content (see `AprApyToggle.tsx`, FDV definition in `InkAprCalculator.tsx`): **`rounded-xl border border-border shadow-lg`**, padding **`px-4 py-3`**, wrapper **`space-y-2.5`**, copy **`ds-text-12`** + **`leading-relaxed`** (or `leading-snug`) + **`text-muted-foreground`**; optional **`border-t border-border pt-2.5`** only when two blocks need a hard visual break. Default TooltipContent padding plus stacked `mt-1.5` paragraphs alone reads cramped—override explicitly. Normative detail: **DESIGN.md §4.4 Tooltip**.

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

**UtilizationIndicator color scheme** (minimize same-hue steps: one **zone tint** + one **full semantic** per state):
- Below optimal (borrow-friendly / flatter borrow curve): track zone `fill-[rgb(var(--ds-brand-cyan-rgb)/0.32)]`; dot **full** `fill-[rgb(var(--ds-brand-cyan-rgb))]` — same as Borrow (`ds-text-brand-cyan`), not emerald; avoid mixing `-70` text with other cyan opacities
- Above optimal (past kink): track `fill-amber-500`; dot `fill-amber-600` (same as warning copy), not a third amber step
- **Dot visibility (no extra hue, no outline habit)**: single **solid** dot (slightly larger radius is OK); **do not** add outer glow discs, `stroke` halos, or extra opacity rings by default
- Tooltip / mobile sheet: “Below optimal” uses `ds-text-brand-cyan`; “⚠️ Above optimal” uses `text-amber-600`

**Supply / Borrow APY typography (desktop table + mobile hero)** — same hierarchy rules:
- **Primary total APY**: `font-bold`, `ds-text-14` (desktop) or `ds-text-24` (mobile hero), semantic fill `ds-text-emerald-500` (Supply) / `ds-text-brand-cyan` (Borrow)
- **Secondary row** (native + incentive): `ds-text-11`, native uses `ds-text-emerald-500-70` / `ds-text-brand-cyan-70` with optional `font-medium`; incentive chips stay on the existing tinted pill pattern (`ds-bg-*-10`, `-70` text). **This row is not the same as Size** (see below).
- **Pill visuals are interactive-only**: in this project, rounded/tinted pill style is reserved for clickable controls. Use `button`/`a` semantics with clear hover/focus states. For read-only values, use plain text (not pill styling).
- **Size column** (Supply/Borrow amounts): `ds-text-13` + `font-medium` + **full** semantic (`emerald-500` / `brand-cyan`)—aligned with APY **primary** color, **not** with the Native/Incentive row (which is smaller + `-70` by design).
- **Spread column**: `font-bold` + `ds-text-14` + purple semantic—treated as a **primary numeric** column alongside Supply/Borrow totals.
- **Mobile parity**: Supply/Borrow tab, **size row**, cap sheets, and incentive chips use the **same** emerald/cyan tokens as desktop (`emerald-500` / `brand-cyan`), not a darker step (e.g. avoid `emerald-600` for Supply size when desktop uses `emerald-500`); utilization figure next to the indicator uses at least `ds-text-11`

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

- **Terminology (Tydro vs Merkl labels)**: only Merkl’s optional `pointsPerThousandUsd` path is treated as Tydro (`src/lib/tydro.ts`, `tydroPointToUsdRate`). `Merit` / `Brevis` / protocol incentives are not Tydro points. Aggregate UI labels can stay as **Merkl** / **Merkl Incentive**; use “Tydro” only when explaining the points-to-APR conversion or the global point-to-USD control. Unrelated “points” (e.g. Ink FDV reference points) are not Tydro.
- **Incentive tooltip vs shared simulation**: `IncentiveTooltip` shows **static** incentive context (campaign dates, messages, Merkl whitelist opt-in). **Deposit- and TVL-dependent** forecasts (Merkl hypothetical TVL, Merit Self deposit-ceiling lines, FIX rewardable horizon, Brevis per-user cap / days-to-cap, cap-binding warnings, etc.) belong in the **shared rate simulation** UI (`useRateSimulation` per-campaign rows on `SimulationSubRow` via `capNote` / `capWarning`), not inside the tooltip. Merit **Base** and Merkl **DUTCH_AUCTION** use **no** row `capNote` (scenario APR only); keep that policy in sync if it changes. **New** user-visible cap/ceiling lines should be produced via `src/lib/incentiveCeilings.ts` (then mapped to `capNote` / `capWarning`) where applicable—see `docs/rate-calculation-formulas.md` (Incentive Reward Cap Reference, naming layers).
- **Grouped incentive traversal**: Merkl and Brevis both enter shared UI helpers as **group + `breakdowns[]`** structures. Shared iteration/filtering/labeling belongs in `src/lib/campaignGroups.ts`; Brevis-specific legacy fallback (`top-level field -> breakdown field`) belongs in `src/lib/brevis.ts` via **one** normalization entrypoint (`getBrevisResolvedBreakdown`). Do **not** spread `breakdown.foo ?? getBrevisFoo(group)` chains across tooltip / formatter / simulation code.
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

### Desktop reserves table: sticky stack and scrollport (normative)

This section is **mandatory** for anyone changing desktop `ReservesTable` layout, overflow, or sticky headers.

#### Why (one-line mental model)

`position: sticky` **`top` is resolved against the element’s nearest scrollport**, not always the viewport. If the scenario bar uses viewport-relative `sticky top-0` (page scroll) while `<thead>` sits inside a wrapper with `overflow-x-auto` (or similar), the header’s `top: …px` is measured from **that wrapper’s top**, not the viewport. The two layers then **misalign**: a **large empty band** appears under the scenario strip, and **tbody content scrolls through that band** above the header (visible “bleed” / clipped row fragments).

#### Rules

1. **Do not** wrap the **entire** `<table>` (including the sticky `<thead>`) in an ancestor with a non-default overflow that creates a **scrollport** between the card and the table—most commonly **`overflow-x-auto`** or **`overflow: hidden`** on a full-table wrapper—while the shared scenario strip above uses **`sticky top-0`** against page scroll and `<thead>` uses **`top: var(--reserves-sticky-scenario-height, …)`** meant to stack under the scenario strip in **viewport** coordinates.
2. **Do** keep the **reference structure** in `ReservesTable.tsx`:
   - **Desktop reserves card shell**: outer wrapper uses **`rounded-2xl bg-border/60 p-px`** plus an inner **`rounded-[calc(1rem-1px)] bg-card`** that holds scenario + table. This **1px gutter** draws a continuous outline without `overflow: hidden` (which would break viewport `sticky`). It avoids the common bug where a full-bleed sticky child’s opaque **`bg-card`** paints **over** the parent’s native **`border`** so **top rounded corners look clipped**—see **DESIGN-SYSTEM-REFERENCE** § 轮廓与圆角拼接 (structural fix, not mask stacks).
   - **`data-reserves-sticky-scenario`**: shared scenario strip, `sticky top-0 z-20`, **`bg-card`** (same opaque surface as sticky **`th`** headers so the control bar and column headers read as one continuous card top—avoid **`bg-muted/…` + backdrop blur on this wrapper**, which fights the thead). **`ScenarioControls`** on desktop may use a **borderless** tinted well (`bg-card/60`, `backdrop-blur-sm`) inside the padded strip; do **not** add a second full **`border`** around the entire control row (the reserves card gutter already frames the block). **Supply / Borrow**: labels keep emerald / brand cyan; **empty** inputs use **neutral** border (`border-border/…`) + transparent fill (no semantic border hue until filled); **filled** tint matches border hue via **`cnDsInputSurface`**—see **DESIGN.md** §4.1 / §4.8.
   - **`data-reserves-sticky-thead`**: column header `<thead>` whose **`th`** cells use **`position: sticky`** (not only the `<thead>` itself—some engines composite tbody “through” a sticky thead unless each **`th`** paints its own opaque layer), **`top: var(--reserves-sticky-scenario-height, 4.5rem)`**, **`z-30`** (implementation in `ReservesTable.tsx`; must stay **above** expanded main-row `td` at **`z-[25]`**), **`bg-card`**, bottom border / light shadow; header **`tr`** should not use translucent row hover (`hover:bg-card` overrides the shared `TableRow` default).
   - **Expanded reserve main row (desktop)**: when a row is expanded, its **main data `tr`**’s **`td`** cells use **`position: sticky`** with **`top: var(--reserves-expanded-main-row-top, …)`** (px sum of scenario strip + `<thead>` height, set on the card via `ResizeObserver` in `ReservesTable.tsx`), **`z-[25]`** (below sticky **`th`** at `z-30`), opaque **`bg-card`**, and a light bottom border/shadow so the token/price/market row stays visible while the user scrolls the large **`SimulationSubRow`** block—aligned with **§ Simulation pin scroll** (anchor row identity, not only the sub-panel).
3. **Horizontal overflow**: With `table-fixed` and `%` columns, prefer **page-level** horizontal scroll on narrow desktop. If table-local horizontal scrolling is **required**, **do not** reintroduce a full-table `overflow-x-auto` wrapper; use a **documented** pattern instead (e.g. tbody-only scroll with explicit column sync)—not implemented in the reference layout.
4. **Expand scroll (geometry only)**: `scrollExpandedSimulationIntoView` / `getPinnedRowTopY` in `src/lib/scrollExpandedSimulationIntoView.ts` must stay consistent with the stack: **`max(scenario.bottom, thead.bottom)`** plus gap when pinning the body row. **When** pinning runs is **not** expand-only — see **§ Simulation pin scroll (normative)** above (scenario key + sort order + `expandScrollFollowsScenarioSort`).

### Desktop reserves table column layout

The desktop reserves table uses `table-fixed` with a `<colgroup>` so column widths and spacing are predictable. When changing column count or visual balance, update all three places: `ReservesTable.tsx` (colgroup + header cells + skeleton row) and `DesktopReserveRow.tsx` (body cells).

Sticky scenario + sticky `<thead>` and **scrollport** constraints are **normative** in **§ Desktop reserves table: sticky stack and scrollport (normative)** above—do not regress them when editing column layout.

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
