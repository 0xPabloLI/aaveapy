# Handoff: PortfolioReserveEntry 重构 (ADR-014) — COMPLETED

> 完成日期: 2026-06-08

## 概要

将 Portfolio 数据模型从 `PortfolioPosition`（per-side）重构为 `PortfolioReserveEntry`（per-reserve），从编译时保证 supply-borrow 不可分性。**所有 4 个阶段已完成。**

## Commit 对应表

| 阶段 | Commit | 说明 |
|------|--------|------|
| 2 | `16d8e6a0` | migrate to PortfolioReserveEntry per-reserve (AAV-671, ADR-0014) |
| 3 | `edacaea9` | move PortfolioModeToggle into PortfolioPanel header row |
| 3 | `34be66d1` | move PortfolioModeToggle (duplicate — same change, different take) |
| 3 | `2127fbcb` | exclude hidden positions from Earn calculation (AAV-671) |
| 3 | `ba83534b` | remove outer border, position Portfolio panel inline with ScenarioControls |
| 3+钱包 | `88196cab` | ⚠️ **混合 commit**: 钱包功能 + Portfolio 改动（见下） |
| 4 | `b245f1d5` | delete PortfolioPosition + deprecated modules, complete ADR-014 (AAV-704) |
| 4 | `dddfd8d1` | delete deprecated simulatePortfolioPositions, fix review I1/I3/I4 |
| 4 | `a2362f35` | add architecture guards for simulatePortfolioPositions + entriesToPositions |

### ⚠️ 混合 Commit: `88196cab`

该 commit 的 message 是 `feat(wallet): ...`，但实际包含了 **2 类不相关改动**：

1. **钱包改动**（属于钱包功能）:
   - `WalletButton.tsx` / `WalletButton.test.tsx` — Copy address + Switch wallet
   - `WatchAddressInput.tsx` / `WatchAddressInput.test.tsx` — layout shift fix + 移除 ENS

2. **Portfolio 改动**（应属于 Portfolio 阶段 3/4）:
   - `PortfolioPanel.tsx` — 删除 `WalletButton` import + 删除 `onWalletSync` prop
   - `PortfolioPanel.test.tsx` — 删除 WalletButton 相关断言
   - `ReservesTable.tsx` — 删除 WalletButton 引用

**影响**: `b245f1d5`（阶段 4 主清理）改了 PortfolioPanel 的测试文件但未改 `.tsx`，因为 `.tsx` 的改动已被 `88196cab` 抢先 commit。

**建议**: 后续做 `git rebase -i` 将 `88196cab` 中的 Portfolio 部分拆到独立 commit，或将 Portfolio 改动 squash 进阶段 3 的某个 commit。

## Linear Issue 进度

| Issue | 状态 | 内容 |
|-------|------|------|
| **AAV-637** | ✅ Done | ADR-014 架构决策 |
| **AAV-678** | ✅ Done | addPosition 单 side 教训（bug fix） |
| **AAV-687** | ✅ Done | Step 1+2: Type/Hook/Logic 层 |
| **AAV-688** | ✅ Done | Step 3+4: UI Layer + Cleanup |
| **AAV-704** | ✅ Done | [Cleanup] 删除 PortfolioPosition + 废弃模块 + 浏览器验证 |

## 关键设计决策（ADR-014）

- supply/borrow **永远非 null** — 编译时保证不可分性
- disabled 状态从 reserve 运行时属性派生（`isSupplyDisabled`/`isBorrowDisabled`），不持久化
- `positionId` 消除，所有操作用 `(reserveId, side)` 定位
- API surface 14→10:
  - 新增: `addReserve`, `updateReserve(reserveId, patch, price?)`, `hideReserve`, `unhideReserve`, `importReserves`, `restoreToWallet(reserveId, side?)`, `removeHiddenEntries`
  - 删除: `addPosition`, `removePosition`, `toggleHidden`, `restorePosition`, `updateAmount`, `updateDeltaSign`, `updateInputMode`, `importPositions`, `hideOrRemoveReserveAction`, `unhideReserveAction`
- `ReservePatch`: `{ supplyAmount?, supplyInputMode?, supplyDeltaSign?, borrowAmount?, borrowInputMode?, borrowDeltaSign? }`
- `PortfolioPositionResult` 保持 per-side（数学语义不同），key 改为 `(reserveId, side)`
- Snapshot 无迁移（仅内存，无 localStorage）

## Hook 新 API Surface

