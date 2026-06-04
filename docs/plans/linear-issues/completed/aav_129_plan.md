# 开发方案 - AAV-129: 查询多少 supply 资产被用作了 collateral

## 1. Issue 概述
实现功能以查询和展示某个 reserve 中有多少 supply 资产实际被用作了抵押品（collateral backing debt），即真正支撑借款的抵押资产量。解决用户关心的“多少资产在发挥抵押作用”这一核心问题。

## 2. 当前状态
- 状态：In Progress
- 目前仅有设计和数据源调研，未见代码实现
- 已明确合约层无聚合字段，需通过用户级数据聚合实现
- V3 有 Subgraph 和 Dune SQL 支持，V4 无 Subgraph，需考虑其他方案

## 3. 影响范围
- 后端：aave-protocol-analysis/railway（主要实现数据聚合和 API 支持）
- 前端：aaveapy/lovable（展示该数据的 UI 组件和调用新 API）

## 4. 实现方案

### 4.1 后端实现

#### 4.1.1 新增数据库表或缓存结构（可选）
- 由于合约无聚合字段，且用户数量大，实时遍历所有用户代价高
- 方案一：周期性离线批处理（cron job）聚合计算各 reserve 的 collateral backing debt，写入数据库表 `reserve_collateral_backing`（reserveId, timestamp, collateralBackingAmount）
- 方案二：结合已有数据快照，动态计算（性能允许时）

#### 4.1.2 数据聚合逻辑

- 对于 V3 reserve：
  - 利用现有 Subgraph 或 Dune SQL 方案，筛选 `usageAsCollateralEnabledOnUser = true` 且该用户在任意 reserve 有借款（variable 或 stable debt > 0）
  - 累加该用户在目标 reserve 的 current_atoken_balance 作为抵押资产量
- 对于 V4 reserve：
  - 由于无 Subgraph，需从 on-chain RPC 或已有后端缓存中获取用户抵押开关和借款状态
  - 可能需调用 `getUserReserveStatus(reserveId, user)` 和用户借款数据，遍历用户（成本高）
  - 优先考虑从后端已有的用户数据快照中筛选和聚合
- 统一接口封装，返回各 reserve 的 collateral backing debt 数值

#### 4.1.3 API 接口扩展

- 在 `/api/markets` 或新增 `/api/markets/collateral-backing` 提供该数据
- 返回格式示例：
  ```json
  {
    "reserveId": "0x...",
    "collateralBackingAmount": "123456.789",
    "timestamp": "2024-06-01T00:00:00Z"
  }
  ```
- 支持按 reserveId 查询，支持分页或批量查询

#### 4.1.4 关键文件修改/新增

- `backend/src/services/persistenceService.ts`：新增持久化表和查询方法
- `backend/src/services/marketsService.ts`：新增聚合计算逻辑
- `backend/src/controllers/marketsController.ts`：新增API路由处理
- `backend/src/routes/marketsRoutes.ts`：新增路由定义
- 可能新增数据库迁移文件 `backend/migrations/xxxx_add_reserve_collateral_backing.sql`
- 定时任务调度 `backend/src/services/updateScheduler.ts` 增加批处理任务

### 4.2 前端实现

#### 4.2.1 新增展示组件

- 在 `src/components/dashboard/ReservesTable` 或新增独立组件显示 collateral backing debt 字段
- 组件调用新增 API，展示对应 reserve 的抵押资产量
- 支持格式化显示（单位、千分位）

#### 4.2.2 关键文件修改

- `src/hooks/useAaveMarkets.ts`：扩展数据请求，包含 collateral backing debt 字段
- `src/components/dashboard/ReservesTable/ReservesTable.tsx`：新增列显示该数据
- `src/lib/formatters.ts`：新增格式化函数（如格式化大数字）

## 5. 依赖关系
- 依赖后端完成用户抵押资产聚合计算和API接口
- 依赖数据库支持（新增表或字段）
- 需确认 V4 用户数据获取方案（RPC或已有缓存）
- 可能依赖 Dune 或 Subgraph 数据验证（V3）

## 6. 验收标准
- 后端API能正确返回指定 reserve 的 collateral backing debt 数值
- 前端能调用该API并在界面对应位置正确显示
- 数据与Dune SQL查询结果（V3）或链上数据逻辑一致
- 性能满足需求，接口响应时间合理
- 代码通过单元测试和集成测试覆盖

## 7. 复杂度评估
- 复杂度：Medium
- 理由：需跨用户聚合计算，V4数据获取复杂，涉及后端数据库设计和前端展示，需保证性能和准确性


---

# 附加说明

- 该功能对用户理解资产抵押实际利用率有重要价值
- 需与团队确认V4数据获取方案，避免遍历所有用户带来的性能瓶颈
- 后续可考虑增加时间序列存储，支持历史趋势分析（关联AAV-139等历史数据需求）