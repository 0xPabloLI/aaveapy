
# Portfolio Simulation 方案

## 概述
在现有单 token 模拟基础上，新增「Portfolio 模式」，允许用户同时配置多个 token 的 Supply 和 Borrow，查看组合收益/成本对比。

---

## 1. 入口与模式切换

**位置**：顶部 Scenario Controls 区域新增一个切换按钮  
- `Single` 模式（现有）：单 token 模拟  
- `Portfolio` 模式（新增）：多 token 组合模拟  

切换到 Portfolio 模式后，现有的 Supply/Borrow 输入框隐藏，替换为一个 Portfolio 管理条（显示已选 token 数量 + 管理入口）。

---

## 2. Token 选择方式（三合一）

### 2.1 从表格勾选
- Portfolio 模式激活时，每行 reserve 出现一个 checkbox
- 勾选后该 token 自动加入组合，弹出金额输入

### 2.2 搜索添加
- Portfolio 管理面板中提供搜索框，支持按 token symbol/name 搜索
- 点击结果即添加到组合

### 2.3 从展开的 Simulation 面板添加
- 单 token 展开 simulation 后，显示「+ Add to Portfolio」按钮
- 点击后将当前 token 及已输入金额带入 Portfolio 模式

---

## 3. Portfolio 管理面板

**桌面端**：顶部 Scenario Controls 下方展开一个可折叠的面板  
**移动端**：底部抽屉 (bottom sheet)

### 面板内容
```
┌─────────────────────────────────────────────────────┐
│  Portfolio Simulation                    [Clear All] │
├─────────────────────────────────────────────────────┤
│  🔍 Search token...                                  │
├─────────────────────────────────────────────────────┤
│  Supply Positions:                                   │
│  ┌─ USDC (Ethereum)  [$___________] [×]             │
│  ├─ WETH (Arbitrum)  [$___________] [×]             │
│  └─ + Add supply token                              │
│                                                     │
│  Borrow Positions:                                   │
│  ┌─ USDT (Ethereum)  [$___________] [×]             │
│  └─ + Add borrow token                              │
└─────────────────────────────────────────────────────┘
```

每个 token 行：icon + symbol + market name + 金额输入 + 删除按钮

---

## 4. 结果展示：对比视图

### 4.1 汇总卡片（Portfolio Summary）
顶部固定显示：
- **Total Supply**: 所有 supply 金额合计
- **Total Borrow**: 所有 borrow 金额合计  
- **Net Daily Earn**: 总 supply 日收益 − 总 borrow 日成本
- **Net Effective APY**: 加权平均年化

### 4.2 Per-Token 明细表
表格形式逐行展示每个 token 的：
- Token / Market
- Amount (USD)
- Side (Supply / Borrow)
- Native APY
- Incentive APR
- Total APY
- Est USD/day

### 4.3 对比能力
- 支持保存当前组合为「方案 A」
- 修改后形成「方案 B」
- 左右并排对比两个方案的汇总指标差异

---

## 5. 计算逻辑

复用现有 `simulateNativeRatesAfterActions()` 对每个 token 独立计算：
- 每个 supply token：调用 `simulateNativeRatesAfterSupply(rateInput, amount)`
- 每个 borrow token：调用 `simulateNativeRatesAfterBorrow(rateInput, amount)`
- 激励 APR：复用现有 Merkl/Merit/Brevis forecast 逻辑

汇总层：
- `netDailyUsd = Σ(supply_earn_per_day) − Σ(borrow_cost_per_day)`
- `netEffectiveApy = netDailyUsd * 365 / totalSupplyUsd`（基于 supply 本金）

---

## 6. 数据模型

```typescript
interface PortfolioPosition {
  reserveId: string;        // 唯一标识 reserve
  side: 'supply' | 'borrow';
  amount: string;           // 用户输入的金额
  inputMode: 'usd' | 'token';
}

interface PortfolioState {
  positions: PortfolioPosition[];
  savedSnapshots: PortfolioSnapshot[];  // 对比用
}
```

---

## 7. 新增文件结构

```
src/
  components/dashboard/
    PortfolioModeToggle.tsx       # Single/Portfolio 切换
    PortfolioPanel.tsx            # 管理面板（token 列表 + 搜索）
    PortfolioPositionRow.tsx      # 单个 token 行（icon + 输入）
    PortfolioSummary.tsx          # 汇总卡片
    PortfolioCompareView.tsx      # 对比视图
  hooks/
    usePortfolioSimulation.ts     # 组合模拟状态管理 + 计算
  lib/
    portfolioCalculator.ts        # 组合收益汇总计算
```

---

## 8. 实施顺序建议

1. **Phase 1**: 数据模型 + `usePortfolioSimulation` hook + `portfolioCalculator`
2. **Phase 2**: Portfolio 管理面板 UI（搜索 + 添加 + 金额输入）
3. **Phase 3**: 汇总卡片 + Per-Token 明细表
4. **Phase 4**: 对比视图（保存/对比方案）
5. **Phase 5**: 三种添加入口集成（表格 checkbox、搜索、展开面板按钮）
