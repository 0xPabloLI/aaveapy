# Repository Guidelines (Slim)

## Project Snapshot
- Frontend app: React + TypeScript + Vite for Aave market analysis UI.
- Main data sources: backend `GET /markets` and `GET /meta/side-data`.
- Core directories: `src/` (app code), `public/` (assets), `e2e/` (Playwright), `scripts/` (checks/sync), `docs/` (deep conventions).
- **技术架构**: `docs/ARCHITECTURE.md`（目录结构、数据流、shared schema、simulation、错误处理模式）。

## Core Commands
- `npm run dev` — local development (auto-clears Vite dep cache to prevent React dual-instance crashes)
- `npm run lint` — ESLint
- `npm test` — Vitest
- `npm run build` — production build
- `npm run ci:remote` — full local gate (used by hooks)

## Session Workflow
1. **Bootstrap when needed**: For substantial implementation, debugging, or design sessions, load `using-superpowers` via skill tool. Load `brainstorming` only for feature design, behavior changes, or solution exploration — skip for lightweight inspection, explanation, and routine work.
2. **Git safety**: never run `stash`/`checkout` related commands without explicit user confirmation in current chat.
3. **Hook policy**: do not bypass `pre-commit`/`pre-push`; if `ci:remote` fails, fix root cause.

## Commit Cadence (并行 agent 安全)
**TL;DR**: 每完成一个原子任务立即 commit;同任务的后续修复 amend 原 commit;`stage` 时显式列路径(绝不 `git add -A` / `.`);不还原他人未提交改动;push 改写用 `--force-with-lease`。详见 `docs/conventions/commit-cadence.md`。

## 每次修改都用最佳实践
详见 `docs/conventions/design-principles.md`；架构守卫测试 `src/test/architecture-guard.test.ts` 自动拦截。

## Coding Conventions
- TypeScript + functional React components/hooks.
- 2-space indentation; `PascalCase` for components/types, `camelCase` for vars/functions.
- Keep backend API field names unchanged in transport layer (e.g. `perUserRewardCapUsd`).
- Treat `reserves[].reserveId` as required canonical identity in `/markets`; do not add new composite-key fallback paths.
- For new domain naming, prefer *cap* semantics (`eligibleDepositCapUsd`, `rewardCapUsd`) and existing helpers.
- Reuse existing UI patterns/tokens before introducing new ones.

## Validation Gate (修改后必跑 — 强制)
每次代码改动后按序跑 4 项,**全部通过**才算完成。任一失败 → 修根因 → 从头重跑。

```bash
npm run lint && npm test && npm run build && npx tsc --noEmit
```

高风险表格/模拟器改动另参 `docs/conventions/frontend-regression-checklist.md`;API 合约改动参 `docs/conventions/api-contract-checklist.md`。

**前端浏览器验证**：涉及 UI 交互/布局/样式的改动，CI gate 后需在浏览器中确认。优先用 `webapp-testing` skill（自动打开 dev server + Playwright 验证）；需手动探索交互时用 `playwright-interactive`；仅截图/快照用 `playwright`。

## PR / Merge Guardrails
- Commits: 简洁的 conventional 格式;不在 message 里放 URL。
- 不要 "cosmetically resolve" review thread,要么真修要么留待 maintainer 拍板。

## High-Risk Areas (Coordinate Carefully)
- Simulation + reserves table: `src/components/dashboard/ReservesTable*`, `DesktopReserveRow*`, `MobileReserve*`, `src/hooks/useRateSimulation.ts`, `src/hooks/reserves-table/` (8 个聚合 hook: useReservesTableSort / useReservesPagination / useReserveExpansion / useSharedScenarioInputs / useScenarioPinScroll / useReservesTooltip / usePortfolioToggle / useReservesLayoutRefs;每个都有 co-located 单测).
- Batch panel / portfolio: `src/components/dashboard/PortfolioPanel.tsx`, `src/components/dashboard/PortfolioTokenRow.tsx`.
  - **Supply-Borrow 不可分**: 添加/移除 token 必须同时操作 supply+borrow 两个 side（见 `docs/conventions/design-principles.md` §7）。`PortfolioReserveEntry` 从类型层面保证不可分；`addReserve` 总是创建 supply+borrow 两侧。
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
- Portfolio Simulation (✅ completed): `src/types/portfolio.ts`, `src/hooks/usePortfolioSimulation.ts`, `src/lib/portfolioCalculator.ts`, `src/lib/portfolioSimulator.ts`, `src/components/dashboard/Portfolio*.tsx`

