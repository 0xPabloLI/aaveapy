# Size 列排序迁移到 Tooltip — 实现方案

## 目标

将 Size 列的 5 个排序子模式从 Header 下拉菜单迁移到 cell 级 tooltip 内。Header 简化为 "Size" + 排序方向箭头。

## 当前状态

```
Header:  [Size] [Supplied ▼]  ← Chip 下拉, 5 个子模式
Cell:    supply ring (hover → cap% detail tooltip)
         borrow ring (hover → cap% detail tooltip)
         deficit ring (hover → deficit% detail tooltip)
```

## 目标状态

```
Header:  [Size ↑↓]            ← 仅 label + 排序方向箭头
Cell:    supply ring (hover → Total supplied [↑↓] | Suppliable [↑↓] | Supply cap | % of cap [↑↓])
         borrow ring (hover → Total borrowed [↑↓] | Borrowable [↑↓] | Borrow cap | % of cap [↑↓])
         deficit ring (hover → Deficit [↑↓] | Total supplied | % of total [↑↓])
```

## 排序模式对照

| 排序模式 | 当前入口 | Target tooltip | 已有？ |
|---------|---------|---------------|-------|
| Supplied (supply) | Header 下拉 + Size 数字点击 | CapProgressRing "Total supplied" | ✅ onSortSupplySize |
| Suppliable (supplyAvailability) | Header 下拉 | CapProgressRing "Suppliable" | ❌ 待新增 |
| Borrowed (borrow) | Header 下拉 + Size 数字点击 | BorrowCapProgressRing "Total borrowed" | ✅ onSortBorrowSize |
| Borrowable (borrowAvailability) | Header 下拉 | BorrowCapProgressRing "Borrowable" | ❌ 待新增 |
| Deficit (deficitAmount) | Header 下拉 + Size 数字点击 | DeficitLiquidityRing "Deficit" | ✅ onSortDeficitAmount |
| Supply Cap% (supplyCapPct) | Tooltip 箭头 ✅ | CapProgressRing "% of cap" | ✅ Phase 3 |
| Borrow Cap% (borrowCapPct) | Tooltip 箭头 ✅ | BorrowCapProgressRing "% of cap" | ✅ Phase 3 |
| Deficit % (deficitRatio) | Tooltip 箭头 ✅ | DeficitLiquidityRing "% of total" | ✅ Phase 3 |

## 实施 Phase

### Phase 1: CapProgressContent — "Suppliable" sort arrow

- 在 "Available to supply" 行旁添加排序箭头
- 新增 `onSortSuppliable` callback prop + sort state props
- ReservesTable 中 wiring: `sizeSortMode = 'supplyAvailability'`

### Phase 2: BorrowCapProgressContent — "Borrowable" sort arrow

- 在 "Available to borrow" 行旁添加排序箭头
- 新增 `onSortBorrowable` callback prop + sort state props

### Phase 3: DeficitProgressContent — "Deficit" sort arrow

- 在 "Deficit" 行旁添加排序箭头 (deficitAmount sorting)
- 复用已有 `onSortDeficitAmount`

### Phase 4: Header 简化

- 移除 Size 列的 Chip 下拉按钮 + ChevronDown + DesktopSortMenuPortal
- Header 显示 "Size" label + ArrowDown/Up 方向指示
- 移除对应的 `showSizeSortMenu` state / `sizeSortButtonRef` / `sizeMenuPos` / `onToggleSizeMenu` / `onCloseSizeMenu`
- 移除 `sizeSortOptions` 数组

### Phase 5: No-cap 数字 tooltip

- 无 cap 的 supply/borrow 数字包裹在简单 tooltip 中，含 sort arrow

### Phase 6: 全量验证 + 清理

- lint + test + tsc --noEmit + build
- 确认 ReservesTableDesktopHeader.test.tsx 更新
- 确认 DesktopReserveRow.test.tsx 更新

## 进度

| Phase | 状态 | Commit |
|-------|------|--------|
| Phase 1: Suppliable sort arrow | ⏳ | — |
| Phase 2: Borrowable sort arrow | ⏳ | — |
| Phase 3: Deficit sort arrow in tooltip | ⏳ | — |
| Phase 4: Header 简化 | ⏳ | — |
| Phase 5: No-cap tooltip | ⏳ | — |
| Phase 6: 验证 + 清理 | ⏳ | — |