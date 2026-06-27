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
- Keep backend API field names unchanged in transport layer (e.g. `positionCap`).
- Treat `reserves[].reserveId` as required canonical identity in `/markets`; do not add new composite-key fallback paths.
- For new domain naming, prefer *cap* semantics (`selfPositionCapUsd`, `positionCapUsd`) and existing helpers.
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
- **CJK 全角小数点归一化 (AAV-739)**：中文/日文输入法在非数字上下文按 `.` 出 `。`(U+3002)/`．`(U+FF0E)/`｡`(U+FF61) 而非 ASCII `.`(U+002E)。`sanitizeNumberInput` 必须先归一化全角小数点，否则被 `[^\d.]` 正则当非法字符删掉。归一化放在 sanitizer 最前面，先于逗号去除和数字过滤。
- **handleFocus cursor 修复走 pendingCursorRef (AAV-739)**：`handleFocus` 中 `setDisplayValue` 触发 React re-render 会覆盖同步 `setSelectionRange`。必须用 `pendingCursorRef` + `useLayoutEffect`（与 `handleChange` 一致），在 re-render 后恢复 cursor。
- **实时千分位格式化 (AAV-745)**：`useDebouncedInput` 的 `handleChange` 必须 sanitize→formatNumberInput→setDisplayValue，输入过程中实时显示千分位。`computeCursorAfterFormat` 基于 cursor 前有效数字字符数推算格式化后位置。handleFocus 不剥离逗号（只设 cursor 到末尾），handleBlur 保留 formatNumberInput（幂等防御）。CJK 全角小数点归一化（AAV-739）必须在 format 之前完成。

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

## Learned Lessons: AAV-761 回归修复 — per-side 守卫 vs 跨側影响

- **`hasSupplyInput`/`hasBorrowInput` 守卫切断跨侧影响（中间尝试，已回退）**: aggregate 层（`supplyAfterSources`/`borrowAfterSources`、4 个 `afterIncentiveRaw`/`afterIncentiveAprRaw`）曾从 `hasAnyInput` 改为 per-side 守卫，导致 Shared Scenario 下无输入侧的 after 变为 null，UI 显示错误。修复：6 处守卫改回 `hasAnyInput`。
- **`SimulationLane.hasInput` 保持 per-side 不改**: Portfolio 消费端（`buildMetricsFromLane`）用 `lane.hasInput` 做二次守卫实现 em dash，per-side 语义正确。aggregate 层用 `hasAnyInput` 保留跨侧影响，消费端用 `hasInput` 做显示控制——两层守卫各司其职。
- **cross-side 测试断言不是 `after === current`**: 跨側影响保留后，无输入侧的 after 值可以因对侧输入而变化（如 Brevis 共享 cap），正确断言是 `after !== null`（有值可显示），而非 `after === current`（值不变）。
- **`SimulationLane` 没有 `after`/`delta` 字段**: 只有 `afterTotal`/`deltaTotal`、`afterNative`/`deltaNative`、`afterIncentive`/`deltaIncentive`。测试中不要用 `lane.after`/`lane.delta`。

## Learned Lessons: 单一变量承载多语义导致 double-count (AAV-761 merit-deposit-ceiling-dilution)

- **变量命名直接决定代码能否自文档化**: 旧名 `principalSupplyUsd` 暗示"已有本金（不含 delta）"，实际值 = wallet + delta（含 delta 的总仓位）。这导致 `totalPositionUsd = principal + netInput` 公式在设计时引入了 double-count。改名 `totalSupplyUsd` 后（见下方 § 重命名），语义自明：`totalPositionUsd = totalSupplyUsd`（无需加任何东西）。**教训：变量名必须精确反映值的构成（wallet + delta），不能只取其中一部分（principal）暗示另一种语义。**
- **数据源语义必须显式文档化**: `reservePositions` 在 single simulation 下存的是 shared simulation input（`parseNumberInput(debouncedSharedSupplyInput)`），不是钱包仓位。代码中用 `reservePositions` 这个名字暗示"仓位"，构建处的注释只说"用于 cross-reserve eligibility"——没有说明在 single simulation 下这些值就是 simulation input 本身。**教训：数据容器名称应与数据源语义一致；如果同一容器在不同模式下承载不同语义，必须在类型或注释中显式标注。**
- **`X + Y` 计算必须覆盖 `X === Y` 的边界用例**: 当两个加项可能来自同一数据源时（如 single simulation 中二者都来自 shared input），`A + A = 2A` 就是 double-count。**教训：做 `X + Y` 计算时，TDD 必须覆盖"X 和 Y 相等时结果是否符合预期"的边界用例。** 恰好漏掉这类测试会导致回归测试通过但逻辑错误。
- **Calculator 层无法保护调用层传错误值**: `buildRateSimulationResult` 的参数合约需要调用侧保证 `totalSupplyUsd ≥ supplyNetInputUsd`，但调用侧可能 `totalSupplyUsd = supplyNetInputUsd = simulationInput`（single simulation）。**教训：关键合约约束应在 calculator 层加断言，而非依赖注释和调用侧的"自觉"遵守。**

