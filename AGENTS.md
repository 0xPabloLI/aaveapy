# Repository Guidelines (Slim)

## Quick Reference

- **Test wallet (view-only)**: `0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314` — holds Aave V3 positions on mainnet. Source: `e2e/test-wallets.ts`. Use in Playwright via the "Watch address" input.
- **Brand name**: `AaveAPY` (one word, camelCase). Consistent across UI, meta tags, structured data, and locales.

## Design Context

### Users
进阶 DeFi 用户——有一定链上经验，了解 APY/APR/Spread/Supply/Borrow 等基本概念，但需要工具辅助跨链比较和投资决策。使用场景：日常监控 Aave V3 多链市场、比较借贷利率、追踪 Merit/Merkl/Brevis 激励收益、模拟利率变化和仓位效果。

### Brand Personality
温暖亲和、精准可靠、数据驱动。三个关键词：**Warm / Precise / Trustworthy**。界面应该像一位专业的金融顾问——用数据说话，但用温暖的方式呈现，让用户感到被照顾而非被淹没。品牌焦点色为品红→青色的渐变（`--ds-brand-magenta-rgb` → `--ds-brand-cyan-rgb`），传达"理性中有温度"的气质。

### Aesthetic Direction
- **视觉基调**：温暖雾白底 + 深炭黑暗色模式，琥珀金主色（Primary），品红→青渐变作为品牌签名
- **色彩语义严格**：琥珀=警告、红=错误、翡翠绿=Supply/成功、青色=Borrow、紫色=Spread、蓝色=Portfolio
- **信息密度优先**：4 层响应式压缩确保数据始终可读，硬切换行而非省略号
- **暖色光晕**：Tooltip 表面带暖色径向光 + 网格线，体现"温度"而非冷冰冰的数据面板
- **参考与反参考**：当前设计方向已对齐，无额外参考或反参考

### Design Principles
1. **Warm Precision** — 数据精准呈现，但用温暖的方式。颜色、间距、排版都要传达"专业但不冷漠"
2. **Semantic Color Discipline** — 语义色仅用于其对应含义，普通数据用中性色。禁止 `text-gray-`/`bg-gray-`/`border-gray-` 等非语义灰
3. **Dense but Breathable** — 高信息密度的同时保证可读性。4 层响应式压缩（列宽→padding→内容→断点切换），最小文字-边框间距 8px
4. **Progressive Disclosure** — 核心数据一眼可见，细节按需展开（Reserve row → Simulation sub-row → Incentive tooltip）
5. **Mobile as First-Class Citizen** — 移动端禁止 `hover:`，改用 `active:`；浮层用 bottom sheet；触控目标 ≥44px

### Design Token Quick Reference
- **字体**：Source Sans Pro (sans) / Source Serif Pro (serif) / Source Code Pro (mono)
- **字号**：8px–36px（`--ds-text-8` ~ `--ds-text-36`），标题 `clamp(20px, 2vw+10px, 24px)`
- **间距**：4px 基准（`--ds-space-1` = 4px），最大 64px
- **圆角**：基于 `--radius` (1rem) 派生 lg/md/sm
- **阴影**：7 级（2xs→2xl），暗色比亮色更深
- **详细规范**：`docs/design/DESIGN-SYSTEM-REFERENCE.md`（840 行主文档）

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
4. **No code changes without explicit go-ahead**: 在用户确认开始或给出明确实施指令前，不修改任何代码文件。讨论、调研、Grill 阶段只做分析和方案设计。
5. **Mandatory implementation workflow**: 每次改代码之前必须走完以下工作流，不得跳步：
   1. **Grill with Docs** — 用 `grill-with-docs` skill 审视方案，确认设计决策有文档支撑
   2. **To Spec** — 用 `to-spec` skill 将对话结论合成为 spec 文档
   3. **To Tickets** — 用 `to-tickets` skill 将 spec 拆分为带依赖边的 tracer-bullet tickets
   4. **TDD Implement** — 逐 ticket 用 `tdd` skill 实施（red → green → refactor）；关键逻辑必须先写测试
   5. **Code Review** — 实施完成后用 `code-review` skill 做双轴审查（Standards + Spec）
   6. **Dev Server + Playwright 验证** — 涉及 UI 交互/布局/样式的改动，CI gate 后必须用 `webapp-testing` skill 在浏览器中验证
   7. **Commit** — 通过验证后 commit（遵循 Commit Cadence 规则）
   8. **更新相关文档及 Issue** — 同步更新 docs、ADR、Linear issue 状态

