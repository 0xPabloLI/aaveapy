# Linear Issue 开发方案索引

本文档汇总了 Linear aaveapy 工作区中所有 80 个待完成 Issue 的开发方案。方案已按照影响范围分别保存到前端和后端仓库中。

## 方案存放位置

| 仓库 | 路径 | 数量 |
|------|------|------|
| aaveapy (lovable) | `docs/plans/linear-issues/` | 42 (+ 4 归档至 completed/) |
| aave-protocol-analysis (railway) | `docs/plans/linear-issues/` | 10 |

注：涉及前后端的 Issue（target=both）会同时存放在两个仓库中。

## 已解决的 Issue

以下 Issue 经代码检查确认已在当前代码中实现：

| Issue | 标题 | 说明 |
|-------|------|------|
| AAV-121 | 添加 OpenAPI 文档和 Postman 集合 | 已实现：scripts/generate-openapi.ts, public/openapi.json, public/swagger.html |
| AAV-122 | 增加前后端传输的压缩方案 | 已实现：后端 server.ts 使用 compression 中间件 (gzip) |
| AAV-124 | 增加 sort by supply%，sort by borrow% | 已实现：supplyCapPct/borrowCapPct 排序模式 |
| AAV-143 | 在 market filter 里面加 search markets | 已取消：功能已由 FilterBar searchQuery 覆盖，Linear 标记 Canceled |
| AAV-174 | 移除 V4 spoke 无消费字段 | 已实现：spokeName 移除，spokeId/spokeAddress 已消费 |

## Issue 分类统计

| 类别 | 数量 | 说明 |
|------|------|------|
| Smoke Test 告警 | 18 | 自动化部署失败告警，需统一 SOP 管理 |
| 功能开发 | 42 | 新功能需求 |
| 代码清理/重构 | 8 | 技术债务清理 |
| 文档/规范 | 6 | 文档和规范建设 |
| 性能优化 | 3 | 前端性能问题 |
| 运维/营销 | 3 | SOP、Twitter 等非开发任务 |

## 复杂度分布

| 复杂度 | 数量 | 典型 Issue |
|--------|------|-----------|
| Low | ~15 | 代码清理、文档、环境校验 |
| Medium | ~40 | 功能开发、性能优化、V4 支持 |
| High | ~25 | 钱包连接、历史数据、跨链功能、版本切换 |

## 关键依赖链

许多 Issue 存在依赖关系，建议按以下顺序推进：

1. **基础设施层**：AAV-116 (Error Boundary) → AAV-118 (环境校验) → AAV-329 (告警 SOP)
2. **钱包连接层**：AAV-66/106/105 (白名单/黑名单) ✅ → AAV-69/68 (Merkl/net lending) ✅ → AAV-67 (读取 portfolio) ✅ 已覆盖 → AAV-62 (手动导入) ❌ Canceled → AAV-80 (position/liquidity) ✅
3. **历史数据层**：AAV-344/262/90 (历史数据获取) → AAV-75 (趋势变化) → AAV-91 (APY 预测)
4. **V4 完善层**：AAV-170 (V4 deficit) → AAV-187 (fallback 修复) → AAV-189 (Hub 数据)
5. **高级功能层**：AAV-84 (推荐 reserve) → AAV-85/87/86 (跨链/swap/部署)
