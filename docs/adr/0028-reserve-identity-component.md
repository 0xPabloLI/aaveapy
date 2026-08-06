# ADR-0028: ReserveIdentity 共享组件与内联实现边界

## Date

2026-07-28

## Status

Accepted

## Context

Phase 3 (AAV-1188) 要求所有 Portfolio UI 表面接入 `ReserveIdentity` 共享组件以统一 V4 hubName 显示。`ReserveIdentity`（`src/components/primitives/ReserveIdentity.tsx`）提供 `compact`（行内水平）和 `stacked`（垂直两行）两种 variant。

### 已接入的表面

| 表面 | Variant | 状态 |
|------|---------|------|
| `PortfolioUnifiedTable`（桌面端 Portfolio table） | `stacked` | ✅ 通过 `PortfolioTokenRow` |
| `PopularTokenChip`（PortfolioPanel 推荐 token chip） | `compact` | ✅ |
| `SearchResultRow`（PortfolioPanel 搜索结果行） | `compact` | ✅ |

### 保留内联实现的表面

| 表面 | 原因 |
|------|------|
| `DesktopReserveRow` | 独立 hub chip 实现：可点击 filter 按钮 + Aave V4 外链，交互需求超出 ReserveIdentity 的 display-only 范围 |
| `MobileReserveCard` | 独立 hub pill 实现：`data-testid="hub-pill"` 非交互 span，移动端规范要求 |
| `MobilePortfolioCard` | 水平右侧 pill 布局（`ml-auto`）与 ReserveIdentity 的 compact/stacked variant 根本不同；内联实现已符合移动端规范（非交互 span，无 hover，触控目标通过父级 button 满足 ≥44px） |

## Decision

**不强制所有 UI 表面统一到 `ReserveIdentity`。** 共享组件用于布局/交互需求一致的表面（Portfolio 表格行、chip、搜索结果）；布局或交互需求不同的表面保留独立实现。

### 判定标准

1. **布局兼容**：如果现有布局与 ReserveIdentity 的 compact/stacked variant 结构不兼容，保留内联
2. **交互需求**：如果 hub chip 需要交互（可点击 filter、外链导航），保留独立实现
3. **一致性**：即使保留内联，也使用相同的视觉语义（`getHubChipClass(isV4Market(marketName))`、品红色 V4 渐变、`title="Hub: {name}"`）

## Consequences

- `ReserveIdentity` 保持轻量（display-only），不需要为每种布局添加新 variant
- 三个独立实现的表面（DesktopReserveRow、MobileReserveCard、MobilePortfolioCard）各自维护 hub chip 逻辑，但共享视觉语义（`getHubChipClass`）
- 测试覆盖：ReserveIdentity 组件测试覆盖共享 variant；各独立实现的表面有各自的 hub chip 可见性测试
- 未来新增 Portfolio 表面时，优先评估是否可用 ReserveIdentity；如果不兼容再走内联路径
