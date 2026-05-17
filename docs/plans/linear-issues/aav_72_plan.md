# 开发方案：AAV-72 每个market整体的liquidity和utilization

## 1. Issue 概述
实现每个market整体的流动性（liquidity）和利用率（utilization）指标展示。即在前端Dashboard或相关页面，显示每个市场的整体流动性规模及其利用率，帮助用户快速了解市场健康状况。

## 2. 当前状态
- **未开始**：代码库中目前已有单个reserve的流动性和利用率数据，但尚无针对整个market（即一组reserve或某个链/协议层面）的整体汇总展示。
- 后端已有基础数据支持单个reserve的liquidity和deficit字段，但无整体market级别的聚合数据接口。

## 3. 影响范围
- **后端**：aave-protocol-analysis/railway 分支
- **前端**：aaveapy/lovable 分支

## 4. 实现方案

### 4.1 后端实现

#### 4.1.1 数据聚合接口设计
- **新增接口**：`GET /api/markets/summary` 或在现有 `/api/markets` 接口中增加整体market汇总字段
- **聚合逻辑**：
  - 对同一market下所有reserve的`liquidity`字段求和，得到market整体流动性
  - 计算market整体utilization = (总借款量 / 总流动性) 或根据已有字段计算
- **文件修改**：
  - `backend/src/services/marketsService.ts`：新增聚合函数，计算market级别的liquidity和utilization
  - `backend/src/controllers/marketsController.ts`：新增或扩展接口处理逻辑
  - `backend/src/routes/markets.ts`：注册新接口路由
- **数据结构**：
  - 定义新的TypeScript类型 `MarketSummary`，包含marketId、marketName、totalLiquidity、utilization等字段

#### 4.1.2 数据来源
- 使用已有的reserve数据快照（内存或数据库）
- 计算时注意排除异常数据或零值reserve

### 4.2 前端实现

#### 4.2.1 数据请求
- 在`src/hooks/useAaveMarkets.ts`或新建hook中调用新增的市场汇总接口，获取market整体数据

#### 4.2.2 UI展示
- 在Dashboard相关组件（如`src/components/dashboard/ReservesTable`或新建`MarketSummaryTable`组件）中添加整体market liquidity和utilization展示
- 使用TailwindCSS进行样式设计，保持与现有风格一致
- 支持按market维度排序和筛选

#### 4.2.3 交互优化
- 可考虑在FilterBar中增加market维度筛选
- 支持点击market查看其下reserve明细

### 4.3 测试
- 后端单元测试覆盖聚合逻辑
- 前端集成测试确保数据正确展示
- 手动验证接口返回数据准确性

## 5. 依赖关系
- 依赖后端reserve数据的准确性和稳定性
- 可能依赖AAV-74（market size/liquidity metrics）相关设计和数据字段规范

## 6. 验收标准
- 后端新增接口返回正确的market整体liquidity和utilization数据
- 前端Dashboard能正确调用接口并展示对应数据
- UI风格符合项目规范，交互流畅
- 相关单元测试和集成测试通过
- 代码通过CI/CD流程，无性能回退

## 7. 复杂度评估
- **Medium**
- 理由：涉及后端数据聚合设计和接口扩展，前端新增数据请求和展示，需保证数据准确和性能；但已有reserve级数据基础，聚合逻辑相对简单，且前端已有类似表格展示经验。