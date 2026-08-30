# Handoff: E2E Suite Boundary Cleanup (2026-08-30)

状态：边界清理已完整收尾。4 个 spec 的删除已在 `7c48ae01` 完成；本 continuation 又清除了其遗留的 2 个孤儿快照目录（14 PNG）并提交于 `e328ff7d`。Live-dependent 测试（§3b）与预存在失败（§3c）为独立决策 / out-of-scope，未在本 handoff 处理。本文件封存根因、已验证结论、决策点与最终状态。

**2026-08-30 续 #2 更新**：§3c 已在后续 session 解决（根因 = 过期 app-ready 信号 + 本地并行负载下 skeleton stall，非预想中的应用缺陷），修复提交于 `4bc5059d`；最终全量 **101 passed / 9 failed / 75 skipped**，剩余失败全部为 §3b live-dependent 钱包家族（决策维持：不做 SDK mock）。详见 §7。

## 1. 已验证完成（committed）

- Commit `7c48ae01` — `refactor(e2e): tighten suite boundaries and make watch flow deterministic`
  - 删除 4 个 spec（彻底删除，非留存根）：`explorer-links-live-dom`、`explorer-links-smoke`、`portfolio-panel-header-visual`、`segmented-toggle-visual`（后者 rename 为 `segmented-toggle.spec.ts`）
  - 新增确定性 functional spec：`portfolio-panel-header.spec.ts`、`segmented-toggle.spec.ts`
  - 改写使其确定性化的 spec：`wallet-reconnect-after-refresh`、`watch-resubmit-refresh`、`portfolio-wallet-sync-precision`、`staging-smoke`、`top-opportunities-mobile-layout`
  - 新增单测 `src/lib/poolExplorerLinks.test.ts`（支撑 explorer-links 逻辑去 live 化）
  - 文档：`docs/conventions/e2e-testing-boundary.md`、`docs/specs/e2e-suite-boundary-cleanup.md`、`docs/DOCS-INDEX.md`
- Commit `e328ff7d` — `refactor(e2e): remove orphan snapshot dirs from deleted visual specs`
  - 删除 2 个孤儿快照目录（14 PNG）：`e2e/portfolio-panel-header-visual.spec.ts-snapshots/`（8）、`e2e/segmented-toggle-visual.spec.ts-snapshots/`（6，含 5 个 stray 本地改动）
  - 删除前已 `grep` 验证无任何现存 spec 引用这两个目录（零命中），删除安全
- 验证门禁全绿（pre-commit hook 已跑）：`npm run lint && npm test` ✅（3520 passed / 14 skipped / 6 todo；lint 0 error、1 既存 warning）

## 2. 历史修正（本 continuation 发现）

初版 handoff 草稿（本文件上一版）误记决策点 A 为「已 `git rm` 暂存但未 commit」。真实状态经复核为：

- 4 个 spec 的删除**早已随 `7c48ae01` 提交**（原草稿中的 `2ea9cb6f` 已被 amend 改写为 `7c48ae01`）。
- 上一版草稿描述的「staged `D` + 孤儿快照目录残留」是中间态快照，与当前工作树不符。
- 本 continuation 据此把真正残留的孤儿快照目录删除并提交，达成闭环。

## 3. Live-dependent 测试分析（独立决策，不在本 spec 范围）

全量跑结果约 **95 passed / ~13 failed / 77 skipped**。失败分两类：

### 3a. 我引入/改写的 spec（已处理）
- `portfolio-panel-header.spec.ts`：初版断言 `Borrow amount` 文本框 + viewport 维度算错 → 已修，两个 project 重跑变绿。

### 3b. Live-dependent（需真实钱包连接态 + watch SDK 流程 + 网络，CI 默认 skip，本地/手动 sanity）
根因：纯 `page.route` 无法模拟 RainbowKit 连接态与 watch SDK 流程；`WalletButton` 的 `View address` / 移动端 `Wallet actions` 仅在 watch 功能启用 + 真实钱包时渲染。
涉及 spec（确切失败用例请用 §4 命令枚举）：
- `wallet-reconnect-after-refresh.spec.ts`
- `watch-resubmit-refresh.spec.ts`
- `portfolio-wallet-sync-precision.spec.ts`
- 其余 watch/wallet 家族用例

**推荐**：保持 CI-skipped / 本地手动 sanity，**不做**深 SDK mock 基础设施。理由：本就 CI-skip、设计上依赖真实钱包；投入 SDK mock 成本高、ROI 低、易脆。若未来要求确定性，应单独开 spec + ticket（非本 handoff 范围）。

### 3c. 预存在失败（已在 2026-08-30 续 #2 解决）
- `portfolio-decimal-input` ×3
- `portfolio-incentive-calculation` ×1

**~~推荐：留给原 owner / 单独 ticket 修复~~ 已解决（`4bc5059d`）**：根因不是应用缺陷——共享 helper 等待的 "Borrow amount" 输入框是 layout/状态依赖元素，在并行负载下不稳定；同时冷启动 + 过多 worker 造成模块请求拥塞（见 §7）。统一改用 `portfolio-mode-toggle` testid 作为 app-ready 信号 + globalSetup 预热 + worker 上限后，这些用例稳定通过。