```ts
interface PortfolioSimulationActions {
  setActive(active: boolean): void;
  addReserve(params: { reserveId, marketName, chainName, tokenSymbol }): void;
  removeReserve(reserveId: string): void;
  updateReserve(reserveId: string, patch: ReservePatch, priceInUsd?: number): void;
  hideReserve(reserveId: string): void;
  unhideReserve(reserveId: string): void;
  importReserves(entries: PortfolioReserveEntry[]): void;
  restoreToWallet(reserveId: string, side?: PortfolioSide): void;
  removeHiddenEntries(): number;
  clearAll(): void;
  saveSnapshot(label: string, results?: PortfolioPositionResult[], summary?: PortfolioSummary): void;
  deleteSnapshot(snapshotId: string): void;
  undoLastRemove(): boolean;
}
```

---

## 阶段 1: Bug Fix + ADR (AAV-637/678) — ✅

- `usePortfolioToggle.handlePortfolioToggle(side)` 修复：添加指定 side 时自动补全另一侧
- ADR-014 完整设计，经 12 个 grill 决策点确认
- docs: design-principles §7、CONTEXT.md Supply-Borrow Inseparability、AGENTS.md High-Risk Areas

---

## 阶段 2: Type/Hook/Logic 层 (AAV-687) — ✅  [`16d8e6a0`]

| 改动 | 文件 | 说明 |
|---|---|---|
| 类型定义 | `src/types/portfolio.ts` | `PortfolioReserveEntry`/`PortfolioSideData`/`ReservePatch`；`PortfolioPosition` 标记 @deprecated |
| Hook 重写 | `src/hooks/usePortfolioSimulation.ts` | `entries` 主状态；7 个 entry-level action + `mergeEntriesWithDelta` |
| `convertWalletPositionsToEntries` | `src/lib/walletPositionToPortfolio.ts` | 新增 entry 级转换 |
| `useWalletAutoImport` | `src/hooks/useWalletAutoImport.ts` | 改调 `importReserves` + `convertWalletPositionsToEntries` |
| `usePortfolioToggle` | `src/hooks/reserves-table/usePortfolioToggle.ts` | 新增 `entries` prop 优先驱动，`addReserve` 替代 `addPosition` |

---

## 阶段 3: UI Layer + Cleanup (AAV-688) — ✅  [`edacaea9`..`88196cab`]

| 改动 | 文件 | 说明 |
|---|---|---|
| PortfolioPanel | `PortfolioPanel.tsx` | `positions` → `entries`；`sortEntriesByHidden` 替代 `sortPositionsByHidden` |
| PortfolioTokenRow | `PortfolioTokenRow.tsx` | `entry: PortfolioReserveEntry` + `actions` prop |
| PortfolioResultsTable | `PortfolioResultsTable.tsx` | `entries` map 按 reserveId 查找 |
| ReservesTable | `ReservesTable.tsx` | `portfolioEntries` |
| ~~`getSideSyncState`~~ | ~~`portfolioWalletSync.ts`~~ | ~~新增 entry 级 sync state~~ — 已删除，wallet sync indicator 移除 |
| `sortEntriesByHidden` / `getEntrySoftDeleteAction` | `portfolioSoftDelete.ts` | 新增 entry 级函数 |
| `buildPerReserveInputsFromEntries` | `portfolioSimulator.ts` | 新增 entry 级 per-reserve input 构建 |

---

## 阶段 4: 最终清理 (AAV-704) — ✅  [`b245f1d5`..`a2362f35`]

| 改动 | 文件 | 说明 |
|---|---|---|
| 删除 `PortfolioPosition` 类型 | `portfolio.ts` | 整个 interface 删除 |
| 删除 `entriesToPositions` + `positions` 派生 | `usePortfolioSimulation.ts` | 不再有 position 层转换 |
| 删除 10 个 deprecated actions | `usePortfolioSimulation.ts` | addPosition/removePosition/updateAmount/updateDeltaSign/updateInputMode/importPositions/restorePosition/toggleHidden/hideOrRemoveReserveAction/unhideReserveAction |
| 删除 re-exports | `usePortfolioSimulation.ts` | resolvePositionAmountUsd/buildPortfolioPositionResult |
| 迁移 `portfolioCalculator` | `portfolioCalculator.ts` | `resolvePositionAmountUsd(PortfolioSideData, reserve)` + `buildPortfolioPositionResult(reserveId, side, ...)` |
| 迁移 `portfolioSimulator` | `portfolioSimulator.ts` | `simulatePortfolioFromEntries`（仅入口）；内部用 `SideSlot`/`EntryGroup` |
| 删除 `simulatePortfolioPositions` | `portfolioSimulator.ts` | deprecated 入口已彻底删除 |
| 迁移 `usePortfolioToggle` | `usePortfolioToggle.ts` | 删除 `entriesToPositionsForToggle`，改调 `simulatePortfolioFromEntries` |
| 删除 `portfolioMerger.ts` | — | 文件 + 2 个测试文件删除 |
| 删除废弃函数 | `portfolioSoftDelete.ts` | sortPositionsByHidden/getSoftDeleteAction/getGroupSoftDeleteAction/hideOrRemoveReserve/unhideReserve |
| ~~`getWalletSyncState`~~ | ~~`portfolioWalletSync.ts`~~ | ~~被 `getSideSyncState` 取代~~ — 整个文件已删除 |
| 删除 `convertWalletPositionsToPortfolio` | `walletPositionToPortfolio.ts` | 被 `convertWalletPositionsToEntries` 取代 |
| 更新 architecture-guard | `architecture-guard.test.ts` | 10 条 guard 确保旧 API 不会回归 |
| 更新 ADR-014 status | `0014-*.md` | Accepted → Completed |
| 更新 CONTEXT.md | `CONTEXT.md` | `PortfolioPosition` 标记已删除 |
| 更新 AGENTS.md | `AGENTS.md` | addPosition 教训 → addReserve 类型保证说明 |

