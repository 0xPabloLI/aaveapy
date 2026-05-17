# AAV-90 开发方案 - reserve历史数据显示

## 1. Issue 概述
实现 AaveAPY 项目中 reserve（储备资产）历史数据的展示功能。即在前端展示某个资产在过去时间段内的关键指标变化（如利率、流动性、借贷量、奖励等），支持用户查看历史趋势，辅助决策。

## 2. 当前状态
- 设计阶段：已有设计文档（docs/backend/campaign-history.md）涉及历史数据存储方案，但尚未实现数据库迁移、数据采集和前端展示。
- 代码层面：后端无历史数据存储表，前端无历史数据展示组件。
- 相关 Issue（AAV-139、AAV-344/262/90）均指向历史数据功能尚未开发。

## 3. 影响范围
- 后端仓库：aave-protocol-analysis（railway 分支）
- 前端仓库：aaveapy（lovable 分支）

## 4. 实现方案

### 4.1 后端实现

#### 4.1.1 数据库设计与迁移
- 新建数据库表 `campaign_history`（或更通用的 `reserve_history`），字段包括：
  - reserveId (string)
  - timestamp (timestamp)
  - liquidity (numeric)
  - variableBorrowRate (numeric)
  - stableBorrowRate (numeric)
  - supplyRate (numeric)
  - incentives (jsonb)
  - deficit (numeric)
  - 其他关键指标字段
- 创建对应的 TypeORM/knex migration 文件放入 `backend/migrations/`。

#### 4.1.2 数据采集与存储
- 在 `src/index.ts` 或专门的采集模块中，定时（cron）抓取当前 reserve 数据快照。
- 设计增量写入逻辑，避免重复写入相同时间点数据。
- 将采集到的快照写入 `campaign_history` 表。
- 采集频率建议：每小时或每次后端更新周期。

#### 4.1.3 API 扩展
- 在 `backend/src/routes/` 新增 `/api/markets/history` 路由，支持按 reserveId 和时间区间查询历史数据。
- 在 `backend/src/controllers/` 新增对应控制器，查询数据库并返回历史时间序列数据。
- API 返回格式设计为时间序列数组，方便前端绘图。

### 4.2 前端实现

#### 4.2.1 数据请求
- 在 `src/hooks/` 新增 `useReserveHistory.ts`，封装调用 `/api/markets/history` 接口，支持参数传递（reserveId、时间范围）。

#### 4.2.2 UI 组件
- 在 `src/components/dashboard/` 新增 `ReserveHistoryChart.tsx` 组件，使用图表库（如 Recharts、Chart.js 或 ApexCharts）绘制历史趋势图。
- 组件支持切换指标（利率、流动性、奖励等）和时间范围（1天、7天、30天等）。

#### 4.2.3 集成
- 在 `ReservesTable` 或资产详情页中集成 `ReserveHistoryChart`，点击某资产后展示历史数据面板。
- 支持响应式设计，保证移动端体验。

### 4.3 关键逻辑变更
- 后端新增历史数据存储和查询逻辑。
- 前端新增历史数据请求和展示逻辑。
- 数据流由后端定时采集 -> 数据库存储 -> API 提供 -> 前端请求 -> 图表展示。

## 5. 依赖关系
- 依赖 AAV-139（campaign history 设计）文档确认。
- 需先完成数据库迁移框架搭建。
- 可能依赖后端定时任务调度（updateScheduler.ts）完善。

## 6. 验收标准
- 后端数据库成功创建历史数据表，定时写入历史快照。
- 新增 API `/api/markets/history` 能正确返回指定 reserve 的历史数据。
- 前端能调用该 API 并展示历史趋势图，支持切换指标和时间范围。
- UI 交互流畅，数据准确，符合设计预期。
- 代码通过单元测试和集成测试，CI/CD 无报错。

## 7. 复杂度评估
- Medium
- 理由：涉及后端数据库设计和定时任务实现，前端新增图表组件和数据交互，跨仓库协作，需保证数据准确性和性能，但技术难度适中。