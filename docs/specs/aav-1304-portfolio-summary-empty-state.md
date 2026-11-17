# AAV-1304 — PortfolioSummaryBar：supply-only 空态上下文 + Advanced 区结构/字重归一

> 状态：Delivered 2026-11-15。Grill 三决策用户拍板（空态形态 A / 归一方案 A / ltv=0 新开票）。

## Problem Statement

纯 Supply（无债务）的组合在 Portfolio 模式下，`Lowest HF` 徽章显示孤零零的 `—`：
用户无法区分「没有债务所以没有 HF」和「数据没加载」。

Advanced 展开区里三段内容的层级与字重不齐：

- Health Factor / Borrow capacity 有组标签（`ds-text-10 font-semibold uppercase tracking-wider`），Net Effective APY 只有行内小标签（11px / normal）；
- 数值字重不一致：HF 值与 NE APY 值 `font-bold`(700)，Borrow capacity 值 `font-medium`(500)——与设计系统「摘要数值强制加粗」约定相悖（DESIGN-SYSTEM-REFERENCE「tooltip / bottom sheet 最后一行摘要数值」条目）。

## Solution（用户拍板）

1. **空态**：值位保留 `—`，其后跟 muted 小号 `no debt` 说明（无 hover 依赖，桌面/移动一致）。
   仅在「组合内所有池 `totalDebtUsd === 0` 且 `hfs` 非空」时出现；**有债务但 HF 不可算（如 LT 缺失）绝不显示 no debt**（防误报），回退为纯 `—`。
2. **归一**：三段全部具备同款组标签（10px / semibold / uppercase / muted），抽为 `SECTION_HEADER_CLASS` 常量（design-principles §2：同类样式串 ≥3 次必须提取）；Net Effective APY 升级为组标签样式；**数值**统一 `font-bold`，非数值状态文案（"No borrowing capacity" / "Borrow limit reached"）保持 `font-medium`——设计系统「摘要数值强制加粗」同页明确「非数值状态描述不在此列」。方向是「往粗对齐」，不是降级到 500。
3. 空态分类逻辑抽为纯函数（`getLowestHfBadgeState`），与渲染解耦，落在既有 `portfolioCalculator` seam。

## Grill 决策记录

| 决策 | 选项 | 拍板 |
| --- | --- | --- |
| 空态形态 | A. `—` + muted `no debt` / B. 值直接换文字 / C. 隐藏徽章 / D. tooltip | **A**（保留锚点；B 布局跳动；D 违反 Mobile First-Class 无 hover 原则；C 丢锚点） |
| 归一程度 | A. 三段结构+字重都归一 / B. 只统一数值字重 / C. 全部降 500 | **A**（C 与设计系统相悖） |
| ltv=0 数据发现 | A. 新开票 / B. 本 session 查根因 / C. 只记录 | **A** → **AAV-1380**（312/441 条 `ltv=0`，生产+staging 一致；本票 UI 仅按数据渲染，无代码耦合） |

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `src/lib/portfolioCalculator.ts` | 新增 `getLowestHfBadgeState` 纯函数 + 类型 | Low | 纯追加，不改既有函数；既有 HF 函数（getMinHf 等）原样复用 |
| `src/components/dashboard/PortfolioSummaryBar.tsx` | 徽章空态分支 + NE APY 标签升级组样式（抽 `SECTION_HEADER_CLASS` 常量）+ borrow capacity 数值 500→700（状态文案保持 500） | Medium | 消费者为 PortfolioUnifiedTable 与 MobilePortfolioCard（共用组件，两端自动生效）；最坏后果是摘要条布局跳动——值位保持 `—` 不换文字、不加新行，跳动风险受控；props 契约不变 |
| `src/components/dashboard/PortfolioSummaryBar.test.tsx` | 新建组件测试（8 → 11 例） | Low | 纯新建，仿 segmented-toggle 的 happy-dom + testing-library 模式 |