## Commit Cadence (并行 agent 安全)
**TL;DR**: 每完成一个原子任务立即 commit;同任务的后续修复 amend 原 commit;`stage` 时显式列路径(绝不 `git add -A` / `.`);不还原他人未提交改动;push 改写用 `--force-with-lease`。详见 `docs/conventions/commit-cadence.md`。

## 每次修改都用最佳实践
详见 `docs/conventions/design-principles.md`；架构守卫测试 `src/test/architecture-guard.test.ts` 自动拦截。

## Coding Conventions
- TypeScript + functional React components/hooks.
- 2-space indentation; `PascalCase` for components/types, `camelCase` for vars/functions.
- Keep backend API field names unchanged in transport layer (e.g. `positionCap`).
- Treat `reserves[].reserveId` as required canonical identity in `/markets`; do not add new composite-key fallback paths.
- For new domain naming, prefer *cap* semantics (`selfPositionCapUsd`, `positionCapUsd`) and existing helpers.
- Reuse existing UI patterns/tokens before introducing new ones.
- **E2E 测试禁止按 platform 互斥 skip**：`test.skip(mobile, 'Desktop-only')` 是反模式。桌面端专用测试必须在 desktop 项目中执行，移动端专用测试必须在 mobile 项目中执行。用 `test.describe` 按 project 过滤代替 `test.skip(condition)`；缺少对应 platform 的测试用例时应补充，而非 skip。

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

## Cross-Branch Workflow（禁止本地切分支）
**核心规则**：永远不要在当前工作目录执行 `git checkout`/`git switch` 切换分支。所有跨分支操作通过 worktree 或 GitHub API 完成。

### 场景 1：需要向 main 提交改动（main 有分支保护，必须走 PR）
```bash
# 1. 创建 worktree（不会切换当前分支）
git worktree add /tmp/aaveapy-main main
# 2. 在 worktree 中操作
cd /tmp/aaveapy-main
git checkout -b fix/xxx
# 编辑文件、commit
git push -u origin fix/xxx
gh pr create --title "fix: xxx" --body "..." --base main --head fix/xxx
gh pr merge <PR_NUMBER> --squash --auto   # CI 通过后自动合并
# 3. 清理 worktree
cd <original-repo>
git worktree remove /tmp/aaveapy-main
```

### 场景 2：需要从其他分支 cherry-pick 到当前分支
```bash
git cherry-pick <commit-sha>   # 不需要切分支，直接在当前分支操作
```

### 场景 3：需要查看其他分支的文件
```bash
git show main:path/to/file     # 不切分支，直接读取
git diff main..lovable -- path/to/file
```

### 场景 4：需要将 lovable 的改动合入 main
通过 PR：从 lovable 向 main 开 PR，不要本地 merge。

### 场景 5：lovable → dev 同步（避免 DIRTY PR）

lovable 和 dev 需要保持同步。dev 有分支保护（lint + build required checks），应通过 PR 合并。

**标准流程**：
1. 从 lovable 向 dev 开 PR（merge commit 方式，不要 squash）
2. 启用 auto-merge：`gh pr merge <PR_NUMBER> --merge --auto`
3. CI 通过后自动合并

**如果 PR 报 DIRTY（有合并冲突）**：
1. 在 lovable 分支上合并 dev 解决冲突：`git merge origin/dev`
2. 解决冲突后 commit + push lovable
3. PR 自动变为 CLEAN，auto-merge 正常执行

**禁止的操作**：
- ❌ 不要用 worktree 直接 merge + push 绕过 PR（违反 dev 分支保护规则）
- ❌ 不要用 squash merge 同步 lovable→dev（会丢失历史连通性，导致下次同步更容易 DIRTY）
- ❌ 不要攒大量 commit 才同步（减少冲突概率）

**为什么用 merge commit 而不是 squash**：dev 和 lovable 的 commit 历史不同源（dev 有早期 Lovable 平台自动 commit），squash 会进一步割裂历史，使后续 PR 更容易 DIRTY。merge commit 保持双向可追踪。

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

## Golden Rules: Rate Simulation Calculator

以下规则是 `rateSimulationCalculator.ts` 的不变量（invariants），违反任何一条都是 bug。修改 calculator 前必须先读这些规则。

