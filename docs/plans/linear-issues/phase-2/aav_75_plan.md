# 开发方案 - AAV-75: size的变化，liquidity的变化

## 1. Issue 概述
实现市场规模（size）和流动性（liquidity）数据的变化展示功能。即在前端Dashboard中展示各Reserve的size和liquidity随时间的变化趋势，帮助用户更直观地了解市场动态。

## 2. 当前状态
未开始。  
目前后端未存储历史时间序列数据，前端仅展示当前快照数据。

## 3. 影响范围
- 后端仓库：aave-protocol-analysis/railway  
- 前端仓库：aaveapy/lovable

## 4. 实现方案

### 4.1 后端

#### 4.1.1 数据存储设计
- 新建数据库表 `reserve_liquidity_history`（或类似命名），字段包括：
  - reserveId (string)
  - timestamp (timestamp)
  - size (decimal)
  - liquidity (decimal)
- 设计合理的索引以支持按reserveId和时间查询。

#### 4.1.2 数据采集与持久化
- 在数据聚合主进程（root fetcher）或后端定时任务中，定期（如每小时）采集当前各reserve的size和liquidity数据快照。
- 新增持久化逻辑，将快照写入上述历史表。
- 可能需要新增数据库migration脚本。

#### 4.1.3 API扩展
- 在后端API中新增接口，例如：
  - `GET /api/markets/history?reserveId=xxx&from=timestamp&to=timestamp`
- 返回指定reserve在时间区间内的size和liquidity历史数据。
- 支持分页或时间粒度参数（小时/天）。

### 4.2 前端

#### 4.2.1 数据请求
- 新增hook `useReserveHistory`，调用后端历史数据接口，获取指定reserve的size和liquidity历史数据。

#### 4.2.2 UI展示
- 在`ReservesTable`或对应详情页中增加“Size & Liquidity变化”图表模块。
- 使用图表库（如Recharts、Chart.js）绘制时间序列折线图。
- 支持时间范围选择（如7天、30天、90天）。

#### 4.2.3 交互与性能优化
- 对历史数据请求做缓存和节流，避免频繁请求。
- 图表支持tooltip、缩放等交互。

## 5. 依赖关系
- 依赖历史数据存储设计（可参考AAV-139 Campaign History设计文档）
- 可能依赖后端定时任务调度功能完善（updateScheduler）
- 需协调数据库迁移和API版本管理

## 6. 验收标准
- 后端数据库成功存储reserve size和liquidity的历史快照
- 新增API接口能正确返回指定reserve的历史数据
- 前端能调用接口并在UI中正确展示size和liquidity的变化趋势图
- 图表交互流畅，数据准确
- 代码通过单元测试和集成测试，CI/CD无异常

## 7. 复杂度评估
Medium  
理由：涉及后端数据库设计与定时任务改造，新增API设计，前端图表展示及交互实现，跨仓库协作，需保证数据准确性和性能。