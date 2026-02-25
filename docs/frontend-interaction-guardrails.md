# Frontend Interaction Guardrails

This note records recurring UI/interaction issues found during incentive/forecast work, so future changes keep behavior consistent.

## A. Frontend-wide guardrails (generic)

### Tooltip / Overlay behavior

- **Clamp desktop tooltips to viewport**: floating tooltips must not render below the viewport bottom.
  - Use a max height (`max-h`) and internal scroll (`overflow-y-auto`).
  - Recompute position on resize, scroll, and content-size changes (e.g. `ResizeObserver`).
- **Use flip placement before aggressive clamping**: if bottom space is insufficient, prefer rendering above the trigger (and vice versa).
  - Keep a consistent trigger/arrow gap for both placements.
  - Add a flip threshold (not just `space < height`) to avoid jitter near the viewport midpoint.
  - If the tooltip is heavily clamped and the arrow can no longer point cleanly to the trigger, hide the arrow rather than showing a misleading one.
- **Do not rely on page scroll for fixed overlays**: fixed-position tooltip content should remain usable even when the underlying page cannot scroll.
- **Whitelist toggles must be scoped**: only show per-tooltip controls when the current reserve/source actually has applicable items (avoid leaking global state into unrelated tooltips).

### Search behavior

- **Normalize token symbols for search**: search should match canonical aliases and symbol variants.
  - Example: `USDT` should match `USD₮`.
  - Normalize unicode / punctuation variants before filtering.

### Link generation

- Prefer rule-based URL generation with explicit overrides for exceptions.
- Keep hardcoded mappings only for special cases (legacy market names, naming mismatches).

## B. AaveAPY-specific guardrails (app-specific)

### Forecast UI consistency

- **APR/APY mode parity**: any forecast number shown inside a tooltip/panel must follow the same APR/APY mode selected in the main UI.
- **Label user-specific vs campaign-wide values**:
  - Merkl forecast rows usually show campaign-wide `Daily Rewards`.
  - Merit self-bonus forecast is user-specific and should be labeled clearly (e.g. `Your Daily Rewards`).
- **Avoid ambiguous eligibility wording**: if eligibility depends on external user state (e.g. Self verification) and is not known client-side, do not claim the user is currently eligible.

## Debugging checklist for incentive UI regressions

When tooltip/forecast behavior looks wrong, check:

1. **Display mode**: APR vs APY toggle consistency
2. **Source scoping**: current reserve/source only (especially whitelist toggles)
3. **Forecast source type**: Merkl vs Merit (campaign-wide vs user-specific semantics)
4. **Viewport constraints**: clipping, scrollability, fixed overlay behavior
5. **Token normalization**: symbol alias handling in search and display