## Learned Lessons: 重命名 `principalSupplyUsd` → `totalSupplyUsd` (AAV-761 refactor)

- **`totalSupplyUsd` = 总仓位 (wallet + delta)**：用于 USD accrual 收益计算和 Merit position cap 稀释公式。名字"total"即自说明：它就是总数，不要再加。
- **`supplyNetInputUsd` = 净 delta (max(supplyInput - borrowInput, 0))**：推动利率曲线的量，不包含已有仓位。新旧都叫delta，不变。
- **公式 `totalPositionUsd = totalSupplyUsd`**（直接取用，不做加法）：因为 total 本身已含 delta，加 netInput 即 double-count。
- **入口统一**：Single simulation 和 Portfolio simulation 通过同一个 `perReserveInputs` Map 分发，只在 single 模式下为 undefined（不含 total），portfolio 模式下有值。两者统一调 `useSharedRateSimulations`，只有数据不同，没有代码路径分支。

## Learned Lessons: Fallback 上移到调用层 + 命名统一 (AAV-761 refactor v3)

- **隐式 fallback 分散在 calculator 层导致语义不可见**：旧方案 `buildRateSimulationResult` 内部 `effectiveTotalSupplyUsd = totalSupplyUsd ?? (hasSupplyInput ? supplyInputUsd : undefined)` 让单模拟模式下 `totalSupplyUsd` 的语义（"输入即总仓位"）隐藏在 calculator 内部，不读源码无法知道。
- **上移方案**：fallback 逻辑移到 `useSharedRateSimulations`（唯一调用入口），`buildRateSimulationResult` 直接使用传入的 `totalSupplyUsd`/`totalBorrowUsd`，不做任何 `??` 回退。calculator 的合约变简单：调用方负责提供正确的 total position，不提供 = 无 total。
- **`reservePositions` → `crossReservePositions`（8 个文件）**：旧名 `reservePositions` 暗示"仓位"，但在 single simulation 下存的是 simulation inputs。新名 `crossReservePositions` 准确描述用途（跨 reserve 的 net eligibility 计算），不暗示具体存的是什么。
- **contract 从隐式变显式**：`buildRateSimulationResult` 的 JSDoc 明确列出三种调用方合约——Portfolio 传 wallet+delta、Single 传 inputUsd、无输入传 undefined。未来新增调用方不会因"不知道 calculator 内部有 fallback"而传错值。

## Learned Lessons: 外部 API 集成测试必须验证真实端点（chainDiscovery 404 根因）

- **Mock 测试无法发现"API URL 不存在"的问题**：`chainDiscovery.test.ts` mock 了 `fetch` 返回 `ok: true` + JSON，但真实的 `chainid.network/chains/{id}.json` 和 `chainlist.org/rpcs/{id}.json` 端点根本不存在（官方只有 bulk 端点 `chains.json` 和 `rpcs.json`）。所有链的单链 fetch 全部 404，mock 测试从未暴露这个问题。
- **外部 API 集成必须同时维护契约测试**：单元测试 mock fetch 是必要的（速度、隔离），但对第三方 API 的集成必须额外有契约测试（contract test）——在 CI 或手动触发时用真实 fetch 验证：(1) URL 是否可达；(2) 响应格式是否符合预期 schema；(3) CORS 是否允许浏览器端调用。契约测试不需要每次跑，但必须存在且可运行。
- **测试原则：Don't Mock What You Don't Own**：只 mock 自己控制的代码（内部函数、状态），不要 mock 第三方 API 的行为——因为你对它的假设可能是错的。对第三方 API，用 schema 验证（zod/Joi）替代 mock：真实响应必须满足 schema，mock 也必须满足同一 schema。
- **API URL 必须基于官方文档而非猜测**：`/chains/{id}.json` 这种路径模式看似合理但从未被官方文档确认。添加外部 API 集成时，必须先查官方文档确认端点存在，再写代码。
- **防御性编码：fetch 失败时区分"链不存在"和"API 不可达"**：404 可能意味着"链未收录"或"API 端点不存在"——两者语义不同但表现相同。当所有链都 404 时，应该怀疑是 API 本身的问题而非逐链问题。

