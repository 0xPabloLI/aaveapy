# Repository Guidelines (Slim)

## Project Snapshot
- Frontend app: React + TypeScript + Vite for Aave market analysis UI.
- Main data sources: backend `GET /markets` and `GET /meta/side-data`.
- Core directories: `src/` (app code), `public/` (assets), `e2e/` (Playwright), `scripts/` (checks/sync), `docs/` (deep conventions).
- **技术架构**: `docs/ARCHITECTURE.md`（目录结构、数据流、shared schema、simulation、错误处理模式）。

## Core Commands
- `npm run dev` — local development
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
- For new domain naming, prefer *ceiling* semantics (`depositCeilingUsd`, `rewardCeilingUsd`) and existing helpers.
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
- Scripts / token icons / 共享 schema 改动前先看 `docs/conventions/scripts-and-schema-lessons.md`(icon 动态加载/manifest 不能找 orphan/扩展现有脚本/`src/shared/<domain>/` 相对路径/桥接 `scripts/lib/`/frontend vs script 错误语义分离)。

## Agent skills

### Issue tracker

Issues tracked in Linear (team: Aaveapy). See `docs/agents/issue-tracker.md`.

### Triage labels

Using default triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (one CONTEXT.md + docs/adr/ at root). See `docs/agents/domain.md`.

## Learned Lessons: Portfolio Delta Input

- **Controlled ↔ Uncontrolled 迁移风险**: `useNumberInput`（uncontrolled, initialValue）→ `useDebouncedInput`（controlled, value prop）迁移会引入双向同步反馈循环。迁移前必须分析双向数据流。
- **Delta 空语义 ≠ 空字符串**: Portfolio 中 clear delta 的正确语义是"使 delta=0"，即设 `amount = walletValue`，而非设 `amount = ''`。空字符串经 parseNumberInput→0 后与 walletValue 做差反而产生非零 delta。
- **Toggle sign 有 delta 时必须重算 amount**: `effectiveUsd = walletValue + deltaSign × delta` 中，toggle sign 翻转 deltaSign 后 effectiveUsd 变化，amount（=effectiveUsd）必须同步重算。当 absDeltaUsd ≥ 0.005 时 patch {deltaSign, amount}；delta 为零时只 patch deltaSign。旧设计"toggle sign 只翻符号不重算 amount"已被推翻——sign 变了 effectiveUsd 就变了，amount 不跟着重算会导致 UI 显示不一致。
- **Debounce 对 delta 输入有害**: 用户逐字输入 delta 时 300ms debounce 会在输入中途 commit 不完整值。对即时计算的派生字段传 `debounceMs: 0`。
- **if/else 两分支结果一致是死代码**: review 时注意简化，减少认知负担。
- **同一业务动作只允许一条语义路径**: 当同一操作有多种触发方式（按钮/键盘删除/粘贴/程序调用），底层语义必须统一到同一个函数。不要让多条路径各自实现——否则语义断裂会产生"A路径正确、B路径错误"的隐蔽 bug。典型反例：`handleClearDelta`（X 按钮）和 `handleDeltaCommit`（输入提交）曾经各自实现清空语义，键盘删除走 `handleDeltaCommit` 的 early return 丢掉了"归零"语义。修复：`handleDeltaCommit` 对空值委托给 `handleClearDelta`，两条路径归一。
- **输入提交函数必须显式定义空值语义**: 对任何数值输入框，明确回答"用户清空 = 什么？"。空值是有意义的输入，不是"没有输入"。不要用 early return 隐式丢弃——要么显式归零、要么显式回退、要么显式报错。TDD 必须覆盖"清空输入框"这条路径。

## Learned Lessons: Simulation `after` 语义（AAV-761）

- **`after=0` 与 `after=null` 语义不同，`??` 运算符下行为迥异**: `0 ?? fallback` → `0`（不 fallback），`null ?? fallback` → `fallback`。当 `hasInput=false` 时，after 必须为 `null`（表示"未参与模拟，使用 current 值"），不能为 `0`（表示"模拟后为 0%"）。这条规则适用于所有 `SimulationLane` 的 after/delta 字段及 per-campaign detail row。
- **多层计算链路需逐层统一语义**: campaign row 层（`buildMeritCampaignDetails`/`buildMerklCampaignDetails`）、`buildMetricsFromLane` 层、aggregate 层（`supplyAfterSources`/`borrowAfterSources`）需一致使用 `hasInput` 分支，否则会出现某层 `after=null` 而另一层 `after=0` 的矛盾。修改某一层时必须检查上下游所有层级。
- **Portfolio 模式传 delta 而非 total position，导致 hasInput 判断需特别小心**: `buildPerReserveInputsFromEntries` 传入 delta，当 borrow 有 delta 但 supply delta=0 时 `rawSupply=0, hasSupplyInput=false, hasBorrowInput=true`。`hasAnyInput` 为 true 不代表每个 side 都有 input——必须用 per-side `hasInput` 而非全局 `hasAnyInput` 来决定 per-side after 语义。
- **Per-campaign detail row 的 `else if (hasAnyInput)` 分支必须显式设 `after=null`**: Merit base/self、Merkl 三处原先设 `after=0`，导致 `pickScenarioValue` 不 fallback。修复：`after=0` → `after=null`，让 `??` 正确回退到 current。
