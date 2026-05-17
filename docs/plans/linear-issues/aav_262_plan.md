# 开发方案：AAV-262 增加 TVL 历史

## 1. Issue 概述
为系统增加 TVL（Total Value Locked）历史数据的存储与查询功能，支持前端展示 TVL 的时间序列变化，提升数据的历史分析能力。

## 2. 当前状态
- 设计层面已有相关历史数据存储的设计文档（如 campaign_history.md），但 TVL 历史尚未实现。
- 代码中无 TVL 历史数据的数据库表、采集或接口支持。
- 属于未开始状态。

## 3. 影响范围
- 后端：aave-protocol-analysis 仓库 railway 分支
- 前端：aaveapy 仓库 lovable 分支（需新增历史数据展示组件）

## 4. 实现方案

### 4.1 后端实现

#### 4.1.1 数据库设计
- 新建数据库表 `tvl_history`，字段示例：
  - `id` (主键)
  - `timestamp` (时间戳，记录采集时间)
  - `chainId` (链ID)
  - `marketId` (市场ID或reserve标识)
  - `tvl` (数值，单位统一，如美元)
  - 其他可选字段（如分拆TVL类型）

#### 4.1.2 数据采集与写入
- 在根数据采集服务（`src/index.ts`）中，增加定时任务或在现有 cron 任务中，定期采集当前 TVL 数据。
- 将采集的 TVL 数据写入 `tvl_history` 表，确保时间序列数据完整。
- 采集频率建议：每小时或根据业务需求调整。

#### 4.1.3 API 接口扩展
- 在后端 API 服务（`backend/`）新增接口 `/api/markets/tvl-history`，支持按市场和时间范围查询 TVL 历史数据。
- 接口参数示例：`marketId`, `startTimestamp`, `endTimestamp`
- 返回格式：时间序列数组，包含时间戳和对应 TVL 数值。

#### 4.1.4 相关服务调整
- `persistenceService.ts`：新增 TVL 历史数据的持久化方法。
- `updateScheduler.ts`：调度新增的 TVL 采集任务。
- 可能需要新增 migration 文件，创建 `tvl_history` 表。

### 4.2 前端实现

#### 4.2.1 数据请求
- 在 `src/hooks/` 新增 `useTVLHistory.ts`，封装调用 `/api/markets/tvl-history` 的逻辑，支持参数化查询。

#### 4.2.2 组件开发
- 在 `src/components/dashboard/` 新增 `TVLHistoryChart.tsx`，使用图表库（如 Recharts、Chart.js 或 ApexCharts）展示 TVL 时间序列。
- 组件支持时间范围选择（如近7天、30天、90天等）。

#### 4.2.3 页面集成
- 在相关市场详情页或首页新增 TVL 历史展示模块。
- 结合现有的市场数据展示，提供历史趋势视图。

### 4.3 测试
- 后端单元测试覆盖新增数据写入和查询接口。
- 前端组件单元测试及集成测试，确保数据正确渲染。
- 端到端测试验证整体功能。

## 5. 依赖关系
- 依赖数据库迁移功能（可能与 AAV-139 设计文档相关）
- 需确认现有数据采集任务的扩展能力
- 前端图表库依赖（若未引入需先安装）

## 6. 验收标准
- 后端数据库成功存储 TVL 历史数据，数据准确且按时间排序。
- 新增 API `/api/markets/tvl-history` 能正确返回指定市场和时间范围的 TVL 历史数据。
- 前端页面能展示 TVL 历史折线图，且支持时间范围切换。
- 相关单元测试和集成测试通过。
- 性能无明显下降，接口响应时间合理。

## 7. 复杂度评估
**Medium**

理由：涉及数据库设计与迁移、定时任务调整、API 扩展及前端图表开发，跨前后端多个模块协作，技术难度中等，需保证数据准确性和性能。