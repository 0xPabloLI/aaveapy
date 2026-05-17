# Repository Guidelines (Slim)

## Project Snapshot
- Frontend app: React + TypeScript + Vite for Aave market analysis UI.
- Main data sources: backend `GET /markets` and `GET /meta/side-data`.
- Core directories: `src/` (app code), `public/` (assets), `e2e/` (Playwright), `scripts/` (checks/sync), `docs/` (deep conventions).

## Core Commands
- `npm run dev` — local development
- `npm run lint` — ESLint
- `npm test` — Vitest
- `npm run build` — production build
- `npm run ci:remote` — full local gate (used by hooks)

## Mandatory Session Workflow
1. **Bootstrap first** (every new session — BEFORE any other action):
   - **Codex**: `~/.codex/superpowers/.codex/superpowers-codex bootstrap && ~/.codex/superpowers/.codex/superpowers-codex use-skill brainstorming`
   - **CodeArts**: Use the `skill` tool to load `using-superpowers`, then load `brainstorming`. This is mandatory — do not skip even for simple questions.
2. **Git safety**: never run `stash`/`checkout` related commands without explicit user confirmation in current chat.
3. **Hook policy**: do not bypass `pre-commit`/`pre-push`; if `ci:remote` fails, fix root cause.

## Coding Conventions
- TypeScript + functional React components/hooks.
- 2-space indentation; `PascalCase` for components/types, `camelCase` for vars/functions.
- Keep backend API field names unchanged in transport layer (e.g. `perUserRewardCapUsd`).
- Treat `reserves[].reserveId` as required canonical identity in `/markets`; do not add new composite-key fallback paths.
- For new domain naming, prefer *ceiling* semantics (`depositCeilingUsd`, `rewardCeilingUsd`) and existing helpers.
- Reuse existing UI patterns/tokens before introducing new ones.

## Validation Gate (修改后必跑验证 — 所有代码修改强制执行)

**After EVERY code change, run ALL of these in order. The change is NOT complete until all pass:**

```bash
npm run lint        # ESLint
npm test            # Vitest
npm run build       # Vite production build
npx tsc --noEmit    # TypeScript type-checking
```

**If ANY check fails:**
- Fix the root cause in the code
- Re-run the full sequence from the beginning
- Repeat until ALL checks pass
- Do NOT hand back to the user with failing validation

For high-risk reserves/simulation/table UI changes, follow `docs/conventions/frontend-regression-checklist.md` (including targeted e2e/manual checks).
For API contract changes, follow `docs/conventions/api-contract-checklist.md`.

## PR / Merge Guardrails
- Keep commits concise and conventional; no URL in commit message.
- Do not “cosmetically resolve” review threads without actual fix or maintainer-approved rationale.
- For branch sync/force update scenarios, prefer `git push --force-with-lease` (not `--force`).

## High-Risk Areas (Coordinate Carefully)
- Simulation + reserves table: `src/components/dashboard/ReservesTable*`, `DesktopReserveRow*`, `MobileReserve*`, `src/hooks/useRateSimulation.ts`.
- Batch panel / portfolio: `src/components/dashboard/PortfolioPanel.tsx`, `src/components/dashboard/PortfolioTokenRow.tsx`.
- Forecast/incentives: `src/lib/meritForecast.ts`, `src/lib/merklForecast.ts`, `src/lib/brevisForecast.ts`.
- Sorting/formatting contracts: `src/lib/sorters.ts`, `src/lib/formatters.ts`, `src/lib/apiSchemas*.ts`.

## Key References
- `docs/design/frontend-interaction-guardrails.md`
- `docs/design/DESIGN-SYSTEM-REFERENCE.md`
- `docs/rate-calculation.md`
- `docs/PR_ANALYSIS.md`
- `docs/conventions/merge-summary.md`
- `docs/conventions/frontend-regression-checklist.md`
- `docs/conventions/api-contract-checklist.md`
- Portfolio Simulation (✅ completed): `src/types/portfolio.ts`, `src/hooks/usePortfolioSimulation.ts`, `src/lib/portfolioCalculator.ts`, `src/components/dashboard/Portfolio*.tsx`

## Learned Preferences (Condensed)
- Prefer Chinese for collaboration text and direct execution once confirmed.
- Prefer evidence-based debugging (logs/API/runtime artifacts) over speculation.
- If user requests "先给方案", provide plan first before coding.
- Keep implementation scoped; avoid unrelated refactors.
- Avoid filling missing backend fields with guessed defaults.

## Learned Lessons (Condensed)
- **Token icon 引用是动态的** — icon 通过 URL 路径 `/icons/tokens/{symbol}.{ext}` 在运行时加载，非静态 import；静态源码扫描无法判断哪些 icon 在使用。判断"过时"须依赖 API 运行时数据（活跃 token symbol）。
- **tokenIconManifest 不可用于差集检测** — 它从目录自动生成，目录中不可能有不在 manifest 的文件。
- **扩展现有基础设施优于新建** — 遇到 sync/check/clean 类需求时，优先在 `scripts/sync-*.mjs` 或 `scripts/check-*.mjs` 中扩展，而非新建脚本或 workflow。
- **Token icon 受保护列表** — `default` 等兜底 icon 不可被标记为可清理。
