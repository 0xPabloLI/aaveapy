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

## Commit Cadence (并行 agent 安全)
**TL;DR**: 每完成一个原子任务立即 commit;同任务的后续修复 amend 原 commit;`stage` 时显式列路径(绝不 `git add -A` / `.`);不还原他人未提交改动;push 改写用 `--force-with-lease`。详见 `docs/conventions/commit-cadence.md`。

## 每次修改都用最佳实践
修改前先验证：调用方组合能否替代？是否引入补丁 prop？职责是否单一？重复样式是否提取？详见 `docs/conventions/design-principles.md`；架构守卫测试 `src/test/architecture-guard.test.ts` 自动拦截。

## Coding Conventions
- TypeScript + functional React components/hooks.
- 2-space indentation; `PascalCase` for components/types, `camelCase` for vars/functions.
- Keep backend API field names unchanged in transport layer (e.g. `perUserRewardCapUsd`).
- Treat `reserves[].reserveId` as required canonical identity in `/markets`; do not add new composite-key fallback paths.
- For new domain naming, prefer *ceiling* semantics (`depositCeilingUsd`, `rewardCeilingUsd`) and existing helpers.
- Reuse existing UI patterns/tokens before introducing new ones.

## Validation Gate (修改后必跑 — 强制)
每次代码改动后按序跑 4 项,**全部通过**才算完成。任一失败 → 修根因 → 从头重跑。

```bash
npm run lint && npm test && npm run build && npx tsc --noEmit
```

高风险表格/模拟器改动另参 `docs/conventions/frontend-regression-checklist.md`;API 合约改动参 `docs/conventions/api-contract-checklist.md`。

## PR / Merge Guardrails
- Commits: 简洁的 conventional 格式;不在 message 里放 URL。
- 不要 "cosmetically resolve" review thread,要么真修要么留待 maintainer 拍板。

## High-Risk Areas (Coordinate Carefully)
- Simulation + reserves table: `src/components/dashboard/ReservesTable*`, `DesktopReserveRow*`, `MobileReserve*`, `src/hooks/useRateSimulation.ts`, `src/hooks/reserves-table/` (8 个聚合 hook: useReservesTableSort / useReservesPagination / useReserveExpansion / useSharedScenarioInputs / useScenarioPinScroll / useReservesTooltip / usePortfolioToggle / useReservesLayoutRefs;每个都有 co-located 单测).
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

## Learned Lessons
- Scripts / token icons / 共享 schema 改动前先看 `docs/conventions/scripts-and-schema-lessons.md`(icon 动态加载/manifest 不能找 orphan/扩展现有脚本/`src/shared/<domain>/` 相对路径/桥接 `scripts/lib/`/frontend vs script 错误语义分离)。
