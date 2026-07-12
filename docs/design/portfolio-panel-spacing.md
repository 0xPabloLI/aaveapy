# PortfolioPanel — Spacing Tokens

This document codifies the spacing rules for the PortfolioPanel header so
the **Portfolio-mode toggle** stays in the exact same X position as the
**Single-mode toggle** in `ReservesTable.tsx`.

## Why this matters

In Single mode the toggle lives in a flex container next to
`ScenarioControls`:

```tsx
<div className="flex items-center gap-2">
  <ScenarioControls … />
  <div className="ml-auto shrink-0">
    <PortfolioModeToggle … />
  </div>
</div>
```

Its right edge therefore sits at `scenario-wrapper.right - 0`.

In Portfolio mode, the toggle is rendered inside the PortfolioPanel
header — a different DOM subtree. To keep the same X position we must
match the wrapper's effective right padding.

## Rules

1. **Never** use arbitrary `pr-[Npx]`, `mr-[Npx]`, `pl-[Npx]`, `ml-[Npx]`,
   `px-[Npx]`, or `mx-[Npx]` values in `PortfolioPanel.tsx`. Always go
   through a `var(--ds-space-*)` token.
2. Required tokens for the header row:

   | Side  | Mobile                         | Desktop                      |
   | ----- | ------------------------------ | ---------------------------- |
   | `pl`  | `pl-[var(--ds-space-1-5)]`     | _(none — outer container provides)_ |
   | `pr`  | `pr-[var(--ds-space-3)]`       | _(none — outer container provides)_ |
   | `py`  | `py-[var(--ds-space-2-5)]`     | `py-[var(--ds-space-3)]`     |
   | gap   | `gap-[var(--ds-space-1)]`      | `gap-[var(--ds-space-1)]`    |

   **Desktop**: the outer `data-reserves-sticky-scenario` container already
   provides `p-[var(--ds-space-3)]` (12px all sides), so the header div
   must NOT add its own pl/pr — doing so would double-pad and shift the
   toggle 12px left of the Single-mode toggle (AAV-1142 regression).

   **Mobile**: the outer container provides `-mx-[var(--ds-space-3)] px-[var(--ds-space-3)]`
   (full-width bleed), so the header div adds a small visual indent via
   `pl-[var(--ds-space-1-5)]` but no pr (outer container handles it).

3. The toggle is rendered as the **last child** of the cluster
   (`flex items-center gap-[var(--ds-space-1)]`). Do not wrap it in any
   extra margin/padding container.
4. The toggle's root `<label>` has `data-testid="portfolio-mode-toggle"`
   for stable E2E selector targeting.

## Enforcement

Four layers protect the spacing contract:

1. **ESLint** (`eslint.config.js`) — `no-restricted-syntax` rule scoped to
   `src/components/dashboard/Portfolio*.{ts,tsx}`. Any literal or template
   string containing `pl|pr|px|ml|mr|mx-[Npx|Nrem]` fails the lint step,
   so regressions are caught during development before commit.
2. **Shell guard** (`scripts/check-portfolio-panel-spacing.sh`) — greps
   every `Portfolio*.tsx` file (not just `PortfolioPanel.tsx`) under
   `src/components/dashboard` for the same pattern. Run with `--strict`
   in CI.
3. **Playwright bounding-box** (`e2e/portfolio-toggle-alignment.spec.ts`)
   — measures the toggle's right edge in Single vs Portfolio mode at
   1280 / 768 / 640 / 390 / 360 px and asserts drift ≤ 1px.
4. **Playwright screenshot** (`e2e/portfolio-panel-header-visual.spec.ts`)
   — pixel-diff snapshot of both header variants at desktop and mobile
   to catch subtle padding/typography drift that the bounding-box check
   misses.

## Reference files

- `src/components/dashboard/PortfolioPanel.tsx` (header block)
- `src/components/dashboard/ReservesTable.tsx` (`scenarioControls`)
- `src/components/dashboard/PortfolioModeToggle.tsx`
