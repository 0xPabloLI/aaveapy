# [EPIC] 市场宏观指标聚合 — market size / liquidity / utilization / 全局 deficit

> 合并自 AAV-74、AAV-72、AAV-73、AAV-79

## 1. 背景与动机

这四个 issue 共享同一模式：**从 reserve 级数据聚合到更高维度（market / protocol 全局）**。
- 后端改动均在 `marketsService.ts` 做汇总
- 前端均需新增 hook + 展示组件
- 统一规划可避免重复造轮，一次建好分层聚合框架

## 2. 子 Issue 一览

| 顺序 | Issue | 主题 | 聚合层级 | 核心指标 |
|------|-------|------|---------|---------|
| 1 | AAV-74 | 某个 market 的 size | per-market | marketSize |
| 2 | AAV-72 | 每个 market 整体的 liquidity & utilization | per-market | totalLiquidity, utilization |
| 3 | AAV-73 | 整个 V3 协议的 liquidity & size | 全协议 | totalLiquidityUSD, totalSizeUSD |
| 4 | AAV-79 | deficit 的全局数据 | 全协议 | totalDeficit |

## 3. 后端统一架构

### 3.1 分层聚合模型

```
reserve 级数据（已有）
    ↓ 聚合 step 1
market 级汇总（AAV-74 size → AAV-72 liquidity/utilization）
    ↓ 聚合 step 2
protocol 全局汇总（AAV-73 liquidity/size → AAV-79 deficit）
```

### 3.2 修改文件清单

| 文件 | 改动 |
|------|------|
| `src/services/marketsService.ts` | 新增 `aggregateMarketMetrics()` 和 `aggregateProtocolMetrics()` |
| `src/services/marketsApiSerialize.ts` | 序列化新增字段：marketSize, totalLiquidity, utilization, totalDeficit |
| `src/controllers/marketsController.ts` | 扩展 `/api/markets` 响应 |
| `src/routes/markets.ts` | 确保路由支持新字段 |
| `src/index.ts`（Root Fetcher） | 在数据更新周期中调用聚合函数 |

### 3.3 数据结构

```ts
interface MarketMetrics {
  marketId: string;
  marketName: string;
  marketSizeUSD: number;        // AAV-74
  totalLiquidityUSD: number;    // AAV-72
  utilization: number;          // AAV-72: totalBorrows / totalLiquidity
  totalDeficitUSD: number;      // AAV-79 (per-market)
}

interface ProtocolMetrics {
  totalSizeUSD: number;         // AAV-73
  totalLiquidityUSD: number;    // AAV-73
  totalDeficitUSD: number;      // AAV-79 (全局)
  lastUpdated: string;          // ISO timestamp
}
```

### 3.4 API 设计

优先在现有 `GET /api/markets` 接口扩展字段：
- 每个 market 对象增加 `metrics: MarketMetrics`
- 响应根增加 `protocolMetrics: ProtocolMetrics`

## 4. 前端统一架构

### 4.1 数据层

| 文件 | 改动 |
|------|------|
| `src/hooks/useAaveMarkets.ts` | 扩展返回，包含 MarketMetrics 和 ProtocolMetrics |
| `src/lib/apiSchemas.ts` | 增加 MarketMetrics / ProtocolMetrics 类型定义 |
| `src/shared/market-contract/schemas.ts` | 对应 zod schema 增加可选字段 |
| `src/lib/formatters.ts` | 新增市场规模、利用率格式化函数 |
| `src/types/field-canary.test.ts` | 增加新字段名 |

### 4.2 UI 层

| 组件 | 用途 |
|------|------|
| `MarketMetricsCard.tsx`（新增） | 展示单个 market 的 size / liquidity / utilization / deficit |
| `ProtocolSummaryBar.tsx`（新增） | 展示全协议汇总：totalSize / totalLiquidity / totalDeficit |
| 集成位置：Dashboard 页面 ReservesTable 上方 | |

### 4.3 交互

- 支持按 market 维度排序和筛选
- 支持点击 market 查看其下 reserve 明细
- Tooltip 说明各指标含义

## 5. 执行计划

### Phase 1: AAV-74 — Market Size（聚合基础）

1. 后端：在 `marketsService.ts` 新增 `aggregateMarketMetrics()`，计算 per-market size
2. 后端：`marketsApiSerialize.ts` 序列化 `marketSizeUSD` 字段
3. 前端：hook + 类型扩展 + MarketMetricsCard 基础组件（仅显示 size）
4. 测试 + 验证

### Phase 2: AAV-72 — Market Liquidity & Utilization

1. 后端：扩展 `aggregateMarketMetrics()`，增加 totalLiquidity 和 utilization 计算
2. 前端：MarketMetricsCard 增加 liquidity / utilization 列
3. 测试 + 验证

### Phase 3: AAV-73 — Protocol 全局汇总

1. 后端：新增 `aggregateProtocolMetrics()`，遍历所有 market 的 metrics 做全局汇总
2. 后端：API 根增加 `protocolMetrics` 字段
3. 前端：ProtocolSummaryBar 组件 + hook 扩展
4. 测试 + 验证

### Phase 4: AAV-79 — 全局 Deficit

1. 后端：在 `aggregateMarketMetrics()` 增加 per-market deficit；在 `aggregateProtocolMetrics()` 增加 totalDeficit
2. 前端：MarketMetricsCard 和 ProtocolSummaryBar 增加 deficit 展示
3. 测试 + 验证

## 6. 后续扩展

| Issue | 关系 | 说明 |
|-------|------|------|
| AAV-75 | 下游 | size/liquidity 历史变化趋势，依赖本 epic 聚合逻辑 |
| AAV-76 | 交叉 | DefiLlama 数据对比，本 epic 指标是对比核心字段 |

## 7. 验收标准

- 后端 `GET /api/markets` 返回每个 market 的 `metrics`（含 marketSizeUSD, totalLiquidityUSD, utilization, totalDeficitUSD）和根级 `protocolMetrics`
- 前端 Dashboard 展示 MarketMetricsCard 和 ProtocolSummaryBar，数据准确
- 各指标格式化合理，Tooltip 含义清晰
- 排序/筛选交互正常
- 全部单元测试 + 集成测试通过
- `npm run lint && npm test && npm run build && npx tsc --noEmit` 全通过

## 8. 复杂度评估

**Medium**

- 后端核心是分层聚合函数，逻辑清晰，基于已有 reserve 级数据
- 前端复用现有展示模式，新增 2 个组件
- 最大风险：聚合计算性能（需确保不阻塞主数据更新周期），可通过异步计算 + 缓存缓解
