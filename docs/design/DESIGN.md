# Design System: Aave APY

> **可复用设计习惯与完整交互规范**见 **[DESIGN-SYSTEM-REFERENCE.md](DESIGN-SYSTEM-REFERENCE.md)**（同目录，Tooltip/光标/开关/色彩语义/移动端/无障碍等）。其他项目可直接复制该文档作为设计参考。下面为本项目视觉与组件概要。

## Scope and Canonical Boundaries

- This file is the **project profile** (theme, token usage, component-level defaults).
- Product-critical normative behavior lives in [`frontend-interaction-guardrails.md`](./frontend-interaction-guardrails.md).
- Reusable cross-project design habits live in [`DESIGN-SYSTEM-REFERENCE.md`](./DESIGN-SYSTEM-REFERENCE.md).
- If guidance conflicts, use this precedence:
  1. `frontend-interaction-guardrails.md` (normative behavior)
  2. `DESIGN-SYSTEM-REFERENCE.md` (reusable system rules)
  3. `DESIGN.md` (project profile and local defaults)

## 1. Project Visual Profile

- Light: warm off-white base + amber primary + magenta→cyan brand gradient.
- Dark: deep charcoal base with the same radii/spacing hierarchy.
- Primary semantic pairs used throughout reserve surfaces:
  - Supply: `ds-text-emerald-500` / `ds-bg-emerald-500-10`
  - Borrow: `ds-text-brand-cyan` / `ds-bg-brand-cyan-10`
  - Spread: `ds-text-purple-600`
  - Warning: amber scale

## 2. Project-specific Defaults

- Numeric data should use `tabular-nums`; APY primary value remains `font-bold`.
- Desktop reserve **Size** values keep `font-medium tabular-nums` and same semantic tokens as APY primary.
- Keep mobile and desktop semantic color usage aligned (only layout differs).
- Input surface behavior uses `cnDsInputSurface` (`neutral`/`magenta`/`supply`/`borrow`); avoid custom `bg-*`/`border-*` overrides that break state semantics.
- Minimum text-to-border breathing room: `--ds-space-2` (8px).

## 3. Canonical Topic Map

Use this file as an index, not a full rulebook:

- Full reusable component/spacing/typography patterns: [`DESIGN-SYSTEM-REFERENCE.md`](./DESIGN-SYSTEM-REFERENCE.md)
- Product-critical reserve interactions (sticky stack, simulation scroll, whitelist behavior): [`frontend-interaction-guardrails.md`](./frontend-interaction-guardrails.md)
- Incentive terminology and Tydro points semantics: [`../rate-calculation-formulas.md`](../rate-calculation-formulas.md)

## 4. Quick Decision Rules

- If a rule affects behavior or regression risk, document it in `frontend-interaction-guardrails.md`.
- If a rule is reusable across projects, document it in `DESIGN-SYSTEM-REFERENCE.md`.
- Keep `DESIGN.md` focused on project identity and defaults only.
