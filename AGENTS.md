# Repository Guidelines

## Quick Reference

- **Test wallet (view-only)**: `0x4D1c0C87D6f3Bcc4698BBd88A9Da5e4f92B65314` — holds Aave V3 positions on mainnet. Source: `e2e/test-wallets.ts`. Use in Playwright via the "Watch address" input.
- **Brand name**: `AaveAPY` (one word, camelCase). Consistent across UI, meta tags, structured data, and locales.

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
- `npm run ci:remote` — full local gate (used by pre-push hook)

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
字体/字号/间距/圆角/阴影等 token 详见 `docs/design/DESIGN-SYSTEM-REFERENCE.md`（840 行主文档）。涉及 UI 样式实现时查阅。

## Session Workflow

### Decision: Lightweight or Substantial?
- **Lightweight**（检查、解释、常规工作）：直接进行，不需要加载额外 skill。
- **UI/UX 设计任务**: 用 `impeccable` skill。
- **Substantial implementation**: 按以下 Mandatory Implementation Workflow 执行。

### Rules
1. **Git safety**: never run `stash`/`checkout` related commands without explicit user confirmation in current chat.
2. **Hook policy**: do not bypass `pre-commit`/`pre-push`; if `ci:remote` fails, fix root cause.
3. **No code changes without explicit go-ahead**: 在用户确认开始或给出明确实施指令前，不修改任何代码文件。讨论、调研、Grill 阶段只做分析和方案设计。

### Mandatory Implementation Workflow
每次改代码之前必须走完以下工作流，不得跳步：

1. **Grill with Docs** — 用 `grill-with-docs` skill 审视方案。**必须主动做场景风险分析**：按 `docs/conventions/scenario-enumeration-checklist.md` 逐类**穷举**边界场景（含跨 step 接口契约验证），验证跨消费者一致性。格式见 `docs/conventions/scenario-matrix.md`。
2. **To Spec** — 用 `to-spec` skill 合成 spec。**必须包含 Scenario & Risk Verification 章节**（场景矩阵），矩阵行直接成为 TDD 测试用例。**无矩阵 = spec 不完整**。
3. **To Tickets** — 用 `to-tickets` skill 将 spec 拆分为带依赖边的 tracer-bullet tickets
4. **TDD Implement** — 逐 ticket 先思考最佳实践的改法是什么，再用 `implement` skill 实施。`implement` 内部驱动 TDD 流程（red → green → refactor），关键逻辑必须先写测试。**测试用例必须覆盖场景矩阵的所有行**。
5. **Code Review** — 实施完成后用 `code-review` skill 做双轴审查（Standards + Spec）
6. **Dev Server + Playwright 验证** — 涉及 UI 交互/布局/样式的改动，CI gate 后必须用 `webapp-testing` skill 在浏览器中验证
7. **Commit** — 通过验证后 commit（遵循 Commit Cadence 规则）
8. **更新相关文档及 Issue** — 同步更新 docs、ADR、Linear issue 状态。**文档改动门槛**：创建或改动 `docs/` 内容前先加载 `writing-for-agents` skill。**实施期文档生命周期**：spec 完成后按 `docs/DOCS-INDEX.md` 清单表登记（Canonical 行为契约留 `docs/specs/`,实施记录/交接/tickets 归档到 `docs/archive/` 日期前缀文件）
9. **Session 结束验证** — 在 session 结束前，逐条确认 Step 1-8 全部完成。**未完成的步骤必须当场补做或显式标注为"跳过 + 原因"**。确认清单：
   - [ ] Step 1 Grill 完成（有 spec 或对话记录佐证）
   - [ ] Step 2 Spec 完成（有 spec 文件，含 Scenario Matrix）
   - [ ] Step 3 Tickets 完成（有 ticket 拆分）
   - [ ] Step 4 TDD 完成（测试 red → green → refactor）
   - [ ] Step 5 Code Review 完成（有审查报告）
   - [ ] Step 6 Runtime Verify 完成（有运行时验证证据：截图 / DOM 检查 / E2E 结果）
   - [ ] Step 7 Commit 完成（有 commit hash）
   - [ ] Step 8 文档及 Issue 更新完成（Linear 状态已更新）
   - 如有任何步骤跳过，必须在向用户汇报时**显式列出**跳过的步骤和原因，不得遗漏

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

**前端浏览器验证**：涉及 UI 交互/布局/样式的改动，CI gate 后需在浏览器中确认。优先用 `webapp-testing` skill（自动打开 dev server + Playwright 验证）；需手动探索交互时用 `playwright-interactive`。

## Commit Cadence (并行 agent 安全)
**TL;DR**: 每完成一个原子任务立即 commit;同任务的后续修复 amend 原 commit;`stage` 时显式列路径(绝不 `git add -A` / `.`);不还原他人未提交改动;push 改写用 `--force-with-lease`。详见 `docs/conventions/commit-cadence.md`。