---

## 最终文件状态

### ✅ 全部使用 entries 驱动（无 PortfolioPosition 残留）

- `src/types/portfolio.ts` — PortfolioReserveEntry/PortfolioSideData/ReservePatch/PortfolioPositionResult
- `src/hooks/usePortfolioSimulation.ts` — entries 主状态 + 10 entry actions
- `src/lib/walletPositionToPortfolio.ts` — convertWalletPositionsToEntries
- `src/hooks/useWalletAutoImport.ts` — importReserves
- `src/hooks/reserves-table/usePortfolioToggle.ts` — entries prop + simulatePortfolioFromEntries
- `src/components/dashboard/PortfolioPanel.tsx` — entries 迭代
- `src/components/dashboard/PortfolioTokenRow.tsx` — entry prop + actions prop
- `src/components/dashboard/PortfolioResultsTable.tsx` — entries map
- `src/components/dashboard/ReservesTable.tsx` — portfolioEntries
- `src/pages/Index.tsx` — convertWalletPositionsToEntries + importReserves
- `src/lib/portfolioCalculator.ts` — resolvePositionAmountUsd(PortfolioSideData) + buildPortfolioPositionResult(reserveId, side, ...)
- `src/lib/portfolioSimulator.ts` — simulatePortfolioFromEntries + buildPerReserveInputsFromEntries
- ~~`src/lib/portfolioWalletSync.ts`~~ — ~~getSideSyncState~~ — 已删除
- `src/lib/portfolioSoftDelete.ts` — sortEntriesByHidden / getEntrySoftDeleteAction

### ❌ 已删除文件/类型

- `PortfolioPosition` interface
- `portfolioMerger.ts` + `portfolioMerger.test.ts` + `portfolioMerger.actions.test.ts`
- `PortfolioPositionRow.tsx`
- `convertWalletPositionsToPortfolio` / `getWalletSyncState` / `sortPositionsByHidden` / `getSoftDeleteAction` / `getGroupSoftDeleteAction` / `hideOrRemoveReserve`(旧) / `unhideReserve`(旧)
- `getSideSyncState` / `portfolioWalletSync.ts` — wallet sync indicator 已删除
- `buildPerReserveInputs`(旧, position-based) / `simulatePortfolioPositions` / `SimulatePortfolioPositionsArgs`
- `entriesToPositions` / `positions` 派生 / 10 个 deprecated actions

---

## Architecture Guards (10 条)

1. PortfolioPanel uses `entries` prop (not `positions`)
2. PortfolioTokenRow uses `entry` prop (not `supplyPosition/borrowPosition`)
3. PortfolioResultsTable uses `entries` prop (not `positions`)
4. PortfolioSnapshot.entries is required (`positions` field removed)
5. `PortfolioPosition` interface does not exist in non-test source
6. `portfolioMerger.ts` file does not exist
7. ~~`getWalletSyncState` does not exist in portfolioWalletSync~~ — `portfolioWalletSync.ts` does not exist
8. `convertWalletPositionsToPortfolio` does not exist
9. `simulatePortfolioPositions` does not exist
10. `entriesToPositions` does not exist in usePortfolioSimulation

---

## 注意事项

- Supply-Borrow 不可分：添加/移除 token 必须同时操作 supply+borrow（见 design-principles §7）
- `PortfolioReserveEntry` 从类型层面保证不可分；`addReserve` 总是创建 supply+borrow 两侧