## Learned Lessons: Wallet-only incentive delta 不显示 (AAV-771)

- **`buildIncentiveCurrent` 需区分"稀释计算"和"headline 展示"两种用途**：旧版只有一个 `depositUsd` 参数，`hasInput=false` 时传 0 导致 position cap 稀释被跳过。修复：新增 `walletSupplyUsd`/`walletBorrowUsd` 参数，与 `depositUsd`（input 用）语义分离。wallet-only 场景下 wallet 有值、depositUsd=0，仍然正确计算稀释。
- **`totalSupplyUsd = wallet + delta` 公式可直接推导 wallet**：portfolio 模式下 `wallet = totalSupplyUsd - supplyInputUsd`，single simulation 下 `totalSupplyUsd` 未定义所以 wallet 为 undefined。这个推导避免了调用方额外传 wallet 参数。
- **`portfolioSimulator.ts` 跳过 wallet-only positions 导致 totalSupplyUsd 丢失**：`buildGroupMapFromSlots` 和 `buildPerReserveInputsFromEntries` 原来用 `if (amountUsd <= 0) continue` 跳过 delta=0 的 side，导致 wallet value 没被累加。修复：先判断 `hasWalletPosition` 和 `hasUserInput`，两者都不满足才跳过。
- **`formatDeltaPercent` 阈值过滤可能掩盖逻辑 bug**：delta=0 被过滤掉后 UI 不显示，用户看不到 delta 但也不知道是"无稀释"还是"计算错误"。threshold 过滤不能替代正确的空语义——null 表示"无 delta 概念"，0 表示"有 delta 但值为零"。

## Learned Lessons: AAV-761 方向回撤 — walletSupplyUsd 推导不应被 hasInput 守卫阻断

- **Deposit Ceiling 稀释是钱包仓位本身的属性，不是用户输入的属性**：即使用户没有输入任何 delta，只要钱包仓位超过了 Deposit Ceiling，current incentive 就应该显示稀释后的值。`walletSupplyUsd` 推导必须始终执行（`totalSupplyUsd != null` 即可），不能加 `hasSupplyInput` 守卫。
- **AAV-761 修复曾错误地引入 `hasSupplyInput` 守卫**：`walletSupplyUsd = explicitWalletSupplyUsd ?? (hasSupplyInput && totalSupplyUsd != null ? totalSupplyUsd - supplyInputUsd : undefined)` 导致 `hasInput=false` 时 `walletSupplyUsd=undefined`，`buildIncentiveCurrent` 走 headline 分支不稀释，用户看到的是"所有仓位都能拿 incentive"的错误值。修复：去掉 `hasSupplyInput` 守卫，改为 `totalSupplyUsd != null ? totalSupplyUsd - supplyInputUsd : undefined`。
- **`deltaIncentive` 分两路计算，必须匹配 `deltaNative`/`deltaTotal` 模式**：旧公式 `walletSupplyUsd != null ? currentIncentive - headlineIncentive : null` 永远只算 wallet dilution gap，不管 `hasInput`。修复后分两路——`hasInput=true` → `afterIncentive - currentIncentive`（simulation 效果）；`hasInput=false` + wallet → `currentIncentive - headlineIncentive`（wallet 稀释缺口）；`hasInput=false` + 无 wallet → `null`。三态统一：`hasInput` 决定 simulation delta，wallet 决定 dilution gap，两者互斥。

## Learned Lessons: deltaIncentive 公式修复 — 三态分路

- **`deltaIncentive` 永远只用 `current - headline` 是 bug**：旧公式使纯 manual（无 wallet）时 delta 为 null（不显示），wallet + manual 时 delta 永远等于 dilution gap 不随输入变化。原因：`deltaIncentive` 从不使用 `afterIncentive`。
- **修复后三态分路**：`hasInput=true` → `afterIncentive - currentIncentive`（simulation 效果）；`hasInput=false` + wallet → `currentIncentive - headlineIncentive`（dilution gap）；`hasInput=false` + 无 wallet → `null`（无数据可显示）。
- **`deltaIncentive` 与 `deltaNative`/`deltaTotal` 模式一致**：三者都遵循 `hasInput ? after - current : null` 核心模式，`deltaIncentive` 额外在 `hasInput=false` 时加 wallet dilution gap 分支。

