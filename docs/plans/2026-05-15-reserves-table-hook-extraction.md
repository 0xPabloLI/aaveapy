# ReservesTable Hook Extraction Plan

> **Status (2026-05-17)**: PR-1 ~ PR-6 全部完成。
> **Goal**: 把 `src/components/dashboard/ReservesTable.tsx` 的 state machine 拆到 `src/hooks/reserves-table/` 下的多个聚合 hook，主壳只剩组合 + JSX，**零外部 props / 零行为改变**。
> **Out of scope**: 不引入 `react-virtual`；不动 `DesktopReserveRow` / `MobileReserveCard` / 任何子组件；不改 a11y / 不改 sort 算法。

## 总进度

| | hook | 测试 | ReservesTable.tsx |
|---|---|---|---|
| 起点 (HEAD before PR-1) | — | — | **1967 行** |
| PR-1 done | `useReservesTableSort` | 14 测试 | 1830 (-137) |
| PR-2 done | `useReservesPagination` | 10 测试 | 1930（含 PR-1 后用户增量提交 `a808e0a`） |
| PR-3 done | `useReserveExpansion` | 12 测试 | 1912 |
| PR-4 done | `useSharedScenarioInputs` | 9 测试 | **1916** |
| PR-5 done | `useScenarioPinScroll` | — | 1658 |
| PR-6.1 done | `useReservesTooltip` | 8 测试 | 1632 |
| PR-6.2 done | `usePortfolioToggle` | 11 测试 | 1604 |
| PR-6.3 done | `useReservesLayoutRefs` | 7 测试 | **1566** |
| 累计 | 8 hooks + 7 tests = 15 文件 | 71 个新单测 | **-401 行**（vs HEAD 1967） |

> 行数没继续显著下降的原因：destructure 块比 inline state 略大；真正收益在 **关注点聚合**，不在行数。

## 已完成 PR 概要

### PR-1 `useReservesTableSort`
吸纳：13 个 sort `useState` + 4 个 button refs + 4 个 menuPos + 5 个 menu visibility flag + 4 个 dropdown 位置 useEffect + 8 个 sort handler + `closeAllMobileSortMenus` / `toggleMobileSortMenu`。

接口：`useReservesTableSort({ collapseExpanded })` → 返回所有 state / setter / handler。

> ⚠️ 用户在 commit `a808e0a fix: bidirectional sort-order toggle in dropdown menus, extract toggleSortOrder helpers` 上又对该 hook 做了增量（+118 行 ReservesTable / +134 行测试），属于功能扩展，与本 refactor 兼容。

### PR-2 `useReservesPagination`
吸纳：`minVisibleCount` state + 3 个自动扩 useEffect（scrollToReserveId / sortedData 清空 / expandedReserveId） + `displayData` useMemo + `showAll` 派生 + `showAllRows` / `resetVisibleCount` 回调；导出 `DEFAULT_VISIBLE_COUNT`。

接口：`useReservesPagination({ sortedData, scrollToReserveId, expandedReserveId })`。

### PR-3 `useReserveExpansion`
吸纳：`expandedReserveId` state + `suppressNextToggleReserveIdRef` + `collapseExpanded` + `handleToggleExpand` + suppression 自动清空 useEffect + mobile→desktop 折叠 useEffect。

接口：`useReserveExpansion({ isMobile })`。

`pendingMarketFilterPinReserveIdRef` 留在主组件（PR-5 处理）。

### PR-4 `useSharedScenarioInputs`
吸纳：`debouncedSharedSupplyInput` / `debouncedSharedBorrowInput` / `sharedInputMode` / `meritMerklNetPosition` / `mobileNetOpen` 5 个 useState + `handleMobileNetToggle` / `handleScenarioChange` / `handleCorrectSupplyInput` / `handleCorrectBorrowInput` 4 个 handler。

接口：`useSharedScenarioInputs({ scenarioControlsRef })`。

`expandScrollFollowsScenarioSort`（依赖 `hasSharedScenario` from `useSharedRateSimulations`）留在主组件。

### PR-5 `useScenarioPinScroll`（最复杂，refs 重灾区）
吸纳：
- `scenarioPinControllerRef` / `scenarioPinScheduleTokenRef` / `cancelScenarioPinScrollRef`（核心）
- `lastReservesKeyForFilterPinRef` / `cancelFilterPinScrollRef`（filter pin scroll）
- `pendingMarketFilterPinReserveIdRef` + `handleMarketChipClick`（与 expansion 协作）
- `schedulePinScrollToReserve` callback
- 「Simulation pin scroll」effect + 「Filter pin scroll」effect
- 卸载时清理 `cancelFilterPinScrollRef` / `cancelScenarioPinScrollRef` 的 useEffect
- 组件卸载前清空 `pendingMarketFilterPinReserveIdRef` 的 useEffect

