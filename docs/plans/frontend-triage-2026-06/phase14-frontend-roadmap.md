# Phase 14: 前端功能扩展（长期 Roadmap）

> Issues: AAV-364, AAV-564, AAV-333+AAV-482, AAV-1071, AAV-248, AAV-512
> 估计: 长期，各子项独立
> Branch: 按子项分别创建

## 代码审查状态（2026-07-21）

各子项均无代码变更，维持 Backlog/Needs Info 状态。

## 子项清单

| Issue | 标题 | 优先级 | 代码现状 |
|-------|------|--------|----------|
| AAV-364 | [EPIC] 市场宏观指标聚合 — market size / liquidity / utilization / deficit | High | 无实现，需后端 API 支持 |
| AAV-564 | 计算多链组合下的最佳 deployment 推荐 | — | 无实现 |
| AAV-333+482 | Risk Premium Simulation（RP 计算 + Simulation 集成 + UI） | Needs Info | 无实现，依赖"连接钱包功能" project |
| AAV-1071 | hookType=17 HEALTH_FACTOR exclusion 显示 | Medium | 需检查 reserve 配置中 hookType 处理 |
| AAV-248 | 全站无障碍校验 | Low | 无系统化 a11y 审查 |
| AAV-512 | SEO GSC 提交所有 URL 收录 | Low | SEO 页面已有（AssetPage, DefiYieldTracker 等），GSC 提交是运维操作 |

## 说明

各子项无强依赖，可独立排期。AAV-333/482 依赖"连接钱包功能" project。各子项实现前需单独走 grill-with-docs → to-spec → to-tickets 流程。
