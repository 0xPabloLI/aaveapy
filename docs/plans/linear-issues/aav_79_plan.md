# 开发方案 - AAV-79 deficit的全局数据

## 1. Issue 概述
实现并展示 AaveAPY 项目中 deficit 的全局数据统计和展示功能，补充现有各市场单独的 deficit 字段，提供整体视角的 deficit 数据，方便用户了解整个协议或链的流动性缺口情况。

## 2. 当前状态
未开始。  
现有后端已支持单个市场的 deficit 字段（通过 on-chain RPC 获取），但无全局汇总或统计数据，也无前端展示相关全局数据的功能。

## 3. 影响范围
- 后端仓库：aave-protocol-analysis（railway 分支）
- 前端仓库：aaveapy（lovable 分支）

## 4. 实现方案

### 后端实现

#### 4.1 数据汇总逻辑
- **修改文件**：
  - `backend/src/services/marketsService.ts`（或相关市场数据服务）
  - `backend/src/controllers/marketsController.ts`（新增接口或扩展现有接口）
  - `backend/src/routes/marketsRoutes.ts`（新增或修改路由）
- **关键逻辑**：
  - 在市场数据聚合阶段，遍历所有市场的 deficit 字段，计算全局 deficit 总和。
  - 也可考虑按链或协议维度分组统计（如多链支持时）。
  - 将全局 deficit 数据作为额外字段附加到 `/api/markets` 或单独接口 `/api/markets/deficit-global` 返回。
- **数据流变化**：
  - 数据源仍为 on-chain RPC，汇总逻辑在后端服务层完成，前端通过 API 获取。

#### 4.2 API 设计
- 方案一：在现有 `/api/markets` 接口响应中增加 `deficitGlobal` 字段，包含全局 deficit 数值。
- 方案二：新增独立接口 `/api/markets/deficit-global`，只返回全局 deficit 统计数据。
- 推荐方案一，方便前端统一获取。

#### 4.3 持久化（可选）
- 如需历史趋势，可设计数据库表存储每日全局 deficit 快照（非本次优先实现）。

### 前端实现

#### 4.4 数据请求与状态管理
- **修改文件**：
  - `src/hooks/useAaveMarkets.ts`（扩展接口数据类型，支持全局 deficit 字段）
  - `src/types/aave.ts`（新增全局 deficit 类型定义）
- **逻辑**：
  - 调用后端扩展后的 `/api/markets` 接口，解析并存储全局 deficit 数据。

#### 4.5 UI 展示
- **修改文件**：
  - `src/components/dashboard/Header.tsx`（或新增全局统计展示组件）
  - 或 `src/components/dashboard/TopOpportunities.tsx`（增加全局数据展示区）
- **设计**：
  - 在 Dashboard 顶部或侧边栏显著位置展示全局 deficit 数值。
  - 支持数值格式化（单位、千分位）。
  - 可考虑增加 Tooltip 说明 deficit 含义。

#### 4.6 交互体验
- 保持数据实时刷新（与市场数据同步刷新）。
- 支持不同链（如果多链支持）切换时更新全局 deficit。

## 5. 依赖关系
- 依赖后端 on-chain RPC deficit 字段稳定获取。
- 依赖后端市场数据聚合逻辑完善。
- 无其他未完成 Issue 直接依赖。

## 6. 验收标准
- 后端 `/api/markets` 接口响应中包含准确的全局 deficit 字段。
- 前端 Dashboard 显示全局 deficit 数值，格式正确，位置合理。
- 数据刷新及时，数值与后端接口一致。
- 代码通过单元测试和集成测试，接口文档更新。
- UI 设计符合整体风格，无明显布局或样式问题。

## 7. 复杂度评估
**Medium**  
理由：后端需新增汇总逻辑并扩展接口，前端需修改数据请求和 UI 展示，涉及跨仓库改动，但整体逻辑清晰，数据来源明确，无复杂算法或大规模重构。