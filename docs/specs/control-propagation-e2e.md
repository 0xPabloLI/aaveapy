# Spec: 全局控件 → 展示面传播契约（e2e）

> Status: ready-for-agent · Created: 2026-11-18 · 无 issue 票（USD/Token 事故的通用防线）
> 事故根因与修复见 `docs/specs/aav-1321-scenario-input-modes-e2e.md` 的 2026-11-18 补充节。

## Problem

AAV-745/AAV-746 的 USD/Token 缺陷证明：只测「控件自己的状态」不够。控件选中态、指示器、placeholder 都可能正确，但父级展示面拿到的是旧模式，用户看到的是「单位反了」。这类缺陷的共性是：

- 控件是全局模式切换（一个控件驱动整张表/整组卡片）；
- 展示面跨组件消费该模式；
- 单测 mock 只验回调参数，e2e 只在输入后验结果，**最短路径「只切换、不输入」没有守卫**。

## Solution

新增 `e2e/control-propagation.{desktop,mobile}.spec.ts` 与共享 helper，覆盖另外两组全局 `SegmentedToggle`：

1. **APR/APY**：切换后表格行/卡片利率数值必须立即变化；切回后逐字节恢复。
2. **Chain/Hub**：切换后 `[data-testid="markets-row"]` 芯片行必须立即换组；切回后逐字节恢复。无 hub 数据时干净 skip + annotation。

断言只比较相对变化，不写死 staging 数值；每个用例结束再跑 `illegalNumbers` 不变量。

USD/Token 的最短路径由 `aav-1321` 的 M6b/M11c 拥有，本 spec 不重复。

## Scenario & Risk Verification Matrix

| # | 平台 | 场景 | 输入/动作 | 期望（断言） | 证据形式 |
| --- | --- | --- | --- | --- | --- |
| CP1 | 桌面 | APR/APY 传播 | 点当前未选中的 APR 或 APY | 前 8 行表格文本变化；点回原模式后逐字节恢复 | e2e 断言 |
| CP2 | 桌面 | Chain/Hub 传播 | 有 hub 时点 Hub 或 Chain | `markets-row` 文本变化；点回后逐字节恢复；无 hub 则 skip + annotation | e2e 断言（条件式） |
| CP3 | 移动 | APR/APY 传播 | 点当前未选中的 APR 或 APY | 前 4 张卡片文本变化；点回后逐字节恢复 | e2e 断言 |
| CP4 | 移动 | Chain/Hub 传播 | 有 hub 时点 Hub 或 Chain | `markets-row` 文本变化；点回后逐字节恢复；无 hub 则 skip + annotation | e2e 断言（条件式） |
| CP5 | 双平台 | 切换过程无非法数值 | 上述所有切换 | 全页无 `NaN`/`undefined`/`Infinity` | e2e 断言 |

## Non-goals / 残留

- Portfolio 的 `$`/`T` 是**每个 entry 内**的单源状态，不是全局 toggle；已有 `portfolio-*` e2e 与单测覆盖，本 spec 不引入复杂的建仓前置。
- 排序、筛选、净借贷开关不属于「模式切换」，分别由既有 `reserves-table-*` / `scenario-input-modes` 用例覆盖。
- 本 spec 不做截图 diff：文本断言更便宜、更稳定，且能精确断言「恢复原状」。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `e2e/control-propagation.{desktop,mobile}.spec.ts` | 新增 4 条传播契约用例 | Low | 纯新增测试，不触碰产品代码 |
| `e2e/control-propagation.helpers.ts` | 新增控件定位器与展示面快照探针 | Low | 复用 `scenario-input-modes.helpers` 的 `openApp`/`illegalNumbers`，不复制选择器 |
| `docs/specs/control-propagation-e2e.md` | 新增本 spec 与 5 行矩阵 | Low | 文档 |
| `docs/DOCS-INDEX.md` | 登记本 spec | Low | 文档索引 |

## 验收

- `npx playwright test e2e/control-propagation` 双平台实跑非 skip（无 hub 数据除外）；
- 矩阵 CP1–CP5 每行有对应断言；
- `npm run typecheck`、`npm run lint`、`npm run ci:remote` 全绿。
