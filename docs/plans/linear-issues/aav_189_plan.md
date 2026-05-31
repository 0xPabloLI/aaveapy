# 开发方案 - AAV-189 增加 Hub 相关数据展示（supply cap、total supplied 等）

## 1. Issue 概述
在前端界面中增加对 Aave V4 Hub 相关数据的展示，主要包括 Hub 的 supply cap、total supplied 等关键指标。Hub 是 V4 设计中的合并 Reserve 结构，需要在合适的页面或组件中新增这些数据字段的展示，方便用户了解 Hub 层面的整体流动性和限制情况。

## 2. 当前状态
- 状态：未开始（Backlog）
- 目前后端已有 Hub/Spoke 相关字段在 `/api/markets` 接口返回中。**消费现状（2026-05 更新）**：
  - `hubId`、`hubName`、`hubAddress`：已消费（Hub 过滤、badge 显示、浏览器链接）
  - `spokeId`、`spokeAddress`：已消费（V4 市场深链接、浏览器链接）
  - `spokeName`：已移除（语义与 `marketName` 冗余）
- 但尚无 supply cap、total supplied 等 Hub 级别的汇总数据。
- 前端已有 Hub badge 展示（DesktopReserveRow、MobileReserveCard）和 Hub 过滤功能，但尚无独立 Hub 汇总视图。

## 3. 影响范围
- 后端仓库：`aave-protocol-analysis`（railway 分支）
- 前端仓库：`aaveapy`（lovable 分支）

## 4. 实现方案

### 4.1 后端实现

#### 4.1.1 数据聚合与接口扩展
- **修改文件**：
  - `src/index.ts`（根数据聚合逻辑）
  - `backend/src/services/marketsService.ts`（市场数据服务）
  - `backend/src/services/marketsApiSerialize.ts`（API序列化）
  - 可能新增或修改数据库迁移脚本（如果需要持久化 Hub 级数据）

- **关键逻辑**：
  - 在数据聚合阶段，基于已有的 Reserve 级数据，计算 Hub 级别的汇总指标：
    - Hub supply cap = 各 Spoke reserve supply cap 之和（或 Hub 层面单独字段，视链上数据结构而定）
    - Hub total supplied = 各 Spoke reserve total supplied 之和
  - 将 Hub 级数据结构合并到 `/api/markets` 返回的每个 Reserve 对象中，或单独新增一个 Hub 级数据字段集合，方便前端消费。
  - 确保数据更新调度（cron）逻辑包含 Hub 数据刷新。

#### 4.1.2 数据持久化（可选）
- 如果需要历史数据或持久化，设计并新增数据库表或字段存储 Hub 级别的汇总数据。
- 编写对应的 migration 脚本。

### 4.2 前端实现

#### 4.2.1 数据获取与类型定义
- **修改文件**：
  - `src/types/aave.ts` - 新增 Hub 相关字段类型定义
  - `src/hooks/useAaveMarkets.ts` - 确保请求接口包含 Hub 数据字段

#### 4.2.2 组件开发与展示
- **修改文件**：
  - `src/components/dashboard/ReservesTable/` - 视具体设计决定是否在 ReservesTable 中增加 Hub 相关列
  - 或新增专门的 Hub 数据展示组件（如 `HubSummary.tsx`）
  - 可能修改 `src/components/dashboard/Header.tsx` 或 `TopOpportunities.tsx` 等页面入口组件，增加 Hub 数据入口

- **关键逻辑**：
  - 设计并实现 Hub 相关数据的展示 UI，包含 supply cap、total supplied 等关键指标
  - 支持 Hub 维度的筛选或汇总视图（如 Hub 作为一级分类）
  - 保持与现有 Reserve 视图的统一风格，使用 TailwindCSS 样式

#### 4.2.3 交互与体验
- 支持 Hub 相关数据的排序、搜索（如按 Hub 名称搜索）
- 兼容移动端布局

## 5. 依赖关系
- 依赖后端完成 Hub 级数据的聚合与接口支持
- 可能依赖链上数据结构确认 Hub supply cap 及 total supplied 的计算方式
- 相关 Issue：AAV-93（V3/V4统一显示）可能有交叉，注意数据结构统一

## 6. 验收标准
- 后端 `/api/markets` 接口返回中包含 Hub 级别的 supply cap、total supplied 等字段
- 前端页面中至少有一个明显位置展示 Hub 相关数据，且数据准确
- 支持 Hub 相关数据的排序和搜索
- 代码通过单元测试和集成测试，接口文档更新（OpenAPI）
- 部署后在 staging 环境验证数据正确性和 UI 展示效果

## 7. 复杂度评估
- 复杂度：Medium
- 理由：涉及后端数据聚合逻辑扩展和前端 UI 新增，需保证数据准确且界面友好。后端需理解 V4 Hub/Spoke 设计，前端需设计合理展示方案。无特别复杂算法，但需跨层协作。

---

以上为 AAV-189 的详细开发方案，建议先由后端完成数据聚合和接口扩展，再由前端完成数据展示与交互。