# AAV-107 开发方案

## 1. Issue 概述
实现一个功能，用于展示未来 APR（Annual Percentage Rate）如何受币价波动影响的变化趋势。该功能旨在帮助用户理解市场利率的潜在风险和收益波动，提升 AaveAPY 的预测和模拟能力。

## 2. 当前状态
未开始。代码库中已有部分 APR 预测相关功能（如 useRateSimulation、usePortfolioSimulation 钩子），但尚无基于币价变化的未来 APR 影响展示。

## 3. 影响范围
- 前端：aaveapy 仓库（lovable 分支）
- 后端：aave-protocol-analysis 仓库（railway 分支）

## 4. 实现方案

### 4.1 后端实现

#### 4.1.1 新增币价影响的 APR 预测服务
- **新增文件/修改文件**：
  - `backend/src/services/aprPriceImpactService.ts`（新建）
  - 可能修改 `backend/src/services/marketsService.ts` 以集成新预测数据
- **关键逻辑**：
  - 利用现有的币价数据（来自 oracleService 或 token-price-resolver.ts）
  - 设计模型计算币价变动对 APR 的影响，结合市场流动性、借贷需求等因素
  - 生成未来一段时间内（如7天、30天）的 APR 预测数据序列
- **数据流变更**：
  - 新增接口字段返回未来 APR 预测数据，格式设计需兼容现有 API（如 `/api/markets` 或新增 `/api/markets/apr-prediction`）

#### 4.1.2 API 接口扩展
- 在现有 `/api/markets` 或新增独立接口暴露币价影响的未来 APR 预测数据
- 确保接口响应体符合 OpenAPI 规范，更新 `scripts/generate-openapi.ts`

### 4.2 前端实现

#### 4.2.1 数据获取与状态管理
- **修改文件**：
  - `src/hooks/useAaveMarkets.ts`（扩展数据获取）
  - 新建 `src/hooks/useAprPriceImpactSimulation.ts`（封装币价影响 APR 预测逻辑）
- **逻辑**：
  - 调用后端新增接口获取未来 APR 预测数据
  - 结合现有 APR 数据，提供对比视图

#### 4.2.2 UI 组件开发
- **新增/修改文件**：
  - `src/components/dashboard/AprPriceImpactChart.tsx`（新建）
  - 可能修改 `src/components/dashboard/ReservesTable.tsx` 或 `TopOpportunities.tsx`，增加未来 APR 预测展示入口
- **功能**：
  - 以图表形式（折线图、面积图等）展示未来 APR 随币价变化的趋势
  - 支持用户切换时间范围（如7天、30天）
  - 提供币价与 APR 关联的交互提示

#### 4.2.3 交互与体验
- 在 FilterBar 或 Dashboard 适当位置增加“APR 价格影响预测”开关或入口
- 确保响应式设计，兼容移动端

### 4.3 测试
- 后端单元测试覆盖新服务逻辑
- 前端单元测试覆盖新 Hook 和组件
- 集成测试确保接口数据正确展示
- UI 交互测试

## 5. 依赖关系
- 依赖 AAV-261（Oracle price comparison）相关币价数据准确性
- 依赖现有 APR 预测基础（useRateSimulation）
- 需协调后端数据接口设计，确保前后端数据格式统一

## 6. 验收标准
- 后端成功提供基于币价变动的未来 APR 预测数据接口
- 前端能正确调用接口并展示未来 APR 变化趋势图表
- 用户可通过 UI 交互查看不同时间范围的 APR 预测
- 相关单元测试和集成测试通过
- OpenAPI 文档更新，接口文档完整

## 7. 复杂度评估
**Medium**

理由：涉及后端新增预测模型设计与实现，前端图表开发及数据交互，需保证数据准确性和用户体验，跨仓库协作复杂度中等。