# AAV-1393 — 钱包降级提示暴露内部标签，fallback 成功仍误报

> Status: implemented 2026-11-16（commit `efcd50b3`）· Issue: [AAV-1393](https://linear.app/aaveapy/issue/AAV-1393) · Type: UI 文案/语义修正（AAV-1315 后续）

## 背景与根因

AAV-1315 的琥珀提示把 `failedSources` 原样展示：

```
Incomplete sync — 2 sources unavailable
title: Unavailable sources: sdk-v3-fallback, onchain-v3-chain-42220
```

两个独立缺陷：

1. **术语泄漏**：标签是排查标识（`sdk-*` / `onchain-*` / `gap-*` / `spoke-*`），不是用户概念；`source` 计数同样是内部口径。
2. **误报**：`sdk-v3-fallback` / `sdk-v4-fallback` 只表示「SDK 这一层不可用，改用链上读」（`useUserPositionsSdk.ts:399-400` 无条件加入）。链上读全成功、数据完整时，失败集仍非空 ⇒ 提示仍说 `Incomplete sync`。

票面 AAV-1315 原文要求「`title` 属性列出具体失败源（如 `onchain-v3-chain-42220`）」，所以这是需求层问题，不是实现跑偏。

## 设计

1. **提示只承担结论**：固定文案 `Wallet data incomplete`；去掉计数与 `title`；保留 `role="status"`、`AlertTriangle`、`ds-text-amber-600`、`data-testid`。
2. **过滤 fallback-only 标签**：新增纯函数 `hasMissingWalletData(failedSources)`（`src/lib/userData/walletSyncNotice.ts`）：
   - 集合里只有 `sdk-v3-fallback` / `sdk-v4-fallback` ⇒ `false`（数据由 fallback 补齐）；
   - 出现任何其它标签（`onchain-*` / `gap-*` / 未来未知标签）⇒ `true`（fail open：宁提示不欺骗）；
   - 空集合 ⇒ `false`。
3. **原始标签留给排查**：`data-failed-sources="<逗号分隔原始标签>"` + 提示出现时一次 `console.info('[wallet-sync] incomplete sources:', …)`。
4. 不改数据层：`failedSources` 的构造、`DegradedResult`、`walletLoadState` 判定、error / empty / loading / idle 文案全部不动。

**为什么不显示链名**：标签是字符串，映射链名需要先把失败源结构化（改 `fallbackPositions` / `gapFallbackQuery` 的返回形态），属另一张票（本票 Out of scope）。

## 接口契约

- `hasMissingWalletData(failedSources: readonly string[]): boolean` — 纯函数，无副作用。
- `PortfolioPanelProps.failedSources?: string[]` 语义不变（原始标签）。
- 渲染条件：`walletLoadState === 'success' && hasMissingWalletData(failedSources)`。
- 提示 DOM：
  - 文本：`Wallet data incomplete`（固定）；
  - `role="status"`；`data-testid="wallet-partial-notice"`；`data-failed-sources` = 原始标签 join(',')；
  - 无 `title`。

## Modified Files Impact

| 文件 | 修改内容 | 风险 | 评估 |
| --- | --- | --- | --- |
| `src/lib/userData/failureLabels.ts`（新） | 两个 fallback 标签常量 + `FALLBACK_ONLY_LABELS`，生产者与 UI 分类共用 | Low | 标签词表单一作者 |
| `src/lib/userData/walletSyncNotice.ts`（新） | `hasMissingWalletData` 纯函数 | Low | 无副作用，单点知识 |
| `src/hooks/useUserPositionsSdk.ts` | 两处 fallback 字面量改用共享常量 | Low | 行为不变，词表不漂移 |
| `src/lib/userData/walletSyncNotice.test.ts`（新） | W1–W7 覆盖矩阵 M1–M7 | Low | 纯单测 |
| `src/components/dashboard/PortfolioPanel.tsx` | 单一 `showPartialNotice` 布尔同时驱动提示与 `console.info`；固定文案；`data-failed-sources` | Low | 提示与日志同源，不会一个出现一个不出现 |
| `src/components/dashboard/PortfolioPanel.walletSync.test.tsx` | P1 / P2 / P3 / P3b / P4–P7 重写断言（文案 / 无 title / 属性 / 日志 / 负控） | Low | 复用既有 helper |

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| M1 | 只有 `sdk-v3-fallback` | 不提示 | High | W1 + P3 | fallback-only 集合过滤 |
| M2 | 只有 `sdk-v4-fallback` | 不提示 | High | W2 | 同上 |
| M3 | `sdk-v3-fallback` + `onchain-v3-chain-10` | 提示一次 | High | W3 + P3b | 任一非 fallback 标签即提示 |
| M4 | 只有 `gap-v3-chain-42220` | 提示一次 | High | W4 | 同上 |
| M5 | 整层标签 `onchain-v3` | 提示一次 | Medium | W5 | 同上 |
| M6 | 空集合 | 不提示 | High | W6 + P1 | some() 空集为 false |
| M7 | 未知新标签 | 提示一次（fail open） | Medium | W7 | 白名单只含两个 fallback 标签 |
| M8 | 提示 DOM | 文本固定、无 `title`、`data-failed-sources` 原文、`role=status`、日志恰好一次 | High | P2（含 `console.info` 断言）+ P4/P5/P6 负控 | 组件断言 |
| M9 | 390 / 834 / 1440 | 不破版、无横向溢出、console 0 error | Medium | 运行时浏览器核对 | 复用既有状态行 |

## Runtime evidence（2026-11-16）

**组件级真浏览器渲染**（Vite dev `:8080` + Playwright，390 / 834 / 1440 三视口；临时 harness 渲染真实 `PortfolioPanel` + 真实 `index.css`，验证后删除、未提交）：

| 场景 | 390 | 834 | 1440 |
| --- | --- | --- | --- |
| `success` + `[onchain-v3-chain-42220, sdk-v4]` | 1 条；文本 `Wallet data incomplete`；`title` = null；`data-failed-sources` = `onchain-v3-chain-42220,sdk-v4`；`role=status`；box 137.875×13.75 | 同左 | 同左 |
| 状态行宽度 / 横向溢出 | 352 / 无 | 802 / 无 | 1408 / 无 |
| `console` + `pageerror` | 0 | 0 | 0 |
| `success` + `[sdk-v3-fallback]`（负控 1） | 0 条 | 0 条 | 0 条 |
| `success` + `[sdk-v3-fallback, gap-v3-chain-10]`（正控） | 1 条 | 1 条 | 1 条 |
| `success` + `[]`（负控 2） | 0 条 | 0 条 | 0 条 |
| `error` + `[sdk-v3]`（负控 3：提示不出现时日志也不出现） | 0 条且 `[wallet-sync]` 日志计数不变 | 同左 | 同左 |

**静态门**：`npm run typecheck` rc=0；全量 vitest **4414 passed / 14 skipped / 6 todo**（196 files + 3 skipped）；`npm run lint` 0 error / 74 warning（基线一致）。

**Mutation**：把 `hasMissingWalletData` 改成 `failedSources.length > 0` ⇒ W1 / W2 / P3 红、其余 15 条绿。

## Review 处置（双轴，2026-11-16）

**Standards 轴**：

| Finding | 处置 |
| --- | --- |
| 两个 fallback 字面量在 hook 与 helper 各写一次（词表双作者，未来 `sdk-v5-fallback` 会静默误报） | **真修**：新增 `src/lib/userData/failureLabels.ts`，生产者与 UI 分类共用同一常量/集合 |
| `console.info` 未按 `walletLoadState` 守卫（error / idle / loading 也打日志，提示却不在） | **真修**：单一 `showPartialNotice = walletLoadState === 'success' && hasMissingWalletData(...)` 同时驱动提示与日志；P2 断言日志恰好一次，P4/P5/P6 断言零次；mutation（去掉 `success` 守卫）⇒ P4/P5/P6 红 |
| 矩阵证据引用漂移（M3 写 `P4`，实际是 `P3b`；用例编号写成 `P1–P8`） | **真修**：见上文矩阵与文件表 |
| `docs/DOCS-INDEX.md` 的 AAV-1315 词条仍写「`title` 列源 + N sources 计数」 | **真修**：同批更新 AAV-1315 词条并登记本 spec |
| `useMemo` 包 `hasMissingWalletData`（默认 `[]` 每次新数组，memo 永不命中，且 `some()` 为 O(2)） | **真修**：内联 |
| Feature Envy / Primitive Obsession：分类知识住在 UI 侧、`failedSources` 用字符串带宽内语义 | **接受并记录**：结构化失败源（`{ source, recovered }`）是独立改动，本票 out of scope；作为后续候选记录 |

**Spec 轴**：

| Finding | 处置 |
| --- | --- |
| 日志无测试（格式/次数不钉） | **真修**：P2 + P4/P5/P6 断言 |
| Runtime evidence 空白 | **真修**：见上文，改后重跑三视口 |
| DOCS-INDEX / roadmap 未登记 | **真修**：docs commit 同批 |
| 用例编号与 spec 文案不一致 | **真修**：统一为 `P1 / P2 / P3 / P3b / P4–P7` |

## Tickets

- **T1**（red → green）：`hasMissingWalletData` + W1–W7。
- **T2**（red → green）：组件提示改走 helper、固定文案、诊断属性/日志；P1–P8 + M9 运行时核对。

依赖边：T1 → T2。

## Out of scope

- 显示链名（需要失败源结构化）。
- `retry` 按钮接线。
- 数据层标签语义与 `error` 态判定（观察项：SDK 失败 + fallback 成功但 0 仓位时仍落 `error`，文案为 `Wallet sync failed`）。
