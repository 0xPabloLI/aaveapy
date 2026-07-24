# Phase 12: Reserve Table Offset 规则改造

> Issues: AAV-1023 + AAV-1024
> 估计: 1-2 sessions
> Branch: `refactor/aav-1023-offset-reserve`
> 阻塞: AAV-1022（offset 规则定义，当前 Backlog）
> Linear 状态: AAV-1023 Backlog, AAV-1022 Backlog

## 代码审查状态（2026-07-21）

### 当前 offset 实现

- `rateSimulationCalculator.ts` 已有完整的 cross-reserve offset 逻辑：
  - `crossReserveNetEligibleUsdFn` — 计算跨 reserve offset 后的净 eligible USD
  - `walletCrossReserveNetEligibleUsdFn` — 钱包级别的 cross-reserve offset
  - `merklGroupMultiplier` — 包含 offset 后的 group multiplier
- Golden Rules 已定义：`current` 使用 wallet-only 值，`after` 使用 simulation 值
- BORROW_BL 逻辑已实现（Phase 1, AAV-962）— borrow 仓位时 supply incentive 归零

### 未完成

- **AAV-1022** — offset 对齐规则定义尚未确定（Backlog）
  - 需要明确：哪些视图跟随 portfolio-level offset 结果，哪些保留单行原始值
  - 需要明确：borrow incentive 在 offset 后归零时的单行展示语义
- **AAV-1023** — 按 AAV-1022 定义的规则改造 Reserve table 展示逻辑
  - 当前 Reserve table 单行显示的是**未 offset 的值**
  - Portfolio simulation 聚合后显示的是**offset 后的值**
  - 两者可能矛盾，用户困惑

## 改动方向

1. **先完成 AAV-1022** — 定义统一 offset 规则：
   - Reserve table 单行是否跟随 portfolio-level offset？
   - Shared scenario 展示是否跟随？
   - Borrow incentive offset 后归零时的单行展示
2. **AAV-1023** — 按规则改造 Reserve table + Shared scenario 展示逻辑
3. **AAV-1024** — 同步验收用例到新口径

## 阻塞

AAV-1022（offset 规则定义）尚未确定。此 phase 无法在规则确定前启动。

## 相关代码

- `src/lib/rateSimulationCalculator.ts` (1,994 行) — offset 计算核心
- `src/components/dashboard/ReservesTable.tsx` — Reserve table 展示
- `src/components/dashboard/DesktopReserveRow.tsx` — 单行展示
- `src/components/dashboard/SimulationSubRow.tsx` — 展开行展示