## Learned Lessons: Cap warning 文案统一 (AAV-785/AAV-851)

- **`formatProtocolCapText` 是 Reserve Table 和 Portfolio 的共享入口**：两处使用同一函数生成 protocol cap warning 文案，未来改文案只改一处。函数接受 `availableFormatted: string`（预格式化），因为 Reserve Table 用 `formatScenarioSize`（支持 USD/Token 模式），Portfolio 用 `formatUsd`（纯 USD）。
- **`currentExceeded` 语义变更**：旧 SimulationSubRow 用 `"exceeds cap by $X"` 描述超出量（`exceededByUsd`），新文案统一为 `"Current {Supply|Borrow} limited to $X available"` 描述可用量（`availableRoomUsd`）。数值从 exceededBy 变成了 availableRoom，语义和数值都不同——这是有意的设计决策，"limited to X available" 信息量更大。
- **测试 describe 嵌套要注意**：Vitest 允许 describe 内嵌套 describe，但如果嵌套位置错误会导致 it 块归属到错误的 describe。新增 describe 块时要确保放在正确的外层 describe 之外。

## Learned Lessons: 同名 per-source sum 函数口径不一致 (AAV-978)

- **per-source sum 的 canonical 实现必须在 `incentiveAggregation.ts`**：`rateSimulationCalculator.ts` 曾维护独立的 `sumBrevisIncentiveApr`（纯 headline，无 forecastStates），与 `incentiveAggregation.ts` 的同名函数（支持 forecastStates）口径不同。dispatch map 的 per-source current 用 calculator 版本，`buildIncentiveCurrent` 的 total current 用 aggregation 版本，导致分项之和 ≠ 总值。**教训：per-source sum 函数只有一个 canonical 位置（`incentiveAggregation.ts`），calculator 层只 import 不重建。**
- **per-campaign current 也必须与 per-source sum 口径一致**：`buildBrevisCampaignDetails` 中 per-campaign `current` 用 `sanitizePercent(resolved.campaignApr)`（headline），但 per-source sum 用 `resolveBrevisCurrentApr(resolved, forecastStates)`（可能含 forecast），导致 campaign detail 行的 current 之和 ≠ per-source current。**教训：修改 per-source sum 时必须同步修改 per-campaign current 计算。**
- **抽取辅助函数消除重复**：`resolveBrevisCurrentApr(resolved, forecastStates)` 被三处共享（`sumBrevisIncentiveApr` 的 mapValue、`sumBrevisIncentiveApy` 的 mapValue、`buildBrevisCampaignDetails` 的 current），避免改一处忘改另一处。
- **APY 转换策略统一为 APR-only + 独立 APY 函数**：Merit/Merkl/Brevis 统一使用 `sumXxxIncentiveApr`（纯 APR）+ `sumXxxIncentiveApy`（APY 转换），不再用内联 `isApy` 参数。dispatch map 按需选调。

## Learned Lessons: per-source sum 统一后 dispatch map 参数映射 (AAV-980)

- **统一 per-source sum 后必须逐参数校验映射**：旧 calculator `sumMerklIncentiveApr(opportunities, isApy, tydroPointToUsdRate, whitelistMerklCampaignIds, forecastStates?, groupMultiplier?, campaignAccessStatuses?)` → 新 aggregation `sumMerklIncentiveApr(opportunities?, pointToUsdRate?, options?)`。review 发现 `sumAfter` 遗漏了 `campaignAccessStatuses`（旧代码第 7 个参数，新代码在 `options` 中），导致黑名单 campaign 在 after 计算中未被过滤。**教训：签名迁移时必须逐参数对照，options 对象比位置参数更容易漏传。**
- **`getPointToUsdRate` 的 fallback 语义必须与 symbol 归属一致**：`tydroPointToUsdRate` 是 TydroInk 专属换算率，`getPointToUsdRate` 在 symbol 不在 map 中返回 0 是正确的——不同 symbol 不应 fallback 到另一个 symbol 的 rate。"查不到" = "不知道" = 0，而非"用另一个 rate 凑数"。
- **`groupMultiplier` 需要加到 aggregation 版才能统一**：aggregation 版 `sumMerklIncentiveApr` 原先缺少 `groupMultiplier` 支持，但 `sumActiveCampaignBreakdownValues` 已支持。统一前需确认 aggregation 版具备 calculator 版的所有能力，否则统一后会丢功能。
