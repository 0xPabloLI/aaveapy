# Phase 3: ReserveIdentity 补全 — MobilePortfolioCard 接入 + 测试 + 文档

> Issues: AAV-1192, AAV-1193, AAV-1194
> 估计: 0.5 session
> Branch: `refactor/aav-1192-reserve-identity`
> 前置: AAV-1190 (T1) + AAV-1191 (T2) 已 Done

## 代码审查状态（2026-07-21）

### 已完成

- **T1 (AAV-1190)** — `hubName`/`hubId` 传递链完整：`addReserve` 签名有 `hubName?/hubId?`，`walletPositionToPortfolio` 已传递
- **T2 (AAV-1191)** — `ReserveIdentity` 已提取为共享组件，有 compact/stacked 两种 variant + 测试
- `PortfolioUnifiedTable` 已用 ReserveIdentity（通过 `PortfolioTokenRow`）
- `PopularTokenChip` 已用 ReserveIdentity
- `DesktopReserveRow` 有独立的 hub chip 实现（品红渐变 pill + 外链），与 ReserveIdentity 风格一致
- `MobileReserveCard` 有独立的 hub pill 实现（`data-testid="hub-pill"`，非交互 span，符合移动端规范）
- `SearchResultRow`（PortfolioPanel 内联）hubName 显示条件为 `hubName != null`

### 未完成

- **T3 (AAV-1192)** — `MobilePortfolioCard` 中 hubName 仍内联实现（第 229-234 行），未接入共享 ReserveIdentity 组件
  - **代码证据**：`MobilePortfolioCard.tsx:229` — `entry.hubName != null` 内联 chip，未引用 ReserveIdentity
  - **注意**：`MobileReserveCard` 和 `DesktopReserveRow` 的 hub 实现是独立于 ReserveIdentity 的（因交互需求不同），可能不需要统一到 ReserveIdentity
- **T4 (AAV-1193)** — ReserveIdentity.test.tsx 已存在，需确认覆盖所有 variant 场景
- **T5 (AAV-1194)** — 文档 + Linear 状态更新

## 改动方向

1. 评估 `MobilePortfolioCard` 是否值得替换为 ReserveIdentity（当前内联实现已符合移动端规范）
2. 若保留内联实现，则将 AAV-1192 范围缩小为"确认一致性 + 关闭"
3. 补全 ReserveIdentity 测试覆盖
4. 更新 CONTEXT.md / TERMINOLOGY.md

## 不在 Scope

- hubName/hubId 数据传递链（T1 已 Done）
- ReserveIdentity 组件本身（T2 已 Done）
- DesktopReserveRow / MobileReserveCard 的 hub chip（已有独立实现，交互需求不同）
