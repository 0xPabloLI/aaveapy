# 开发方案：AAV-173 SimulationSubRow 链接筛选逻辑提取与冗余清理

## 1. Issue 概述
`SimulationSubRow.tsx` 中 `getFirstMeritLink`、`getFirstMerklLink` 为内联实现，与 `src/lib/brevis.ts` 中 `getFirstActiveBrevisLink` 模式重复但未提取到公共库。需统一链接筛选逻辑到公共库，删除冗余内联/薄封装函数，提升代码维护性。

## 2. 当前状态
- **内联重复**：`getFirstMeritLink`（第 36-47 行）和 `getFirstMerklLink`（第 49-63 行）在 `SimulationSubRow.tsx` 内部独立实现，无公共库对应。
- **薄封装冗余**：`getFirstBrevisLink`（第 65-67 行）仅委托 `getFirstActiveBrevisLink`，可直接调用。
- **row.href 是活跃功能**：`row.href` 在 3 处渲染函数中使用（renderRow 第 538 行、renderCompactGridRow 第 733 行、renderEarnCostTable 第 1293 行），将 label 渲染为带 ExternalLink 图标的超链接，**不是死数据**。
- **IncentiveTooltip 与 SubRow 互补**：Tooltip 在弹窗中用圆形按钮显示激励链接（不筛选活动状态），SubRow 在行内用文本链接显示第一个活动链接（筛选活动状态），两者渲染位置、交互方式、信息量不同，**不构成重复**。
- **状态**：✅ 已完成（2026-06-05）

## 3. 影响范围
- 前端仓库：`aaveapy`，`lovable` 分支
- 主要涉及文件：
  - `src/components/dashboard/SimulationSubRow.tsx`（删除内联函数，改为调用公共库）
  - 新增：`src/lib/merit.ts`（`getFirstActiveMeritLink`）
  - 新增：`src/lib/merkl.ts`（`getFirstActiveMerklLink`）
- 不涉及的文件（与原方案不同）：
  - ~~`src/lib/simulationIncentiveTableRows.ts`~~（不动 href 生成逻辑）
  - ~~`src/components/dashboard/IncentiveTooltip.tsx`~~（其链接逻辑不筛选活动状态，与提取函数语义不同）

## 4. 实现方案

### 方案选择：提取公共函数 + 删除冗余封装

原方案 A 声称 `row.href` 是死数据，经代码验证该声明不成立（有 3 处渲染）。改为此方案：仅提取链接筛选逻辑到公共库，不动 `row.href` 及其渲染。

### 具体步骤

#### 4.1 新建 `src/lib/merit.ts`
- 导出 `getFirstActiveMeritLink(merits?: MeritIncentive[], nowMs = Date.now()): string | null`
- 逻辑从 `SimulationSubRow.tsx` 第 36-47 行搬迁，无语义变更
- 与 `brevis.ts` 的 `getFirstActiveBrevisLink` 模式对齐：第二个参数 `nowMs` 可注入便于测试

#### 4.2 新建 `src/lib/merkl.ts`
- 导出 `getFirstActiveMerklLink(opportunities?: MerklOpportunityGroup[], nowMs = Date.now()): string | null`
- 逻辑从 `SimulationSubRow.tsx` 第 49-63 行搬迁，无语义变更
- 语义：只筛选活动 campaign 的链接，与 `IncentiveTooltip` 的 `RecentlyEndedSection`（过期逻辑）互不干扰

#### 4.3 修改 `SimulationSubRow.tsx`
- 删除内联 `getFirstMeritLink`（第 36-47 行）
- 删除内联 `getFirstMerklLink`（第 49-63 行）
- 删除薄封装 `getFirstBrevisLink`（第 65-67 行）
- 新增 import：`getFirstActiveMeritLink` from `@/lib/merit`，`getFirstActiveMerklLink` from `@/lib/merkl`，`getFirstActiveBrevisLink` from `@/lib/brevis`（已有 import）
- 替换调用点（第 282-288 行）：
  - `getFirstMeritLink(...)` → `getFirstActiveMeritLink(...)`
  - `getFirstMerklLink(...)` → `getFirstActiveMerklLink(...)`
  - `getFirstBrevisLink(...)` → `getFirstActiveBrevisLink(...)`

#### 4.4 不动 `row.href`
- `row.href` 的生成逻辑（`simulationIncentiveTableRows.ts` 和 `SimulationSubRow.tsx` 的 supplyRows/borrowRows 构建）保持不变
- 3 处渲染逻辑保持不变

## 5. 依赖关系
- 无直接依赖其他 Issue，但建议同步关注：
  - AAV-144（V3/V4 incentive matching），可能影响激励数据结构。
  - 代码重构相关 Issue（如 AAV-113 src/lib refactor），避免冲突。

## 6. 验收标准
- `src/lib/merit.ts` 存在且导出 `getFirstActiveMeritLink`，签名与 `getFirstActiveBrevisLink` 模式对齐。
- `src/lib/merkl.ts` 存在且导出 `getFirstActiveMerklLink`，签名与 `getFirstActiveBrevisLink` 模式对齐。
- `SimulationSubRow.tsx` 不再包含 `getFirstMeritLink`、`getFirstMerklLink`、`getFirstBrevisLink` 的定义。
- `SimulationSubRow.tsx` 中第 282-288 行调用改为公共库函数。
- `row.href` 生成和渲染逻辑未被修改。
- 行内链接跳转功能正常（renderRow / renderCompactGridRow / renderEarnCostTable 三处）。
- IncentiveTooltip 中激励链接和 RecentlyEndedSection 折叠区域功能正常。
- 通过现有单元测试和集成测试，无功能回归。
- 为新公共函数补充单元测试（参考 `recentlyEndedCampaigns.test.ts` 模式）。

## 7. 复杂度评估
- **复杂度**：Low-Medium
- **理由**：
  - 逻辑搬迁为主，无语义变更。
  - 需新增 2 个公共库文件和对应测试。
  - 不动渲染逻辑，回归风险低。

---

# 附录

## 相关文件路径
- `src/components/dashboard/SimulationSubRow.tsx`
- 新增 `src/lib/merit.ts`
- 新增 `src/lib/merkl.ts`
- 参考对齐 `src/lib/brevis.ts`

## Grill 修正记录

| 原方案声明 | 实际情况 | 修正 |
|-----------|---------|------|
| `row.href` 是死数据 | 有 3 处渲染（第 538、733、1293 行），将 label 渲染为超链接 | 不删除 href |
| IncentiveTooltip 与 SubRow 链接重复 | 互补而非重复：Tooltip 不筛选活动状态且用圆形按钮，SubRow 筛选活动状态且用行内文本链接 | 不视为重复 |
## 8. 实施记录

- **AAV-558** ✅ `src/lib/merit.ts` + `src/lib/merit.test.ts`（13 tests）— `getFirstActiveMeritLink` 使用 `isCampaignActive(allowOpenEnd=false)`
- **AAV-559** ✅ `src/lib/merkl.ts` + `src/lib/merkl.test.ts`（11 tests）— `getFirstActiveMerklLink` 使用 `isCampaignActive(allowOpenEnd=true)`
- **AAV-560** ✅ SimulationSubRow.tsx：删除 3 个内联函数（34 行），改为 import 公共库调用；`row.href` 未动
- 验证 gate：lint ✅ | test ✅ (2361 passed) | tsc ✅ | build ✅