# 开发方案：AAV-91 reserve未来apy预测

## 1. Issue 概述
实现对 Aave 各个 reserve 的未来 APY（Annual Percentage Yield）进行预测功能，提升用户对市场利率趋势的预判能力，辅助投资决策。

## 2. 当前状态
未开始。现有代码中已有部分模拟功能（如 useRateSimulation、usePortfolioSimulation），但尚无针对 reserve 未来 APY 的专门预测模块。

## 3. 影响范围
- 后端：aave-protocol-analysis/railway 分支
- 前端：aaveapy/lovable 分支

## 4. 实现方案

### 4.1 后端实现

#### 4.1.1 新增预测服务模块
- 新建 `backend/src/services/apyForecastService.ts`
- 负责基于历史数据、当前市场状态及外部预测模型（如 Merkl/Merit）计算未来 APY 预测值
- 设计预测模型接口，支持多种预测算法（简单线性回归、时间序列模型等）
- 结合已有的 `merklForecastService.ts` 逻辑，复用或扩展预测数据源

#### 4.1.2 数据存储与更新
- 设计数据库表（如 `apy_forecast`）存储预测结果及时间戳，便于历史对比和缓存
- 在 `backend/src/services/updateScheduler.ts` 中增加定时任务，定期更新预测数据（如每小时或每次数据刷新后）

#### 4.1.3 API 接口扩展
- 在 `backend/src/routes/markets.ts` 新增字段 `apyForecast` 到 `/api/markets` 返回数据中
- 修改 `backend/src/services/marketsApiSerialize.ts`，将预测数据序列化返回给前端

### 4.2 前端实现

#### 4.2.1 数据获取
- 修改 `src/hooks/useAaveMarkets/useAaveMarkets.ts`，支持获取并缓存 `apyForecast` 字段
- 设计新的 Hook `useApyForecast`（可选，视复用需求）

#### 4.2.2 UI 展示
- 在 `src/components/dashboard/ReservesTable/` 中新增列或图表展示未来 APY 预测
- 设计简洁直观的视觉表现（如折线图、柱状图或带有预测区间的数值）
- 在 `src/components/dashboard/TopOpportunities/` 等相关组件中考虑引入预测数据，辅助排序或筛选

#### 4.2.3 交互体验
- 在 FilterBar 或其他筛选组件中增加基于预测 APY 的筛选或排序选项
- 提供 Tooltip 或帮助文档说明预测模型的来源和局限性

## 5. 依赖关系
- 依赖 AAV-69/68（Merkl dashboard/net lending）中已有的预测模型和数据接口
- 可能依赖 AAV-91 相关的 API 性能优化（AAV-301）
- 需要后端完成预测数据接口后，前端才能完整实现

## 6. 验收标准
- 后端定时任务能稳定生成并更新 APY 预测数据
- `/api/markets` 接口返回数据包含准确的 `apyForecast` 字段
- 前端 ReservesTable 能正确显示预测 APY，且数据与接口一致
- 用户能通过 UI 直观理解未来 APY 预测信息
- 预测功能通过单元测试和集成测试覆盖
- 性能无明显下降，接口响应时间合理

## 7. 复杂度评估
**Medium**

理由：涉及后端预测模型设计与实现，需合理处理数据来源和算法准确性；前端需新增展示和交互，整体跨端协作复杂度中等。