## 最佳实践
详见 `docs/conventions/design-principles.md`；架构守卫测试 `src/test/architecture-guard.test.ts` 自动拦截。

## PR / Merge Guardrails
- Commits: 简洁的 conventional 格式;不在 message 里放 URL。
- 不要 "cosmetically resolve" review thread,要么真修要么留待 maintainer 拍板。

## Cross-Branch Workflow（禁止本地切分支）
**核心规则**：永远不要在当前工作目录执行 `git checkout`/`git switch` 切换分支。所有跨分支操作通过 worktree 或 GitHub API 完成。场景和命令详见 `docs/workflows/cross-branch-workflow.md`。

## 标准上线流程 (Production Deployment Checklist)

**每次合并到 main 都必须走完以下流程，不得跳步。**

- 分支映射：后端 `railway`（Staging）→ `main`（Production）；前端 `lovable` → `dev` → `main`
- Phase 1-5（后端 staging → 前端 staging sync → 前端 production → 后端 production → 切 production API）+ 无 API 变更简化流程 + Agent 行为约束 + Spec 自动化管道详见 `docs/workflows/frontend-backend-coordinated-deployment.md`。
- **Agent 行为约束**：dev → main PR 只创建不合并，等用户明确说"合并"后才提示用户在 GitHub UI 操作。已在 AAV-556/562 两次违规合并，用户明确警告。

## High-Risk Areas (Coordinate Carefully)
- Simulation + reserves table: `src/components/dashboard/ReservesTable*`, `DesktopReserveRow*`, `MobileReserve*`, `src/hooks/useRateSimulation.ts`, `src/hooks/reserves-table/` (8 个聚合 hook: useReservesTableSort / useReservesPagination / useReserveExpansion / useSharedScenarioInputs / useScenarioPinScroll / useReservesTooltip / usePortfolioToggle / useReservesLayoutRefs;每个都有 co-located 单测).
- Batch panel / portfolio: `src/components/dashboard/PortfolioPanel.tsx`, `src/components/dashboard/PortfolioTokenRow.tsx`.
  - **Supply-Borrow 不可分**: 添加/移除 token 必须同时操作 supply+borrow 两个 side（见 `docs/conventions/design-principles.md` §7）。`PortfolioReserveEntry` 从类型层面保证不可分；`addReserve` 总是创建 supply+borrow 两侧。
- Forecast/incentives: `src/lib/meritForecast.ts`, `src/lib/merklForecast.ts`, `src/lib/brevisForecast.ts`.
- Sorting/formatting contracts: `src/lib/sorters.ts`, `src/lib/formatters.ts`, `src/lib/apiSchemas*.ts`.

## main Branch Protection (5 层防御)
main 是生产分支，直接面向用户。5 层机制性保护（Bot PR 不 auto-merge + Branch Protection/CODEOWNERS + Content Security CI + Commit Signature + Branch Flow Guard）确保恶意代码无法自动合并。遇到 branch protection 阻塞时报告给用户决定，详见 `docs/conventions/branch-protection.md`。

## Golden Rules: Rate Simulation Calculator
`rateSimulationCalculator.ts` 的不变量（4 条 Golden Rules：current 不变量 / aggregate 单一路径 / wallet fallback = identity / headline 纯市场 rate）见 `docs/rate-calculation.md` Part 8。修改 calculator 前必须先读这些规则。

## Learned Preferences
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

## Learned Lessons (Index)
详细 lessons 已外迁到以下文件，按需查阅：
- `docs/lessons/rate-simulation.md` — Rate Simulation Calculator/incentive 计算相关（AAV-739/745/761/771/978/980/1059/1060/1075/1086/1097 等）
- `docs/lessons/portfolio-ui.md` — Portfolio 模式/表格布局/UI 组件相关（Delta Input/Option E/Unified Table/列宽/边框等）
- `docs/lessons/infrastructure.md` — CI/CD、构建 chunk 策略、外部 API 集成相关（chainDiscovery 404/AAV-1034/rolldown manualChunks 拼接等）
- `docs/conventions/scripts-and-schema-lessons.md` — Scripts/token icons/共享 schema 相关

## Agent skills

### Issue tracker

Issues tracked in Linear (team: Aaveapy). See `docs/agents/issue-tracker.md`.

### Triage labels

Using default triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (one CONTEXT.md + docs/adr/ at root). See `docs/agents/domain.md`.

## On-Demand References
- 交互守卫与边界定义：`docs/design/frontend-interaction-guardrails.md`（UI 交互改动时查阅）
- PR 分析方法与审核框架：`docs/PR_ANALYSIS.md`（审查 PR / 分析变更范围时查阅）
- Merge 后总结模板：`docs/conventions/merge-summary.md`（合并后写总结时查阅）