## 4. 重新枚举当前失败用例（验证 handoff 用）

受「安全删除」守卫影响，用临时输出目录避开 `test-results` 清理弹窗：
```bash
cd /Users/pabloli/Documents/code/aaveapy
npx playwright test --reporter=line --output=/tmp/pw-out 2>&1 | grep -E "failed|passed|flaky" | tail -40
```

## 5. 交接检查清单（next session / 用户）

- [x] 决策点 A：删除 4 spec（已在 `7c48ae01`）+ 孤儿快照目录（已在 `e328ff7d` 删除并提交）
- [x] `git status` 干净（无 `D` / ` M` 残留，无孤儿 `*-snapshots` 目录；仅本 handoff 文档未跟踪）
- [ ] 若坚持让 9 个 live-dependent 测试确定性化：单独开 spec + ticket，建 SDK mock 基础设施（决策维持：不做；当前本地失败仅影响手动跑，CI 本就 skip）
- [x] ~~预存在失败（§3c）另开 ticket~~ 已在 2026-08-30 续 #2 解决（`4bc5059d`，见 §7）
- [x] 收尾后在 `docs/DOCS-INDEX.md` 登记本 handoff 文档路径
- [x] 按 commit cadence 显式 `git add` 路径、不 `git add -A`（孤儿删除用 `git rm` 目录级路径；本文件单独 commit）
- [x] ready 信号约定写入 `docs/conventions/e2e-testing-boundary.md`（Deterministic waiting 章节），后续新 spec 照此写

## 6. 最终状态（2026-08-30 续）

- 分支：`lovable`，领先 `origin/lovable` 共 **2 commit**：`7c48ae01`（边界清理）+ `e328ff7d`（孤儿快照清理）。
- **未 push**（push 需用户显式请求）。
- Live-dependent（§3b）与预存在失败（§3c）保持原状，留给独立 ticket。

**2026-08-30 续 #2 覆盖**：新增 `4bc5059d`（e2e 确定性修复）+ 本文件/约定文档更新；已按用户指令同步 `origin/lovable`。§3c 不再遗留。

## 7. 2026-08-30 续 #2：本地并行负载失败根因与修复（`4bc5059d`）

续 #1 后全量复跑出现 17 failed（91/17/77）。逐一取证（失败 trace 解包 + 对照实验），两类根因：

### 7a. 过期 app-ready 信号（修 4 处）
共享 helper 与部分 spec 在 `goto('/')` 后等待 "Borrow amount" 输入框——该元素属 ScenarioControls，出现时机随 layout/模式/状态变化，并行负载下频繁超时。统一改为等待 `portfolio-mode-toggle` testid（两种模式都在 `/markets` 数据落地后渲染，已验证为可靠信号）：`test-reserves.ts`（setupPortfolioWithReserve / setupPortfolioMode）、`portfolio-toggle-alignment`、`top-opportunities-mobile-layout`（另补两处：10s 默认 expect 超时下的 ready 等待；badge 用例的 count===0 skip 先于数据加载会假性跳过）。

### 7b. 冷启动拥塞（证据驱动，非猜测）
失败 trace 显示 `/markets` 约 1-3s 返回 200、数据完整，但 `src/` 模块与 `.vite/deps` chunk 挂起 8-40s、部分直到测试超时仍未完成——页面卡死在 skeleton。根因：`dev:staging` 每次清 Vite 缓存全冷启动，叠加本地默认 ~8-10 worker（每浏览器编译/执行重量级 DeFi 应用）→ CPU 拥塞。对照实验：单跑 8.7s 通过；`--workers=10` 17/24 失败（4.8min）；`--workers=4` 24/24 通过（55s）。修复：`e2e/global-setup.ts` 预热（worker 启动前串行访问桌面+移动两种布局各一次，暖化转换缓存）+ 本地 `workers: 4`（CI 维持 2）。

### 7c. 定态断言竞态（1 处）
`fdv-continuous-input` 的 focus select-all 断言：select-all 与 click 的 caret 定位竞态，固定 100ms 后单次读取会抓到中间态（观察到一次 selectionStart=1）。改 `expect.poll` 轮询，语义不变、消除时序敏感。

### 7d. 验证轨迹（本地全量，同一环境）
| 阶段 | passed | failed | skipped |
|---|---|---|---|
| 修复前 | 91 | 17 | 77 |
| 7a+7b 后 | 98 | 10 | 77 |
| 7c 后（终态） | **101** | **9** | 75 |

终态 9 个失败 = §3b live-dependent 钱包家族（`wallet-reconnect-after-refresh` ×4、`watch-resubmit-refresh` ×2、`portfolio-wallet-sync-precision` ×2，其一在个别跑次偶现通过），需真实钱包连接态，按 §3b 决策保留。75 skipped 含 CI-skip 项与 staging 数据条件 skip（如 `$INK` FDV 输入不存在时整个 `fdv-continuous-input` 优雅跳过）。