## Docs Directory Convention
- **Plans**: 所有 plan 文档归档到 `docs/plans/completed/`（小写，扁平结构，不分子目录）。禁止创建 `Completed`、`linear-issues`、`phase-2`、`handoff` 等目录。由 `architecture-guard.test.ts` CI 拦截。
- **Archive**: 历史快照放 `docs/archive/`，已标注"no longer actively maintained"。
- **ADR**: 架构决策放 `docs/adr/`，编号递增。

## Learned Preferences (Condensed)
- Prefer Chinese for collaboration text and direct execution once confirmed.
- Prefer evidence-based debugging (logs/API/runtime artifacts) over speculation.
- If user requests "先给方案", provide plan first before coding.
- Keep implementation scoped; avoid unrelated refactors.
- Avoid filling missing backend fields with guessed defaults.

## Git Stash Safety
禁止未经确认执行 `stash pop/apply/drop/clear`；暂存用 `stash push -m "msg"`，恢复前先 `stash list` 供审查。

## Session Boundary
不修非本 session 引入的问题；`git diff` 确认来源，已有问题告知用户决定。

## Mobile Layout
紧凑原则：复用留白不加独占行；去冗余标签优先图标+Tooltip；一行多信息纵向省空间；次要信息用最小档字体/间距；absolute 定位元素不含可变长度文字。

## Canary & Hooks
- `src/types/field-canary.test.ts` 穷举字段名，重命名时 tsc + test 双防线拦截。
- Pre-push: stash > 3 警告清理。

## Learned Lessons

- Scripts/icons/共享 schema → `docs/conventions/scripts-and-schema-lessons.md`
- CJK 全角小数点归一化 / handleFocus cursor / 千分位格式化 → `docs/rate-calculation.md` §Part 6
- 同一业务动作只允许一条语义路径 → `docs/conventions/design-principles.md` §8

## Agent skills

### Issue tracker

Issues tracked in Linear (team: Aaveapy). See `docs/agents/issue-tracker.md`.

### Triage labels

Using default triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (one CONTEXT.md + docs/adr/ at root). See `docs/agents/domain.md`.

## Learned Lessons: Portfolio Delta Input

- **Controlled ↔ Uncontrolled 迁移风险**: `useNumberInput`→`useDebouncedInput` 迁移前必须分析双向数据流
- **Delta 空语义 ≠ 空字符串**: clear delta = 设 `amount=walletValue`，不是 `amount=''`
- **Toggle sign 有 delta 时必须重算 amount**: sign 翻转→effectiveUsd 变化→amount 必须同步
- **Debounce 对 delta 输入有害**: 即时计算派生字段传 `debounceMs: 0`
- **输入提交函数必须显式定义空值语义**: 空值是有意义的输入，TDD 必须覆盖"清空输入框"路径

## Learned Lessons: AAV-761 — Simulation after 语义与 double-count 防御

→ 详见 `docs/rate-calculation.md` §Part 7 "Simulation Null Semantics"

速记：
- `after=0` 与 `after=null` 语义不同（`??` 下行为迥异），`hasInput=false` 时 after 必须为 `null`
- aggregate 层用 `hasAnyInput` 保留跨侧影响，消费端用 per-side `hasInput` 做显示控制
- `totalSupplyUsd = wallet + delta`，`totalPositionUsd = totalSupplyUsd`（不做加法，否则 double-count）
- Fallback 上移到调用层，calculator 不做 `??` 回退
- Brevis `perUserRewardCapUsd` 限制累计奖励而非 position，不需要 `totalPositionUsd`
- `reservePositions` → `crossReservePositions`（跨 reserve eligibility，不暗示存的是什么）

## Learned Lessons: 外部 API 集成测试

→ 详见 `docs/conventions/external-api-testing-lessons.md`

速记：Don't Mock What You Don't Own；外部 API 必须有契约测试；API URL 基于官方文档不猜测

## Learned Lessons: Wallet-only incentive delta (AAV-771)

- **`buildIncentiveCurrent` 区分稀释计算和 headline 展示**: `walletSupplyUsd`/`walletBorrowUsd` 与 `depositUsd` 语义分离
- **`portfolioSimulator` 不能跳过 wallet-only positions**: 先判 `hasWalletPosition` 和 `hasUserInput`，都不满足才跳过
- **`formatDeltaPercent` 阈值过滤不能替代空语义**: `null` = "无 delta 概念"，`0` = "有 delta 但值为零"
