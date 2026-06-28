# Phase 7: Reserve Table Offset 规则改造

> Issue: AAV-1023 + AAV-1024
> 前置: AAV-1022（offset 规则定义，当前 Needs Info）
> 估计: 1-2 session

## 问题

Portfolio 模式下 borrow incentive 被 offset 归零后，Reserve table 单行仍显示未 offset 的值，与 Portfolio 视图矛盾。

## 改动方向

- 按 AAV-1022 定义的统一 offset 规则改造 Reserve table 展示逻辑
- 处理 borrow incentive 在 portfolio-level offset 后归零的展示
- 明确单行行内值与 portfolio 聚合结果的关系
- 同步 Shared scenario 与验收用例到新口径

## 阻塞

AAV-1022（offset 规则定义）尚未确定。此 phase 无法在规则确定前启动。

## Grill 要点

- 等 AAV-1022 完成后再拆
- 可能需要拆成 2 个 session：1023（改造）+ 1024（同步）
