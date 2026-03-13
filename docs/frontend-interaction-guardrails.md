# Frontend Interaction Guardrails

This note records recurring UI/interaction issues found during incentive/forecast work, so future changes keep behavior consistent.

## A. Frontend-wide guardrails (generic)

### Tooltip / Overlay behavior

- **Distinguish auto-show vs click-to-show tooltips**:
  - **Auto-show tooltip (hover reveals)**: Use default cursor (no `cursor-pointer`). Add subtle hover feedback like `hover:opacity-80`, `hover:scale-110`, or `hover:bg-muted/60` so the user knows the element is interactive.
  - **Click-to-show tooltip/popover**: Use `cursor-pointer`. Add stronger hover feedback like `hover:ring-2`, `hover:bg-xxx` with increased opacity/saturation.
  - Never use `cursor-pointer` for auto-show tooltips — it implies a click action that doesn't exist.
  - Never use `cursor-help` (question mark cursor) — it's not part of our design system.
- **All interactive elements must have visible hover state**: even auto-show tooltips need visual feedback on hover (e.g. subtle scale, opacity change, or background highlight).

#### Implementation examples

**Auto-show tooltip** (e.g. `CapProgressRing`):
```tsx
// NO cursor-pointer, subtle hover feedback only
<div className="inline-flex items-center p-0.5 -m-0.5 rounded-full transition-all duration-150 hover:bg-muted/60 hover:scale-110">
  {/* content */}
</div>
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

## Debugging checklist for incentive UI regressions

When tooltip/forecast behavior looks wrong, check:

1. **Display mode**: APR vs APY toggle consistency
2. **Source scoping**: current reserve/source only (especially whitelist toggles)
3. **Forecast source type**: Merkl vs Merit (campaign-wide vs user-specific semantics)
4. **Viewport constraints**: clipping, scrollability, fixed overlay behavior
5. **Token normalization**: symbol alias handling in search and display
