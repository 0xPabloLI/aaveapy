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
   5. **Requesting Code Review** — 实施完成后用 `requesting-code-review` skill 请求 code review
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

### 4. `headlineIncentive` 是无 position cap 的基线
- `headlineIncentive` = 有 TVL forecast、有 wallet-only eligibility scaling，但 **无 position cap 稀释** 的 incentive 值。
- 与 `currentIncentive` 的唯一区别：headline 不传 `positionUsd`，所以不应用 Merit/Merkl/Brevis position cap dilution。
- 用于 `deltaIncentive` 计算：`hasInput ? after - current : (wallet ? current - headline : null)`。
- 无输入有钱包时，`deltaIncentive = current - headline` 纯粹反映 position cap dilution gap。
- Headline **不**经过 dispatch map，使用 `calculateTotalIncentiveApy/Apr`（无 `positionUsd` 参数）。

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

**Known issue**: `/implement` silently skips `/tdd` (upstream #479 — "pre-agreed seams" never established). For critical logic, explicitly run `/tdd` before `/implement`.

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
- **Position cap note 文案 `"incentive on first $X only"` 有歧义**：`"only"` 紧跟金额，容易被读成整个短语的尾修饰而非修饰 incentive。改为 `"Incentive limited to first $X"` 更 native——`"limited to"` 是金融 UI 标准表述，语义无歧义。
- **Position cap note 不传 campaignName**：campaignName 参数只在 Merit 传了硬编码字符串（`"Merit double yield"`/`"Merit"`），Merkl 只在 IncentiveTooltip 传了 `opportunity.name`，Brevis 从未传入——三处不一致。Note 已出现在 source header 下方，用户知道是哪个 source。移除 campaignName 后文案统一为 `"Incentive limited to first $X"`，更简洁。IncentiveTooltip 的 `campaignName` 字段也从未被消费（`.campaignName` 无匹配），一并清理。

## Learned Lessons: 同名 per-source sum 函数口径不一致 (AAV-978)

- **per-source sum 的 canonical 实现必须在 `incentiveAggregation.ts`**：`rateSimulationCalculator.ts` 曾维护独立的 `sumBrevisIncentiveApr`（纯 headline，无 forecastStates），与 `incentiveAggregation.ts` 的同名函数（支持 forecastStates）口径不同。dispatch map 的 per-source current 用 calculator 版本，`buildIncentiveCurrent` 的 total current 用 aggregation 版本，导致分项之和 ≠ 总值。**教训：per-source sum 函数只有一个 canonical 位置（`incentiveAggregation.ts`），calculator 层只 import 不重建。**
- **per-campaign current 也必须与 per-source sum 口径一致**：`buildBrevisCampaignDetails` 中 per-campaign `current` 用 `sanitizePercent(resolved.campaignApr)`（headline），但 per-source sum 用 `resolveBrevisCurrentApr(resolved, forecastStates)`（可能含 forecast），导致 campaign detail 行的 current 之和 ≠ per-source current。**教训：修改 per-source sum 时必须同步修改 per-campaign current 计算。**
- **抽取辅助函数消除重复**：`resolveBrevisCurrentApr(resolved, forecastStates)` 被三处共享（`sumBrevisIncentiveApr` 的 mapValue、`sumBrevisIncentiveApy` 的 mapValue、`buildBrevisCampaignDetails` 的 current），避免改一处忘改另一处。
- **APY 转换策略统一为 APR-only + 独立 APY 函数**：Merit/Merkl/Brevis 统一使用 `sumXxxIncentiveApr`（纯 APR）+ `sumXxxIncentiveApy`（APY 转换），不再用内联 `isApy` 参数。dispatch map 按需选调。

## Learned Lessons: per-source sum 统一后 dispatch map 参数映射 (AAV-980)

- **统一 per-source sum 后必须逐参数校验映射**：旧 calculator `sumMerklIncentiveApr(opportunities, isApy, tydroPointToUsdRate, whitelistMerklCampaignIds, forecastStates?, groupMultiplier?, campaignAccessStatuses?)` → 新 aggregation `sumMerklIncentiveApr(opportunities?, pointToUsdRate?, options?)`。review 发现 `sumAfter` 遗漏了 `campaignAccessStatuses`（旧代码第 7 个参数，新代码在 `options` 中），导致黑名单 campaign 在 after 计算中未被过滤。**教训：签名迁移时必须逐参数对照，options 对象比位置参数更容易漏传。**
- **`getPointToUsdRate` 的 fallback 语义必须与 symbol 归属一致**：`tydroPointToUsdRate` 是 TydroInk 专属换算率，`getPointToUsdRate` 在 symbol 不在 map 中返回 0 是正确的——不同 symbol 不应 fallback 到另一个 symbol 的 rate。"查不到" = "不知道" = 0，而非"用另一个 rate 凑数"。
- **`groupMultiplier` 需要加到 aggregation 版才能统一**：aggregation 版 `sumMerklIncentiveApr` 原先缺少 `groupMultiplier` 支持，但 `sumActiveCampaignBreakdownValues` 已支持。统一前需确认 aggregation 版具备 calculator 版的所有能力，否则统一后会丢功能。

## Learned Lessons: CI openapi-sync push rejected race condition (AAV-1034)

- **`git push` 前必须 `git pull --rebase`**：CI 中任何自动 commit+push 的 job，在 checkout 到 push 之间分支可能已有新 commit，直接 push 会被 rejected。`git pull --rebase origin ${{ github.ref_name }}` 确保 sync commit rebase 到最新 HEAD 后再 push。
- **openapi-check 和 openapi-sync 并行导致死循环**：check 先 fail，sync 后 push 但被 reject（因为新 commit 已推入），下次 CI 仍用旧 spec → check 又 fail。修复 rebase 后 push 成功，循环打破。
- **GitHub Actions `run: |` 块默认 `set -e`**：`git pull --rebase` 失败会停止执行，不会走到 `git push`，所以 rebase 冲突时不会 force push，安全性有保证。
- **`git pull --rebase` 前必须 stash unstaged changes**：npm scripts（如 `openapi:fetch` 触发的 `generate-icon-manifests + vitest`）会在工作目录产生未追踪文件，导致 rebase 失败。修复：`git stash --include-untracked` → `git pull --rebase` → `git stash pop || true`。

## Learned Lessons: APR capped note 显示条件 (AAV-1059)

- **`regime === 'APR_CAPPED'` 不等于"cap 对用户产生了新影响"**：`forecastWithTVL` 返回 `APR_CAPPED` 只表示 `aprBasedDaily < requiredDaily`（cap 在数学上是 binding 的），但低 TVL 池子 current 就已经是 cap 后的值（`campaignApr ≈ aprCap`），after 也等于 aprCap，`after === current`。此时 note 只是重复已知信息，无新增价值。**教训：note 显示条件必须是"cap 使 after 低于了 current"，而非"cap 在数学上是 binding 的"。**
- **`after < uncappedAfter` 是 no-op 判定**：低 TVL 时 uncapped after 极大（`requiredDaily * 365 / tvl`），`after < uncappedAfter` 永远成立，等价于原来的 `regime === 'APR_CAPPED'`。正确判定是 `after < current`：只有当 headline APR（current）高于 cap 后的实际 APR（after）时，note 才有意义。
- **`after < current` 的语义**：current 来自 `campaignApr`（headline，API 返回的展示值），after 来自 `forecastWithTVL`（cap 后实际值）。当 `campaignApr > aprCap` 时 current > after，说明 headline 夸大了实际收益，note 告知用户"你看到的 APR 被 cap 压低了"。当 `campaignApr ≈ aprCap` 时 after ≈ current，headline 已经反映了 cap，note 无新信息。
- **`ignoreCap` 不应影响 FIX_REWARD 路径**：FIX 的 `aprCap` 是固定发放率（不是上限），`ignoreCap` 只应在 MAX_REWARD 和 TARGET_TOTAL_APR+MAX_APR 路径生效。实现方式：FIX 路径用 `rawAprCap`，MAX 路径才用 `ignoreCap ? Infinity : rawAprCap`。
- **MAX_REWARD 和 TARGET_TOTAL_APR 的 cap 不需要区分文案**：两者对用户来说都是"池子 TVL 低导致 APR 被压低"，行动指引一样，不需要不同的 note 文案。

## Learned Lessons: Merkl eligibility 缩放与 headline 一致性 (AAV-1060)

- **`grossUsd` 必须用 total position 而非 delta-only `supplyInputUsd`**：`merklGroupMultiplier` 和 `merklCrossReserveNote` 的 `grossUsd` 原来用 `side === 'supply' ? supplyInputUsd : borrowInputUsd`（delta-only），当 `supplyInputUsd=0` 但 `totalSupplyUsd=1042` 时 `computeCrossReserveEligibilityRatio` 因 `sourceGrossUsd<=0` 返回 1，跳过 cross-reserve offset 缩放。修复：改为 `supplyGrossForEligibility`（`totalSupplyUsd ?? supplyInputUsd`，total-based）。**教训：eligibility 计算的"总仓位"语义必须与 `buildIncentiveCurrent` 中的 wallet 推导一致——都是 total-based，不是 delta-based。**
- **aggregate current 必须与 per-source current 使用同一 `merklGroupMultiplier`**：`buildIncentiveCurrent` 原来缺少 `merklGroupMultiplier` 参数，导致 aggregate current 无 eligibility 缩放而 per-source current 有，分项之和 ≠ 总值。修复：把 eligibility ratio + multiplier 计算提前到 `buildIncentiveCurrent` 调用之前，传入参数。**教训：aggregate 和 per-source 必须共享同一个缩放函数实例，不能一个有一个没有。**
- **headline incentive 必须与 current incentive 使用同一 `merklGroupMultiplier`**：`supplyHeadlineIncentive`/`borrowHeadlineIncentive` 原来不传 `merklGroupMultiplier`，而 `buildIncentiveCurrent` 已传。`deltaIncentive = currentIncentive - headlineIncentive` 在 wallet dilution gap 路径下缩放口径不一致。**教训：`deltaIncentive` 三态分路的每一路（simulation delta / wallet dilution gap / null）都要求 `current` 和 `headline` 使用同一缩放——否则差值的语义会混入缩放差异。**
- **`merklCrossReserveNote` 的 `grossUsd` 也需 total-based**：note 中显示的 `$1,042`（总仓位）而非 `$0`（delta），让用户看到正确的 net eligible 比例。Bug 1 修复的 `supplyGrossForEligibility` 自动覆盖了 note 逻辑。**教训：修复一个变量名时，检查同一变量的所有消费点——函数签名参数可能只传一次，但内部多路分支可能依赖不同的语义。**
- **被删除的 caller contract 注释必须恢复**：`totalSupplyUsd` 三种调用方合约说明（Portfolio: wallet+delta / Single: input=total / No input: undefined）在代码搬迁时被删除。**教训：有合约语义的注释必须跟着变量走，搬迁代码时先复制注释再删除原位。**
- **Brevis position cap 的 positionUsd fallback 应为 total-based（AAV-1060 #10）**：`sumForecastBrevisIncentiveApr` 和 `buildBrevisCampaignDetails` 的 `positionUsd` 原来用 `combined ?? inputUsd`（delta-only fallback），当 `combined` 不存在但 `totalPositionUsd` 有值时（如 single simulation），Brevis cap 基于 delta 而非 total position，与 Merit position cap 语义不一致。修复：`positionUsd = combined ?? totalPositionUsd ?? inputUsd`。**教训：同质的 position cap 语义（Merit cap 和 Brevis cap 都约束 per-user APR）必须使用同质的 position 度量——都是 total-based，不是 delta-based。**
- **headline 含 forecast 不影响 deltaIncentive 语义（AAV-1060 #6/#11-13 验证）**：headline incentive 调 `calculateTotalIncentiveApr` 传了 `forecastStates`，看似会让 `deltaIncentive = current - headline` 混入 forecast 变化。但验证后发现：(1) Merkl/Brevis 两边都含 forecast，差值抵消为 0；(2) Merit current 中 `sumForecastMeritIncentiveApr(depositUsd=0)` 跳过 forecast 路径只做 position cap，headline 用纯 `campaignApr` 无 forecast 无 cap，差值 = 纯 position cap dilution。**教训：差值语义需要逐 source 验证抵消关系，不能仅凭"两边参数不同"就断言有 bug——可能恰好抵消。**

## Learned Lessons: 极端 APR 显示、reward token icon 优先级、opp-level message 位置

- **`smartPercent` 必须有上限 cap**：短期高 APR incident（如 Merkl TVL 极低时）可产生 `321032686389358.88M%` 这样荒谬的显示。`>= 1M` 分支原来只做 `/1_000_000 + M%` 无上限。修复：`PERCENT_M_CAP = 999.99`，超过显示 `>999.99M%`/`<-999.99M%`；`Infinity`/`-Infinity` 返回 `-`。**教训：格式化函数必须有上限截断 + 非有限值守卫，不能假设业务层数据总在合理范围。**
- **reward token icon 应优先用 source 提供的 URL 而非本地 manifest**：Merkl 返回 `rewardTokenIconUrl`（如 `aCelUSDT.jpeg`）是链感知的 icon，与 Merkl 官网一致；本地 manifest 的 `ausdt.png` 是通用 aToken icon，视觉不同。`resolveRewardTokenIconSrc` 改为 `preferredUrl` 优先、本地 manifest 兜底。Merit/Brevis 不提供 `rewardTokenIconUrl`，不受影响。**教训：当 source 提供了"官方" icon URL 时，用它比本地映射更准确；本地 manifest 的角色应从"优先"降为"fallback"。参数名应反映实际语义（`preferredUrl` 而非 `fallbackUrl`）。**
- **多 campaign 时 opp-level message 放在底部会被误认为最后一个 campaign 的附属信息**：视觉上用户无法区分"这是 source 级共享信息"还是"这是最后一个 campaign 的说明"。修复：多 campaign 时将 `sourceMessageLines` 渲染移到 source header 和 campaign rows 之间。单 campaign 不变（message 仍在 campaign content 内，跟在 time 行后面）。**教训：UI 元素的视觉位置必须传达其语义层级——source 级信息应在 source 级区域，不能"寄生"在子级区域的末尾。**

## Learned Lessons: 测试参数错位与流程缺失（Merkl Position Cap 实现）

- **多可选参数函数的测试调用必须逐参数对照签名**：`buildMerklCampaignDetails` 有 16 个参数，测试中 `eligibilityRatio`（第 8 位，默认=1）被传了 `1000`，`grossInputUsd`（第 9 位）被传了 `undefined`——错位一个位置。结果 `after = campaignApr * 1000 * 1 = 10000` 而非预期的 10。**教训：超过 5 个参数的函数调用，写测试时必须逐参数对签名注释，或改用 options 对象模式。参数错位的症状是"值异常大/小"且恰好等于 `expected * wrongParam`。**
- **跨前后端功能必须走 PRD → Issues → Implement 流程**：Merkl position cap 涉及后端类型/提取/OpenAPI schema + 前端类型/Zod schema/计算逻辑/测试，是跨前后端的复杂功能。跳过 PRD 直接写代码导致：(1) 没有 scope 边界，改动蔓延；(2) 没有 issue 追踪，进度不透明；(3) 没有 code review checkpoint；(4) 没有 dev server 验证。**教训：涉及 3+ 文件/跨层级的改动，必须先写 PRD 确认 scope，拆 issue 逐步实现，每步 review + 验证。**
- **Position Cap 统一入口不值得做**：4 个调用点（Merit×2, Merkl×1, Brevis×1）的 `positionUsd` 推导逻辑各不同（Merit: `totalPositionUsd ?? inputUsd`，Merkl: `netForEligibility ?? (grossInputUsd ?? inputUsd)`，Brevis: `effectiveInputUsd`），options 差异也大（Brevis 传 remainingBudget/dailyRewardUsd/remainingDays，Merit 传 campaignName，Merkl 只传 isCombineCap）。`applyPositionCapToForecastResult` 本身已是统一入口。**教训：当调用前参数推导和调用后处理差异大于共享逻辑时，强行统一 wrapper 增加间接层认知成本，不如保持各点独立调用统一底层函数。**

## Learned Lessons: isCombineCap 语义 vs netPositionConstraint (AAV-1075/1076)

- **`isCombineCap` 和 `netPositionConstraint` 是两个独立概念**：`isCombineCap` = position cap 是否跨 supply+borrow 共享（同一 token 同一侧的 cap 语义）；`netPositionConstraint` = Merkl scoring 是否跨 reserve 做 net 计算（不同 token 之间的 scoring 规则）。两者可共存（如 Celo USDT Merkl supply 同时有 `positionCapNative` 和 `netPositionConstraint`），互不影响。
- **Merkl `isCombineCap = false` 是语义推导，不是硬编码**：Merkl scoring 按 side 独立——supply 和 borrow 各有自己的 scoring balance。`maxDeposit` 限制的是**单侧** scoring balance，不是 net position cap，也不是 combine cap。因此 `isCombineCap = false` 是从 Merkl scoring 语义推导出来的正确值。`computeMethod = "maxDeposit"` 是有 position cap 的充分必要条件。
- **Brevis `isCombineCap` 从描述文案推断**：描述文案含 "combined total of up to $X in collateral and/or debt" → `isCombineCap = true`。如果未来有非 combined 的 Brevis campaign，需要从描述中用正则提取。当前硬编码 `true` 是因为 Brevis 目前只有 MetaMask Card campaign。
- **旧文档中 "Merkl maxDeposit 是 net position cap" 的描述有误**：已修正为 "per-side per-user balance cap"。`netPositionConstraint` 是独立字段，不是 maxDeposit 的语义。

## Learned Lessons: `decimals ?? 18` 统一入口 (AAV-1075/1076)

- **后端 `/markets` API 对 66% 的 reserve 不返回 `decimals`**：当 `decimals = 18`（默认值）时省略，前端必须 fallback。
- **`DEFAULT_TOKEN_DECIMALS` 必须统一入口**：提取到 `src/lib/tokenDefaults.ts`，所有使用 `decimals ?? 18` 的地方统一 import。避免某天改默认值时遗漏一处导致 native→USD 换算错误。
- **`resolvePositionCapUsd` 之前在 `decimals = undefined` 时不换算——这是 bug**：Merkl 的 `positionCapNative` 需要 decimals 换算，但 reserve 没有 decimals 时直接跳过换算、回退到 `positionCapUsd`（Merkl 不提供），导致 position cap 静默不生效。修复：`resolvePositionCapUsd` 在 `decimals` 缺失时使用 `DEFAULT_TOKEN_DECIMALS`（18）。
- **涉及文件**：`tokenDefaults.ts`（常量定义）、`incentiveCaps.ts`、`scenarioSize.ts`、`deficit.ts`、`rateSimulationCalculator.ts`、`userPositionMapper.ts`。

## Learned Lessons: Portfolio 模式 crossReservePositions 数据源错配 (AAV-1086)

- **两条路径的数据源必须一致**：`ReservesTable.tsx` 构建 `crossReservePositions` 用的是 shared scenario inputs（Portfolio 模式下为空），而 `portfolioSimulator.ts` 用的是 portfolio entries 的 total position（wallet + delta）。两条路径对同一份数据用了不同数据源，导致一条路径永远为 undefined。**教训：当同一条数据在两个消费者之间共享时，必须确保两者使用相同的数据源和构建逻辑，而非各自从不同输入推导。**
- **死代码暗示设计缺陷**：旧代码 `if (!isPortfolioMode) return undefined;` 后面的 for 循环在两种模式下都不可达（Portfolio 被 shared inputs 为空拦截，Shared 被 early return 拦截）。这段从未执行的代码是"先写通用逻辑再分支"的遗留，但分支条件使得通用逻辑永远不会执行。**教训：当 if/else 两个分支都让后续代码不可达时，应该怀疑分支逻辑是否正确——可能其中一个分支的条件写反了。**
- **useMemo 顺序依赖必须显式**：`perReserveInputs` 在 `crossReservePositions` 之后定义但被其依赖。React hooks 按定义顺序执行，如果 `crossReservePositions` 引用了尚未定义的 `perReserveInputs`，会得到 `undefined`。虽然 `useMemo` 是惰性求值不会立即崩溃，但依赖项缺失会导致 stale closure。**教训：当 useMemo A 依赖 useMemo B 的结果时，B 必须定义在 A 之前。**
- **单一数据源优于各自计算**：初始修复提取了 `buildCrossReservePositionsFromPerReserveInputs` 纯函数从 `perReserveInputs` 推导，但 `portfolioSimulator:169` 有独立的构建逻辑。grill 后发现两条路径"巧合一致"而非"强制一致"——未来维护者可能只改一处忘改另一处。最终方案：让 `buildPerReserveInputsFromEntries` 同时返回 `crossReservePositions` + `reserveSymbolById`（`PortfolioInputsResult`），单一计算源保证一致性，删除了 3 个 useMemo + 1 个函数 + 7 个测试。**教训：当两个消费者需要同一条派生数据时，让数据生产者一次构建、多次消费，而非各自独立推导。**

## Learned Lessons: afterNative 单位一致性 + Unified Mode 生产默认

- **`afterNative` 必须始终使用 APY，不能随 `isApy` 切换到 APR**：`rateSimulationCalculator.ts` 中 `supplyAfterNative`/`borrowAfterNative` 原先在 `isApy=false` 时使用 `supplyAprPercent`/`borrowAprPercent`，而 `currentNative` 始终来自 `reserve.supplyApy`（APY）。两者做差产生虚假 delta（APY current vs APR after），这个 delta 不是用户输入造成的，而是单位转换差。AprApyToggle 的 tooltip 明确说 "Only incentive annual % follows this switch; native stays APY"，但代码没有遵守。**教训：当 toggle 声称某个字段不受切换影响时，必须验证该字段在所有代码路径中确实不受影响——calculator 层的 `isApy` 分支可能悄悄违反这个合约。**
- **`scenarioUsdAccrual` 正确使用 APR 做日收益计算**：`buildSupplyUsdAccrualSide` 使用 `combinedNativeSimulation?.supplyAprPercent`（APR）做 per-second compounding 日收益，这是正确的——线性日收益需要 APR 而非 APY。修复 `afterNative` 不影响此路径，因为 USD accrual 直接从 `combinedNativeSimulation` 取 APR，不经过 `afterNative`。
- **Unified Table 从 opt-in (`?unified=1`) 改为默认 (`?unified=0` opt-out)**：生产环境用户不再需要手动加 URL 参数。Legacy 布局（PortfolioTokenRow + PortfolioResultsTable + PortfolioSummaryCard）仍可通过 `?unified=0` 访问，用于调试和对比。**教训：feature flag 从 opt-in 转 opt-out 时，所有测试 legacy 布局的测试用例需要显式加 opt-out 参数，否则会在新默认路径下失败。**
- **Native `title` 属性不可作为唯一信息载体**：浏览器原生 `title` tooltip 需要 hover 停留 1-2 秒，移动端完全不工作，且无视觉提示。必须用 Radix Tooltip 组件替代（dotted underline 作为视觉 affordance + hover/tap 触发）。**教训：任何对用户决策有影响的信息都不能仅依赖 native `title`——它对移动端用户完全不可见。**

## Learned Lessons: Wallet 显示 Option E + UI 规范统一

- **Option E: 输入框显示完整 effective value（非 delta）**：用户直接输入完整的目标仓位值（如 wallet=$1,000, 输入 $1,500 = +$500 delta）。移除了 ± sign toggle 按钮——sign 由 effective vs wallet 的大小关系自动推导（effective > wallet → +1, effective < wallet → -1）。**教训：sign 不应是独立的用户选择，而是 effective value 的自然推导结果——让用户思考"我要多少仓位"而非"我要加/减多少"。**
- **Arrow `→` 常驻显示**：当 `hasWallet` 时，箭头 `→` 始终显示在 wallet compact 值后面，颜色跟随 effective vs wallet 关系（emerald=above / red=below / muted=equal）。不只在 `isModified` 时显示——即使没有 delta，箭头也传达"这里是你的仓位，右边是你输入的值"的语义。**教训：常驻元素比条件显示元素更减少认知负担——用户不需要记忆"什么时候有箭头"。**
- **`cursor-auto` 是 tooltip-only 元素的正确 cursor**：DESIGN-SYSTEM-REFERENCE §6 明确规定——自动展示 tooltip 用 `cursor-auto`（+轻微悬停反馈），点击展示用 `cursor-pointer`。MetricValue 和 WarningMarker 的 `cursor-help`→`cursor-pointer`→`cursor-auto` 的三次修正过程说明：**查设计系统文档先于凭直觉改**。`cursor-help` 渲染为 `?` 光标不在设计体系内；`cursor-pointer` 暗示可点击但实际无 click action。
- **WarningMarker 移除 Supply/Borrow 前缀**：`formatProtocolCapText` 返回的文本已包含 "Supply limited to..." / "Borrow limited to..."，WarningMarker 中额外的 "Supply"/"Borrow" label span 是重复信息。incentive_cap/incentive_offset 的 header 从 "Supply · {source}" 简化为 `{source}`（capitalize）。**教训：当文本已包含 side label 时，不要在 UI 层重复显示——冗余信息增加认知负担。**
- **表格边框层次**：group separator 的 `border-l border-border/20` → `/40` → `/60`，使 Input→Native→Incentive→Total→Earn 各模块之间的视觉分隔在 light 和 dark mode 下都清晰可见。Dark mode `--border: hsl(220 10% 22%)` (L22) over bg L6: `/60` 给出 effective L15.6 (Δ9.6)；light mode `--border: hsl(23 5% 82%)` (L82) over bg L100: `/60` 给出 L89.2 (Δ10.8)。Row separator 保持 `/30` (Δ~5)，形成 2× hierarchy。**教训：边框透明度选择应基于 HSL lightness 计算的有效对比度，而非"看起来差不多"——dark mode 和 light mode 需要同一透明度同时满足两种背景。**
- **`clampFn` 参数消除 cap input flicker**：`useDebouncedInput` 新增 `clampFn?: (formattedValue: string) => string` 参数，在 `handleChange` 和 `doCommit` 中格式化后、显示前实时 clamp。旧方案：`setDisplayValue(unclamped)` → store 更新为 clamped → `useEffect` 同步 `displayValue` 为 clamped，中间有 1 帧 flicker。新方案：`clampFn` 在 display 前执行，display 和 store 始终同步。**教训：当 commit 后的 store 值可能与 display 值不同（如 clamping）时，必须在 `setDisplayValue` 之前应用 transform——不能依赖 `useEffect` 事后同步。**
- **`HelpCircle` vs `Info` 图标语义**：`HelpCircle`（带 `?`）用于 FAQ/帮助导航链接（Header、DefiYieldTracker），`Info`（带 `i`）用于信息提示 tooltip（AprApyToggle、InkAprCalculator、WatchAddressInput）。两者不可混用——WatchAddressInput 的信息提示原先用 `HelpCircle`，已统一为 `Info`。**教训：图标选择应匹配语义——`HelpCircle` = 导航到帮助页面，`Info` = 原地信息提示。**

## Learned Lessons: Unified Table 列宽分配 + 侧分隔线 + Legacy 清除

- **`table-layout: auto` 多列共享剩余空间**：Token、Supply Input、Borrow Input 三列都不设 width，由 auto 布局按内容 max-content 比例分配剩余空间。Token 内容窄拿到较小份额，Input 列拿到大头。之前用 `width: 1px` trick 限制 Token 列不抢空间，但实际效果是 Token 列被过度压缩。去掉 1px 后三列自然分配更合理。**教训：auto 布局已经足够智能，不需要用 1px trick 强制干预——让浏览器按内容比例分配是最自然的方案。**
- **三级边框层次：GROUP_SEP (/60) > SIDE_SEP (/40) > row (/30)**：模块间分隔（Input→Native→Incentive→Total→Earn）用 `/60`，同一模块内 Supply→Borrow 分隔用 `/40`，行间分隔用 `/30`。旧版只有 GROUP_SEP 没有 SIDE_SEP，Supply 和 Borrow 之间完全靠背景色（emerald/cyan tint）区分，dark mode 下几乎不可见。**教训：语义色 tint 太淡不足以作为分隔手段——必须有显式边框；三级层次确保模块 > 侧 > 行的视觉优先级。**
- **Banded cluster 全列统一**：所有 per-side 列（Input, Native, Incentive, Total, $/day）都携带语义 band tint（emerald=Supply, cyan=Borrow）。只有 Net $/day（跨侧聚合）用中性 `HEADER_BASE`。旧版只有 APR 段（Native/Incentive/Total）有 band，Input 和 $/day 没有——视觉断裂让用户困惑"为什么只有这一段有颜色"。**教训：语义色 tint 应在全行一致应用，不能只选某几列——否则用户会误解为"有颜色的列"和"没颜色的列"是不同类别的数据。**
- **Wallet display 精度分场景**：wallet 显示标签（输入框外，只读）用 2 位小数（USD 模式）或 4 位小数（Token 模式），与 `formatUsd` 一致。输入框内的值仍用 `formatConvertedAmount`（8 位有效数字），因为用户在 USD↔Token 切换时不应丢失精度。**教训：只读展示用标准金融精度（2 位小数），可编辑值用高精度（8 位有效数字）——两者语义不同，不能用同一个 formatter。**
- **`?unified=0` opt-out 移除——unified 是唯一布局**：legacy `PortfolioTokenRow` + `PortfolioTokenRowPrototype` + `PortfolioSummaryCard` + `PortfolioResultsTable` 全部文件及测试从代码库删除。`unifiedMode` flag 删除，`?unified=0` URL 参数被完全忽略（SPA 仍能打开但统一渲染 unified table）。**教训：feature flag 从 opt-out 转"唯一模式"时，必须删除所有 flag 引用 + 删除 dead code 文件 + 更新/删除测试 flag 的测试用例——不能留 flag 在代码里"以防万一"。**

## Learned Lessons: Net $/day 符号 bug + Token 列间距

- **`borrowResult.usdPerDay` 已带符号（负数=成本），Net = supply + borrow（不是 supply - borrow）**：`computePositionUsdPerDay('borrow', ...)` 返回 `-nativeDaily + incentiveDaily`，已经是带符号的值。Per-row Net $/day 计算 `s - b`（其中 `b` 为负数）等于 `s + |b|`，导致只有 Borrow 时 Net 永远为正。正确公式是 `s + b`（代数加法），与 `aggregatePortfolioSummary` 中 `netUsdPerDay = supplyUsdPerDay + borrowUsdPerDay` 一致。**教训：当两个操作数中有一个已带符号时，求和用 `+`（代数加法），不用 `-`（减法）——`a - (-b) = a + b` 是基本数学但容易在"Net = supply - borrow"的语义直觉下写错。**
- **Token 列 `pr-0.5`（2px）比 `pr-1`（4px）更紧凑**：Token 列内容（icon + symbol）与 Input 列之间的 GROUP_SEP 边框线在 `pr-1` 时有 4px 空白，视觉上像边界线断裂。`pr-0.5`（2px）收窄间距，让边界线紧贴 Token 内容。**教训：表格中无底色列与有底色列之间的边界线，间距越小视觉越连续——空白间距会让人感觉边界线"断开"。**

## Learned Lessons: Merkl position cap native token 显示 (AAV-1097/1098/1099)

- **显示层改 native、计算层保持 USD 是正确分层**：`resolvePositionCapUsd` 仍将 `positionCapNative` 转为 USD 用于 dilution 公式（`aprPercent × min(positionUsd, capUsd) / positionUsd`），只有 note 文案和 tooltip 渲染改为 native token amount。计算需要统一货币单位，显示需要语义稳定的原始量——两层职责分离。
- **dispatch 调用新增参数时必须同步所有调用点**：`SideSourceContext` 接口已定义 `tokenSymbol`，context 构建也赋了值 `tokenSymbol: reserve.tokenSymbol`，但 dispatch 调用 `buildMerklCampaignDetails(...)` 漏传了 `ctx.tokenSymbol`。这是 AAV-980 的重复——签名迁移时只改了接口和 context 构建，忘了改 dispatch 调用。**教训：新增 context 字段后，必须检查 `sourceDispatch` 中所有 `buildDetails`/`sumCurrent`/`sumAfter` 调用是否都传了新字段。**
- **两条渲染路径数据源不同**：`IncentiveTooltip.tsx` 直接从 `breakdown.positionCapNative` + `reserve.tokenSymbol` 取值（不经过 calculator），而 `SimulationSubRow` 和 `PortfolioUnifiedTable` WarningMarker 通过 `SimulationCampaignDetail.notes` ← `buildMerklCampaignDetails` 取值。修改 calculator 层的 native 参数传递只影响后者，前者需单独修改。**教训：当同一数据在两条路径中消费时，修改一条路径的参数传递不会自动修复另一条——必须逐路径验证。**
- **BigInt 解析逻辑在 `incentiveCaps.ts` 中重复 3 处**：`convertPositionCapNativeToUsd`、`formatNativeTokenAmount`（新增私有函数）、`formatPositionCapNativeDisplay`（新增公开导出）三处都有相同的 `BigInt(positionCapNative) → divisor → wholePart → fracPart → Number` 模式。`formatNativeTokenAmount` 已被后两者共享，但 `convertPositionCapNativeToUsd` 仍有独立实现（因其需乘 tokenPrice）。可进一步抽取 `parseNativeTokenAmount(raw: string, decimals: number): number | null` 作为单一解析入口。
- **`buildMerklCampaignDetails` 参数膨胀至 21 个**：本 session 新增 `tokenSymbol`、`walletEligibilityRatio`、`walletMerklGroupMultiplier` 三个参数。位置参数模式在 21 个参数下极易出错（AAV-980 和 AAV-1075 的参数错位 bug 已证明）。应迁移到 options 对象模式，但属于独立重构任务。

## Learned Lessons: Portfolio 模式必须统一使用 allReserves（过滤 bug）

- **Portfolio 模式下所有数据计算必须用 `allReserves` 而非 filtered `reserves`**：`ReservesTable.tsx` 接收两个 list——`reserves`（经 token/market 过滤后的列表）和 `allReserves`（全量列表）。Portfolio entries 可以引用任何 reserve，不受当前过滤条件限制。`usePortfolioToggle`（L845）和 `PortfolioPanel`（L910/954）已正确使用 `allReserves`，但 `buildPerReserveInputsFromEntries`、`useSharedRateSimulations`、`portfolioCapWarningsMap` 三处遗漏，仍用 filtered `reserves`，导致过滤后部分 portfolio entries 的 simulation 结果和 cap warnings 消失。**教训：Portfolio 模式下的所有计算路径（inputs 构建、rate simulation、cap warnings）都必须使用 `allReserves`，与已建立的 `usePortfolioToggle` 模式保持一致。**
- **不需要中间变量来表达"portfolio 用 allReserves"**：初始修复引入了 `portfolioReservesSource = isPortfolioMode ? allReserves : reserves` 变量，但 `buildPerReserveInputsFromEntries` 已被 `isPortfolioMode` 守卫，可直接用 `allReserves`；只有 `useSharedRateSimulations`（single 和 portfolio 共用）需要内联三元 `isPortfolioMode ? allReserves : reserves`。**教训：当消费点已被模式守卫时，直接用目标值，不引入中间变量——与同文件中 `usePortfolioToggle` 直接传 `allReserves` 的模式一致。**

## Learned Lessons: Portfolio Table 列等宽 + Total 行 band + Toggle 按钮尺寸

- **`table-layout: auto` 下 `50%` colgroup 是建议而非强制**：auto 模式按内容 max-content 分配宽度，`<col width="50%">` 只是浏览器优先参考。当两侧内容差异大时（一侧有 wallet display + 长数字，另一侧为空），等宽可能不完全成立。如果需要严格等宽保证，应改用 `table-layout: fixed`。当前实测两侧等宽，在注释中标注了 "auto layout hint"。
- **Total 行（tfoot）不需要 banded cluster 背景**：设计规范明确"Total 行只保留文字色（SUPPLY_COLOR/BORROW_COLOR），不加 SUPPLY_BAND/BORROW_BAND 背景"。Body 行保留 band 背景（与 header 呼应），Total 行用中性背景（`bg-muted/30`）+ 文字色区分。**教训：Summary/Total 行的视觉处理应与数据行不同——用文字色而非背景色传达语义，减少视觉噪声。**
- **$/T toggle 按钮必须与 input 行高一致**：`h-5`(20px) + `flex items-center justify-center` + `leading-none` 确保文字在固定高度内居中。移动端 `h-11 w-11`(44px) 满足触控目标要求。`px-0.5 → px-1` 增加水平 padding 使按钮不至于太窄。**教训：小按钮的 padding 选择需要同时考虑文字宽度和视觉权重——`px-0.5`(2px) 在只有单字符时太窄，`px-1`(4px) 更平衡。**
- **`postinstall` 不应在修改其他脚本时误删**：修改 `dev:staging` 时 `postinstall` 行被连带删除，review 发现后恢复。**教训：修改 package.json 时只改目标行，不动相邻行——diff 审查时逐行确认。**
- **文件顶部注释必须与代码同步**：`COL_WIDTHS` 从 `undefined` 改为 `'50%'` 后，文件头部的 "Input cols have no width → they absorb all remaining space" 注释与代码矛盾。**教训：修改常量值时必须同步更新所有引用该常量语义的注释。**
- **Input 列 `align-top` 导致内容不垂直居中**：Input `<td>` 上曾有 `align-top`（CSS `vertical-align: top`），使内容贴着单元格顶部，而其他列（Native/Incentive/Total/Earn）默认 `vertical-align: middle` 垂直居中。移除 `align-top` 后所有列对齐一致。**教训：表格单元格的 `vertical-align` 是设计系统级属性，不应按列单独设置——如果某列需要顶部对齐，应该所有列都统一顶部对齐，而非混用。**
- **"Token" → "Reserve" 命名更准确**：表格每行 = 一个 Aave Reserve（某链某资产的借贷池），不是 Token（一个 Token 可跨多链有多个 Reserve）。"Reserve" 是 Aave 协议精确术语。同时 Header text-left→text-center 与其他列统一。**教训：UI 标签应使用领域精确术语，不要用泛化的近似词——"Token" 是 ERC-20 概念，"Reserve" 是 Aave 协议概念，两者不同。**
- **Reserve 列 `pr-2` → `pr-3` 补偿减号按钮视觉不对称**：左侧有 minus 按钮（`gap-1`=4px），`pl-2`(8px)+gap(4px)=12px 左侧总空间，右侧 `pr-2`(8px) 显得局促。`pr-3`(12px) 使两侧视觉平衡。**教训：当列内有额外 UI 元素（按钮、icon）占用空间时，padding 需要考虑这些元素的实际视觉占用，不能只看 CSS padding 值。**
- **Input Supply header `<th>` GROUP_SEP 遗漏**：§4.4 rule 1 要求 GROUP_SEP 必须出现在每个模块的首列，但 Input 模块的 Supply `<th>` 漏了 `border-l border-border/60`，而 Native/Incentive/Total/Earn 都有。**教训：修改边框规则后必须逐模块、逐行（header row 1/2、body、tfoot）对照清单验证，"看一眼觉得对"不够——需要 Playwright 逐 td 检查 computed style。**