### 1. Current 不变量：`current*` 字段永不随 simulation input 变化
- `currentIncentive`、`currentTotal`、`currentNative` 代表**钱包当下状态**，不是模拟状态。
- 改变 `supplyInput`/`borrowInput` **绝不能**改变 `current*` 值。
- 无钱包（Shared Scenario）时，`current = headline`（未稀释 API 值，无 eligibility scaling）。
- 有钱包（Portfolio）时，`current` 使用钱包-only 值（`walletSupplyUsd`/`walletBorrowUsd`）。
- **实现**：`walletEligibilityRatio` 和 `walletMerklGroupMul` 在无钱包时必须返回 identity（1.0），**不得 fallback 到 simulation inputs**。

### 2. Aggregate = Σ per-source：单一计算路径
- `currentIncentive = protocolCurrent + sr.merit.current + sr.merkl.current + sr.brevis.current`
- `afterIncentive = protocolCurrent + sr.merit.after + sr.merkl.after + sr.brevis.after`
- **禁止**独立的 aggregate 计算路径（如已删除的 `buildIncentiveCurrent`/`buildIncentiveAfter`）。
- Per-source `Math.min(afterRaw, current)` 在 dispatch map 循环内应用，aggregate 层不再加 `Math.min`。
- `Math.min(a+b, c+d) ≠ Math.min(a,c) + Math.min(b,d)` — 两层 cap 产生不同结果。

### 3. Wallet fallback = identity，不是 simulation
- `walletSupplyUsd`/`walletBorrowUsd` 为 undefined 时，wallet 变量必须 fallback 到 **identity**（ratio=1, multiplier=1），**不是** simulation inputs。
- 原因：无钱包 = 无仓位 = 无稀释 = 无 eligibility scaling。Simulation inputs 是假设值，不是当下值。
- **违反此规则会导致 Shared Scenario 下 `current` 随输入剧烈变化（50% drop bug AAV-1121）。**

### 4. `headlineIncentive` 是纯市场 advertised rate（AAV-1165 修订）
- `headlineIncentive` = 纯 API advertised campaign/protocol rate。**不含** forecast、wallet position、position cap、cross-reserve offset。
- 作为市场参考值，不是用户实际可得 rate，也不是场景基线。
- `currentIncentive` = forecast + wallet cap/offset（钱包当前 effective rate）。
- `afterIncentive` = forecast + 目标 Portfolio cap/offset（场景后 effective rate）。
- `deltaIncentive` = `after - current` **only**。无 after 时为 `null`，不再计算 `current - headline`。
- Eligibility gap info（cap、offset、eligible amount）是独立结构化数据，不重载到 delta。
- Headline **不**经过 dispatch map，使用 `calculateTotalIncentiveApy/Apr`（无 `forecastStates`、无 `merklGroupMultiplier`、无 `positionUsd` 参数）。

## Learned Lessons (Index)
详细 lessons 已外迁到以下文件，按需查阅：
- `docs/lessons/rate-simulation.md` — Rate Simulation Calculator/incentive 计算相关（AAV-739/745/761/771/978/980/1059/1060/1075/1086/1097 等）
- `docs/lessons/portfolio-ui.md` — Portfolio 模式/表格布局/UI 组件相关（Delta Input/Option E/Unified Table/列宽/边框等）
- `docs/lessons/infrastructure.md` — CI/CD/外部 API 集成相关（chainDiscovery 404/AAV-1034 等）
- `docs/conventions/scripts-and-schema-lessons.md` — Scripts/token icons/共享 schema 相关

## Agent skills

### Issue tracker

Issues tracked in Linear (team: Aaveapy). See `docs/agents/issue-tracker.md`.

### Triage labels

Using default triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (one CONTEXT.md + docs/adr/ at root). See `docs/agents/domain.md`.

### Matt Pocock Skills v1.1 workflow

Main flow: `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement` (per ticket).

- `/grill-with-docs` — sharpen idea via interview + ADR/glossary (has codebase). No codebase? Use `/grill-me`.
- `/grilling` — the underlying interview primitive; `grill-me` and `grill-with-docs` both delegate to it.
- `/to-spec` — synthesize conversation into spec (was `/to-prd`).
- `/to-tickets` — split spec into tracer-bullet tickets with blocking edges (replaces `/to-issues`).
- `/implement` — build per ticket; internally drives `/tdd` + `/code-review`.
- `/wayfinder` — on-ramp for huge/foggy efforts; charts investigation map, merges onto main flow at `/to-spec`.
- `/research` — delegate reading to a background agent; keeps you working while it reads.
- `/ask-matt` — router: describe your situation, get the right skill path.

