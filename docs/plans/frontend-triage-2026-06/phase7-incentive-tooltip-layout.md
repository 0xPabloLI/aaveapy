# Phase 7: IncentiveTooltip RecentlyEnded Section 布局统一

> Issue: AAV-1096 (Backlog, 部分完成)
> 估计: 0.5 session
> Branch: `ui/aav-1096-tooltip-layout`
> Linear 状态: Backlog

## 代码审查状态（2026-07-21）

### 已完成

- IncentiveTooltip 主体已从 `grid grid-cols-[1fr_5rem]` 改为 flex 布局
- 测试已验证主体 flex 布局（`IncentiveTooltip.test.tsx:1073-1074` 断言不含 `grid-cols-[1fr_5rem]`）

### 未完成

RecentlyEnded section 仍残留两处 `grid grid-cols-[1fr_5rem]`：

```tsx
// IncentiveTooltip.tsx 第 339 行 — source header row
<div className="grid grid-cols-[1fr_5rem] items-center gap-x-[var(--ds-space-1-5)] mb-[var(--ds-space-1)]">

// IncentiveTooltip.tsx 第 381 行 — campaign row
<div className="ds-tooltip-body grid grid-cols-[1fr_5rem] items-start gap-x-[var(--ds-space-1-5)] text-zinc-400">
```

## 改动方向

1. 将 RecentlyEnded section 的两处 `grid grid-cols-[1fr_5rem]` 改为 flex + `ml-auto`
2. 与主体 IncentiveSourceRow 布局保持一致
3. 更新测试（当前测试 `IncentiveTooltip.test.tsx:1073-1074` 断言 RecentlyEnded 不含 `grid-cols-[1fr_5rem]`，但实际代码仍包含——说明测试可能未覆盖到这两行，或测试写法有误需修复）

## 代码证据

- `IncentiveTooltip.tsx:339` — source header row 仍为 grid
- `IncentiveTooltip.tsx:381` — campaign date row 仍为 grid
- `IncentiveTooltip.test.tsx:1073-1074` — 测试断言不含 grid，但需确认测试是否实际覆盖到 RecentlyEnded section

## 注意

- 测试和代码不一致：测试断言不含 `grid-cols-[1fr_5rem]`，但代码第 339/381 行仍包含。需要先确认测试为什么能通过（可能测试只覆盖了 Active section 而非 RecentlyEnded），然后修复测试 + 代码。