接口：`useScenarioPinScroll({ reserves, sortedData, isMobile, expandedReserveId, setExpandedReserveId, minVisibleCount, defaultVisibleCount, hasSharedScenario, expandScrollFollowsScenarioSort, scenarioKey })` → `{ schedulePinScrollToReserve, handleMarketChipClick }`。

> ⚠️ 该 PR 触及 `docs/design/frontend-interaction-guardrails.md` § "Simulation pin scroll" 的 normative spec 行为，**绝对未改语义**，只搬位置。

### PR-6.1 `useReservesTooltip`
吸纳：`tooltipState` useState + `handleIncentiveClick` useCallback + `setTooltipState(null)` 的 close 路径（统一收口成 `closeTooltip`）。

接口：`useReservesTooltip()` → `{ tooltipState, setTooltipState, handleIncentiveClick, closeTooltip }`。

### PR-6.2 `usePortfolioToggle`
吸纳：`portfolioReserveIds` useMemo + `handlePortfolioToggle` useCallback + `portfolioResults` / `portfolioSummary` 计算 useMemo。同时清理主组件中的相关 imports（`getReserveKey` / `resolvePositionAmountUsd` / `buildPortfolioPositionResult` / `aggregatePortfolioSummary` / `PortfolioPositionResult` / `PortfolioSummary`）。

接口：`usePortfolioToggle({ isPortfolioMode, reserves, portfolioPositions, portfolioActions })` → `{ portfolioReserveIds, handlePortfolioToggle, portfolioResults, portfolioSummary }`。

### PR-6.3 `useReservesLayoutRefs`
吸纳：5 个 ref（`mobileTableRef` / `desktopTableCardRef` / `desktopTableBottomAnchorRef` / `desktopStickyScenarioRef` / `desktopStickyTheadRef`）+ `tableInView` useState + 1 个 `IntersectionObserver` effect（200px rootMargin，按 `isMobile` 切目标）+ 1 个 `ResizeObserver` effect（桌面端发布 `--reserves-sticky-scenario-height` / `--reserves-expanded-main-row-top` CSS 变量）。

接口：`useReservesLayoutRefs({ isMobile })` → `{ mobileTableRef, desktopTableCardRef, desktopTableBottomAnchorRef, desktopStickyScenarioRef, desktopStickyTheadRef, tableInView }`。

## 验证（每个 PR 都 4 项全绿）

```bash
npm run lint
npx tsc --noEmit
npm test -- --run
npm run build
```

测试基线：1967 行版本 1205 passed → PR-6 完成后 **1478 passed**（+273；含 71 个新 hook 单测 + 用户在 `a808e0a` / `b583a91` / `7a18c90` 等增量提交里追加的测试）。

## 验收（所有 PR 完成后）✅

- ✅ `ReservesTable.tsx`：1967 → **1566 行**（-401 行 / -20%）；未达 ≤700 行的极限目标，因为 mobile sort options 有 ~250 行 JSX-config 不动，且主壳还有 ~700 行 sort-comparator JSX-config + scenario controls JSX 留下。真正收益是关注点拆分（8 个聚合 hook）。
- ✅ 所有现有测试不改一行就通过
- ✅ `npm run lint && npx tsc --noEmit && npm test && npm run build` 全绿
- ✅ 每个新 hook 都有单测覆盖关键状态转换（PR-5 走集成路径覆盖，PR-6.* 各自 7~11 个单测）

## 不做（划清边界）

- ❌ 不引入 `react-virtual`
- ❌ 不动子组件 / props
- ❌ 不改 sort 算法或 pagination 行为
- ❌ 不重写 mobile sort options 的 250 行 JSX-config（保留在主壳里）
- ❌ 不动 CSS / filter-chip / FilterBar / segmented-toggle —— 这些与本 refactor 无关

## 重要外部约束

- **Git safety**: 不跑 `git stash`/`checkout`/`reset --hard` 等命令（除非用户当面确认）
- **Hook policy**: 不绕过 pre-commit / pre-push hook
- **AGENTS.md 高风险区域**: `ReservesTable*` / `DesktopReserveRow*` / `MobileReserve*` / `useRateSimulation` —— 改动后必须跑全套 4 项验证 + 视情况触发 `docs/conventions/frontend-regression-checklist.md`
- **并行 agent**: 工作树里出现的非我改动一律不还原（PR-1 后用户已在 `a808e0a` 上增量提交）
