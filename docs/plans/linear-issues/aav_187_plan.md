# AAV-187 开发方案：修复 V4 市场 fallback 计算中 Total Borrowed 和 Pool Liquidity USD 的层级不匹配问题

## 1. Issue 概述
当前 V4 市场中，fallback 计算 Total Borrowed USD 和 Pool Liquidity USD 时，错误地将 Per-Spoke 级别的 `reserveSizeUsd` 与 Hub 级别的 `utilizationPct`、`totalVariableDebt`、`availableLiquidity` 混用，导致数值严重偏差（最高可达 13 倍）。需要调整数据结构和计算逻辑，确保同层级数据匹配，修正数值计算。

## 2. 当前状态
- **状态**：未开始（Backlog）
- **代码现状**：前端部分存在错误的 fallback 计算逻辑，后端未提供 Hub 级别的 `hubReserveSizeUsd` 和 `hubTotalBorrowedUsd` 字段。

## 3. 影响范围
- **仓库**：
  - 前端：`aaveapy` 仓库，lovable 分支
  - 后端：`aave-protocol-analysis` 仓库，railway 分支（需新增 Hub 级别数据支持）

## 4. 实现方案

### 4.1 后端改动

#### 4.1.1 新增 Hub 级别字段支持
- **目标**：在后端 API `/api/markets` 返回的 V4 市场数据中，新增以下字段：
  - `hubReserveSizeUsd`：Hub 级别的总储备规模（USD）
  - `hubTotalBorrowedUsd`：Hub 级别的总借出额（USD）
- **修改文件**：
  - `backend/src/services/marketsService.ts`：增加 Hub 级别数据的计算和缓存
  - `backend/src/services/marketsApiSerialize.ts`：序列化新增字段至 API 响应
  - 可能涉及 `src/v4-fetcher.ts` 及相关数据聚合逻辑，确保 Hub 级别数据正确计算

#### 4.1.2 数据聚合逻辑
- 聚合所有 Spoke 的 `reserveSizeUsd`，`totalVariableDebt`，`availableLiquidity` 等，计算 Hub 级别的对应字段
- 确保 Hub 级别数据与 Spoke 级别数据分离，避免混淆

### 4.2 前端改动

#### 4.2.1 修改数据使用逻辑
- **修改文件**：
  - `src/components/dashboard/ReservesTable.tsx`（427-440 行）
  - `src/components/dashboard/DesktopReserveRow.tsx`（157-171 行）
  - `src/components/dashboard/MobileReserveCard.tsx`（460-475 行）
- **修改点**：
  - 在计算 Total Borrowed USD 和 Pool Liquidity USD 时，判断市场类型（是否为 V4）
  - 对于 V4 市场，优先使用后端新增的 Hub 级别字段 `hubReserveSizeUsd` 和 `hubTotalBorrowedUsd` 进行计算，避免使用混合层级数据
  - fallback 逻辑调整为：
    ```typescript
    getReserveTotalBorrowedUsd(reserve) 
      ?? getTotalBorrowedUsd({ hubReserveSizeUsd × utilizationPct / 100 })  // 使用 Hub 级别数据
    getReserveAvailableLiquidityUsd(reserve)
      ?? getPoolLiquidityUsd({ hubReserveSizeUsd - hubTotalBorrowedUsd })  // 使用 Hub 级别数据
    ```
- **数据流变更**：
  - 由后端提供 Hub 级别数据，前端接收并在对应组件中使用
  - 保持其他市场（V3、非 V4）逻辑不变

#### 4.2.2 代码注释和文档更新
- 更新 `docs/rate-calculation.md`（182-219 行）中关于 V4 fallback 计算的说明，明确层级区分和使用字段

## 5. 依赖关系
- 依赖后端先完成 Hub 级别数据的支持（新增字段和聚合逻辑）
- 依赖后端 API 版本升级，前端同步更新接口类型定义（TypeScript 类型）
- 可能关联 AAV-189（V4 Hub 数据展示）和 AAV-187 相关的其他 V4 计算问题

## 6. 验收标准
- 后端 `/api/markets` 返回数据包含 `hubReserveSizeUsd` 和 `hubTotalBorrowedUsd` 字段，且数值正确
- 前端 V4 市场（如 AaveV4Forex USDT）显示的 Total Borrowed USD 和 Pool Liquidity USD 数值准确，符合 Hub 级别聚合数据
- 通过单元测试和集成测试验证计算逻辑正确
- 手工验证前端展示与后端数据一致，且修正前后数值差异明显（修正前误差可达 13 倍）
- 文档 `docs/rate-calculation.md` 更新完成，描述清晰

## 7. 复杂度评估
- **复杂度**：Medium
- **理由**：
  - 需后端新增聚合字段，涉及数据聚合和序列化改动
  - 前端需修改多个组件的计算逻辑，确保兼容性和正确性
  - 需协调前后端接口变更和文档更新
  - 但整体逻辑清晰，改动范围有限，风险可控

---

以上为 AAV-187 的详细开发方案，建议先由后端完成 Hub 级别数据支持，再由前端同步更新使用逻辑，确保数据层级一致，修正数值错误。