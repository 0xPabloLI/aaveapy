# PRD: Input Surface Normalization

## Problem

Two input fields violate the existing `cnDsInputSurface` design system (DESIGN.md §4):

| File | Violation | What it uses | What DS says |
|------|-----------|-------------|--------------|
| `WatchAddressInput.tsx` | Ad-hoc pill input | `HEADER_CONTROL_INPUT_CLASS` (`bg-card/60`, `border-border/40`, `rounded-full`) | `cnDsInputSurface('neutral')` |
| `PortfolioPanel.tsx` (×2) | Handwritten search + snapshot inputs | `bg-muted/40`, `border-border/50`, `rounded-lg` | `cnDsInputSurface` |

`cnDsInputSurface` is the single source of truth for all text inputs (DESIGN.md §7 Don't: *"Don't override input surface tokens with ad hoc bg-* / border-* classes"*).

**Symptoms**: Watch address input has a yellow-ish border (warm card hue=23 at 40% opacity) and inconsistent sizing (32px pill vs DS standard 40px). PortfolioPanel inputs use different border/background tokens from the rest of the app.

## Scope

### In scope
1. `WatchAddressInput.tsx` → `cnDsInputSurface('neutral')`
2. `WatchAddressInput.test.tsx` → update assertions
3. `PortfolioPanel.tsx` (2 inputs) → `cnDsInputSurface` (search = `magenta`, snapshot = `neutral`)
4. `headerControlStyles.ts` → delete `HEADER_CONTROL_INPUT_CLASS` (only consumer is WatchAddressInput)
5. `header-controls.test.ts` → remove `HEADER_CONTROL_INPUT_CLASS` guard assertions

### Out of scope
- `<input type="checkbox">` — has separate `DS_NATIVE_CHECKBOX_CLASS`
- `cnDsInputSurface` itself — no changes needed
- Other files already using `cnDsInputSurface` correctly (PortfolioTokenRow, ScenarioControls, ui/Input)

## Acceptance Criteria

1. All text `<input>` elements in the codebase use `cnDsInputSurface`
2. `HEADER_CONTROL_INPUT_CLASS` is removed from `headerControlStyles.ts`
3. No `bg-card/60`, `bg-muted/40`, `border-border/40`, `border-border/50` on any text input
4. `npm run lint && npm test && npm run build && npx tsc --noEmit` all pass
5. WatchAddressInput input visually matches DS neutral variant (transparent bg, `border-border/60`, magenta focus ring)
