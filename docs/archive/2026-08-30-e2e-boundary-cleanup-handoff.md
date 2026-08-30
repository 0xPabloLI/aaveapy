# Handoff: E2E Suite Boundary Cleanup (2026-08-30)

状态：边界清理已完整收尾。4 个 spec 的删除已在 `7c48ae01` 完成；本 continuation 又清除了其遗留的 2 个孤儿快照目录（14 PNG）并提交于 `e328ff7d`。Live-dependent 测试（§3b）与预存在失败（§3c）为独立决策 / out-of-scope，未在本 handoff 处理。本文件封存根因、已验证结论、决策点与最终状态。

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

### 3c. 预存在失败（out-of-scope，本 session 未触碰，按 Session Boundary 不动）
- `portfolio-decimal-input` ×3
- `portfolio-incentive-calculation` ×1

**推荐**：留给原 owner / 单独 ticket 修复，不在本边界清理范围。

## 4. 重新枚举当前失败用例（验证 handoff 用）

受「安全删除」守卫影响，用临时输出目录避开 `test-results` 清理弹窗：
```bash
cd /Users/pabloli/Documents/code/aaveapy
npx playwright test --reporter=line --output=/tmp/pw-out 2>&1 | grep -E "failed|passed|flaky" | tail -40
```

## 5. 交接检查清单（next session / 用户）

- [x] 决策点 A：删除 4 spec（已在 `7c48ae01`）+ 孤儿快照目录（已在 `e328ff7d` 删除并提交）
- [x] `git status` 干净（无 `D` / ` M` 残留，无孤儿 `*-snapshots` 目录；仅本 handoff 文档未跟踪）
- [ ] 若坚持让 9 个 live-dependent 测试确定性化：单独开 spec + ticket，建 SDK mock 基础设施（非本 handoff 范围）
- [ ] 预存在失败（§3c）另开 ticket，不在本范围
- [x] 收尾后在 `docs/DOCS-INDEX.md` 登记本 handoff 文档路径
- [x] 按 commit cadence 显式 `git add` 路径、不 `git add -A`（孤儿删除用 `git rm` 目录级路径；本文件单独 commit）

## 6. 最终状态（2026-08-30 续）

- 分支：`lovable`，领先 `origin/lovable` 共 **2 commit**：`7c48ae01`（边界清理）+ `e328ff7d`（孤儿快照清理）。
- **未 push**（push 需用户显式请求）。
- Live-dependent（§3b）与预存在失败（§3c）保持原状，留给独立 ticket。
