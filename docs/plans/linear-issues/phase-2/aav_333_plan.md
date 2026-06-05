# AAV-333 开发方案：增加基于用户Portfolio的Risk Premium Simulation

## 1. Issue 概述
为 AaveAPY 项目增加对 V4 Risk Premium（RP）的模拟计算与展示。RP 是基于用户实际抵押品组合计算的风险溢价，影响借款人和供应者的利率表现。需结合用户连接钱包后读取的链上仓位数据，计算并在前端模拟界面展示。

## 2. 当前状态
- 状态：Backlog，尚未开始开发
- 相关连接钱包/导入用户 portfolio 功能尚未完成，属于前置依赖

## 3. 影响范围
- 后端：aave-protocol-analysis/railway（V4 fetcher、API schema、portfolio数据结构）
- 前端：aaveapy/lovable（portfolioCalculator.ts、simulation逻辑、UI展示、连接钱包集成）

## 4. 实现方案

### 4.1 后端改动

#### 4.1.1 API schema 扩展
- 文件：`backend/src/services/marketsApiSerialize.ts`（或对应API序列化文件）
- 新增字段 `collateralRisk: number`（单位BPS）到每个 V4 reserve 的数据结构
- V4 fetcher（`src/v4-fetcher.ts`）从链上 `reserve.settings.collateralRisk` 读取该字段
- V3 reserve 默认 `collateralRisk=0`

#### 4.1.2 数据流
- 确保后端API `/api/markets` 返回的reserve数据包含 `collateralRisk` 字段
- 保持字段命名与后端一致，前端直接使用

### 4.2 Portfolio 数据结构扩展

#### 4.2.1 新增 collateral 标记
- 类型定义：`src/types/portfolio.ts` 新增 `isCollateral: boolean` 字段到 `PortfolioPosition`
- 连接钱包时，从链上仓位数据读取每个资产的抵押品状态，设置 `isCollateral`
- Batch模式下，允许用户在 PortfolioPanel 手动切换 `isCollateral` 状态（UI新增开关）

### 4.3 计算逻辑

#### 4.3.1 新增 computeRiskPremium 函数
- 文件：`src/lib/portfolioCalculator.ts`
- 输入：用户 portfolio positions 列表
- 逻辑：
  - 筛选 `isCollateral === true` 的资产
  - 按 `collateralRisk` 从小到大排序
  - 按抵押品价值加权计算 RP：
    \[
    RP = \frac{\sum_i (CR_i \times 价值_i)}{\sum_i 价值_i}
    \]
- 返回 RP（BPS）

#### 4.3.2 Simulation 集成
- 文件：`src/hooks/useRateSimulation.ts` 或相关模拟逻辑文件
- 修改 `buildRateSimulationResult()`，增加 RP 参数输入
- 计算：
  - Effective Borrow APY = Borrow APY × (1 + RP/10000)
  - Supply APY 增加因 premium debt 利息流入的提升（根据 aave-supply-borrow-rate-formula.md §4-§5）
- 返回结果中包含 RP 和调整后的 APY

### 4.4 UI 展示

#### 4.4.1 SimulationSubRow
- 文件：`src/components/dashboard/Portfolio/SimulationSubRow.tsx`
- 新增 Risk Premium 行，显示：
  - RP 值（BPS或%）
  - Effective Borrow APY（带RP调整后的借款利率）

#### 4.4.2 PortfolioPanel 汇总区
- 文件：`src/components/dashboard/Portfolio/PortfolioPanel.tsx`
- 显示 portfolio-level Risk Premium 总值
- 支持用户在 batch 模式下切换资产 collateral 状态，实时刷新 RP 计算结果

### 4.5 连接钱包功能（前置依赖）
- 需完成钱包连接及链上仓位读取功能，确保能获取资产的抵押品状态
- 关联项目：增加连接钱包功能（未包含在本方案内）

## 5. 依赖关系
- 连接钱包 / 导入用户 portfolio 功能（必须先完成）
- 后端 V4 fetcher 支持 `collateralRisk` 字段
- aaveapy-doc 中的利率公式文档作为计算参考

## 6. 验收标准
- 后端API `/api/markets` 返回数据包含正确的 `collateralRisk` 字段
- 连接钱包后，用户 portfolio 中资产正确标记 `isCollateral`
- computeRiskPremium 函数正确计算 RP，符合文档公式
- Simulation 页面借款利率正确显示带 RP 调整的 Effective Borrow APY
- Supply APY 显示因 RP 产生的利息流入提升
- UI新增的 Risk Premium 行和 PortfolioPanel 汇总区正确展示 RP 信息
- 用户手动切换 collateral 状态时，RP 和模拟结果实时更新
- 代码覆盖率和类型检查通过，无明显性能回退

## 7. 复杂度评估
- Medium
- 理由：
  - 需跨前后端多处改动，涉及链上数据读取、API schema扩展、复杂计算逻辑和UI展示
  - 依赖连接钱包功能，集成难度较高
  - 计算公式较复杂，需要确保准确性和性能
  - UI交互新增，需保证良好用户体验

---

以上方案为 AAV-333 的完整开发计划，建议先推进连接钱包功能，随后按步骤逐步实现。