## Behavioral Scenarios（场景矩阵）

| # | Scenario | Expected Behavior | Risk | Evidence |
| --- | --- | --- | --- | --- |
| E1 | supply-only（`hfs` 非空、全池 `totalDebtUsd===0`） | 徽章 `—` + `no debt` hint；`data-hf-state="no-debt"` | Low | automated test（组件测试） |
| E2 | 有债务且有有效 HF | 数字 + 语义色，无 hint；`data-hf-state="computed"` | Low | automated test |
| E3 | `hfs` 为空（无条目） | 纯 `—`，无 hint，Advanced toggle 不渲染；`data-hf-state="unknown"` | Low | automated test |
| E4 | 有债务但 HF 不可算（LT 缺失 ⇒ hf=0 被 `getMinHf` 过滤） | 纯 `—`，**无 hint**（不误报 no debt） | Medium | automated test（组件 + 纯函数各一） |
| E5 | 混合池：一池无债 + 一池有债但 HF=0 | `unknown`（不是 no-debt） | Medium | automated test（纯函数） |
| E6 | Advanced 三段标签同款 token（`SECTION_HEADER_CLASS`：ds-text-10/font-semibold/uppercase/tracking-wider/muted）；数值 `font-bold`、状态文案 `font-medium` | class 断言（三段标签逐 token + 数值/状态两分支） | Low | automated test |
| E7 | 无债务时 Advanced toggle 仍可见（NE APY / Borrow capacity 不被隐藏） | toggle 渲染 | Low | automated test |
| E8 | 桌面 1280 与移动 390 两端渲染（共用组件） | 布局正常、空态 hint 可见 | Low | runtime smoke（Playwright，2026-11-15 实测：supply-only 展开文本 `LOWEST HF — no debt / NET EFFECTIVE APY 4.19%`，390px 单行无换行；有债路径 `LOWEST HF 4.20`（emerald，data-hf-state=computed），refactor 后复验同态） |
| E9 | UI 文案为英文 | `no debt` 英文小写 | Low | static guard（既有 `no-chinese-visible` 测试套随 CI 生效） |

## Testing Decisions

- **Seam 复用**：纯函数层复用 `src/lib/portfolioCalculator.test.ts` 既有 HF describe 群；渲染层新建 `src/components/dashboard/PortfolioSummaryBar.test.tsx`，采用 `segmented-toggle.test.tsx` 同款 happy-dom + `@testing-library/react` 模式（`renderToString` 无法点击展开 Advanced，需要 `fireEvent`），断言外部可见行为：data-testid / data-hf-state / 可见文案 / class token，不断言内部 state。
- e2e 不新增：该组件无既有 e2e 断言，supply-only 场景由组件测试 + 本地 runtime smoke 覆盖（避免为 Low 票扩 e2e 维护面）。

## Out of Scope

- `ltv=0` 数据缺口（**AAV-1380**，后端）。
- Lowest HF 徽章的链上基线查询失败态（delta arrow 已有独立降级，`getLowestHfDelta` 不动）。
- Advanced 区信息架构重排（新增/删段）——只做样式与结构归一，不加内容。
- 已接受的残留不一致：NE APY 标签升为组标签样式后仍与值同行（另两段标签独占一行），属样式归一范围内可接受形态；若后续重排信息架构再统一。

## 交付记录

- 双轴 review（Standards + Spec 并行子代理）6 条实质 finding 全部真修：`SECTION_HEADER_CLASS` 提取（≥3 次重复规则）、`hasAnyValidHf` 与 `badgeState` 重复谓词收敛、误导性注释订正、E6 断言强化（三段逐 token + per-pool HF 值 + 状态文案不误加粗）、E2 补语义色断言、borrow capacity 状态文案退出 bold 规则。
- 新增测试 17 例（纯函数 6 + 组件 11），`npm test` 全量绿后提交。
