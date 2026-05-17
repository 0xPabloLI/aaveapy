# AAV-74 开发方案

## 1. Issue 概述
实现某个市场（market）的规模（size）展示功能，提供准确的市场规模数据供前端展示和用户参考。

## 2. 当前状态
未开始。代码库中尚无针对单个市场规模的专门字段或接口支持。

## 3. 影响范围
- 后端：aave-protocol-analysis/railway（数据采集、存储及API支持）
- 前端：aaveapy/lovable（市场规模展示组件及数据调用）

## 4. 实现方案

### 4.1 后端实现

#### 4.1.1 数据采集与计算
- **修改文件**：
  - `src/index.ts`（Root Fetcher）：增加对市场规模数据的计算逻辑
  - `backend/src/services/marketsService.ts`：新增或扩展市场规模字段的管理
  - `backend/src/services/marketsApiSerialize.ts`：序列化市场规模字段，确保API响应包含该数据
- **关键逻辑**：
  - 市场规模通常基于某种资产的流通量乘以价格计算（例如：totalLiquidity * tokenPrice）
  - 结合已有的token-price-resolver.ts，确保价格数据准确
  - 计算后将市场规模数据存入内存快照，供API读取

#### 4.1.2 API接口支持
- **修改文件**：
  - `backend/src/routes/markets.ts`（或对应API路由文件）
  - `backend/src/controllers/marketsController.ts`
- **关键逻辑**：
  - 在`GET /api/markets`接口响应中，增加marketSize字段
  - 保持字段命名与后端一致，方便前端直接使用

### 4.2 前端实现

#### 4.2.1 数据调用与展示
- **修改文件**：
  - `src/hooks/useAaveMarkets.ts`：确保marketSize字段被正确解析和使用
  - `src/components/dashboard/ReservesTable/ReservesTable.tsx`：新增市场规模列显示
  - `src/lib/formatters.ts`：新增市场规模格式化函数（如以百万、十亿单位显示）
- **关键逻辑**：
  - 在市场列表或详情页增加市场规模列或展示区域
  - 支持排序和筛选功能（可选）

#### 4.2.2 UI/UX
- 使用TailwindCSS样式，确保市场规模展示清晰美观
- 可能在FilterBar或TopOpportunities组件中增加市场规模相关筛选或排序项（视需求）

## 5. 依赖关系
- 依赖后端准确计算和提供市场规模数据
- 可能依赖token价格的准确性（token-price-resolver）
- 相关Issue：AAV-75/73/72（市场规模/liquidity指标相关）

## 6. 验收标准
- 后端API `/api/markets` 返回数据中包含准确的marketSize字段
- 前端市场列表或详情页正确显示对应市场的规模数据
- 市场规模数据格式化合理，单位清晰
- 相关排序和筛选功能正常（如实现）
- 通过单元测试和集成测试验证数据正确性和接口稳定性

## 7. 复杂度评估
Medium  
理由：涉及后端数据计算与API扩展，以及前端数据展示和交互调整，需保证数据准确性和性能，但整体逻辑较为清晰，已有基础设施支持。