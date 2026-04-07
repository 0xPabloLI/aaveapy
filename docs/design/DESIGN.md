# Design System: Aave APY

> `DESIGN.md` is the project profile. Keep it short, specific, and easy for agents to read. Reusable rules live in [DESIGN-SYSTEM-REFERENCE.md](DESIGN-SYSTEM-REFERENCE.md); product-critical behavior lives in [frontend-interaction-guardrails.md](frontend-interaction-guardrails.md).

## 1. Visual Theme & Atmosphere

- Warm, data-dense DeFi dashboard.
- Light mode uses off-white surfaces with emerald / cyan / purple accents.
- Dark mode keeps the same hierarchy, with deeper charcoal surfaces and the same semantic color roles.
- The UI should feel precise, analytical, and calm, not flashy.

## 2. Color Palette & Roles

### Core

- Background: warm off-white / deep charcoal
- Surface: card-like neutrals with subtle border contrast
- Text: high-contrast neutral, never pure decorative gray

### Semantic

- Supply: `ds-text-emerald-500` / `ds-bg-emerald-500-10`
- Borrow: `ds-text-brand-cyan` / `ds-bg-brand-cyan-10`
- Spread: `ds-text-purple-600`
- Warning: amber scale only

### Rule

- Use semantic colors for meaning, not decoration.

## 3. Typography Rules

- Use `tabular-nums` for numeric values.
- APY primary values stay `font-bold`.
- Desktop reserve `Size` values use `font-medium tabular-nums`.
- Secondary breakdown rows should stay visually lighter than the primary value.

## 4. Component Stylings

- Cards: quiet surfaces with soft borders, not heavy shadows.
- Inputs: use `cnDsInputSurface` variants (`neutral` / `magenta` / `supply` / `borrow`).
- Tables: keep column alignment strict; do not sacrifice readability for density.
- Buttons and pills: keep selected state obvious with border / fill contrast.

## 5. Layout Principles

- Keep mobile and desktop semantics aligned; only the layout should change.
- Reserve surfaces should stay symmetric across Supply / Borrow.
- Preserve breathing room between text and borders, especially in dense data cards.
- Prefer compact hierarchy over decorative whitespace.

## 6. Depth & Elevation

- Use subtle elevation only when it helps separation.
- Prefer border contrast and surface tint over big shadows.

## 7. Do's and Don'ts

### Do

- Keep theme tokens consistent across surfaces.
- Use semantic color pairs consistently across the product.
- Keep numeric data aligned and easy to scan.

### Don't

- Don't introduce new semantic colors for one-off UI states.
- Don't override input surface tokens with ad hoc `bg-*` / `border-*` classes.
- Don't let visual emphasis outrun the data hierarchy.

## 8. Responsive Behavior

- Mobile and desktop should share the same semantic meaning.
- Layout can collapse, but token usage should not drift.
- Touch targets must remain usable on compact screens.

## 9. Agent Prompt Guide

### Quick Reference

- Theme: warm DeFi dashboard
- Primary supply: emerald
- Primary borrow: cyan
- Spread: purple
- Warning: amber

### Example Prompts

- "Build a reserve card with warm neutral surfaces, emerald supply values, cyan borrow values, and a compact data-dense hierarchy."
- "Create a table view where numeric values use tabular alignment and the primary APY row stays visually strongest."
- "Design a mobile reserve card that keeps the same semantic colors as desktop and only changes layout, not meaning."

## Canonical Topic Map

Use this file as an index, not a full rulebook:

- Full reusable component/spacing/typography patterns: [DESIGN-SYSTEM-REFERENCE.md](./DESIGN-SYSTEM-REFERENCE.md)
- Product-critical reserve interactions (sticky stack, simulation scroll, whitelist behavior): [frontend-interaction-guardrails.md](./frontend-interaction-guardrails.md)
- Incentive terminology and Tydro points semantics: [../rate-calculation-formulas.md](../rate-calculation-formulas.md)

## Quick Decision Rules

- If a rule affects behavior or regression risk, document it in `frontend-interaction-guardrails.md`.
- If a rule is reusable across projects, document it in `DESIGN-SYSTEM-REFERENCE.md`.
- Keep `DESIGN.md` focused on project identity and defaults only.
