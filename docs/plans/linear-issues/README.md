# Linear Issue 开发方案索引

本文档汇总了 Linear aaveapy 工作区中所有 80 个待完成 Issue 的开发方案。方案已按照影响范围分别保存到前端和后端仓库中。

## 方案存放位置

| 仓库 | 路径 | 数量 |
|------|------|------|
| aaveapy (lovable) | `docs/plans/linear-issues/` | 41 (+ 5 归档至 completed/) |
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
| AAV-187 | V4 fallback 层级不匹配修复 | 已实现：编译期 ban 类型 + V4-aware 派生函数 + 防回归测试 |

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

## 执行优先级路线图

按价值/风险/依赖排序，分 5 个阶段推进：

### P0 — 基础设施 & 紧急修复（立即执行）

| Issue | 标题 | 复杂度 | 理由 |
|-------|------|--------|------|
| AAV-118 | 环境配置校验 | Low | 基础设施：生产缺配置会误调 staging，一行改动 |
| AAV-329 | 建立自动告警 SOP | Low | 18 个 smoke test 告警无统一管理，流程先行 |
| AAV-134 | V4 合约地址传递方案评估 | Low | 决策先行：评估结果影响后续 V4 开发方向 |
| AAV-135 | V4 SDK Embedded Rewards 文档 | Low | 补充被跳过功能的文档说明 |

### P1 — 数据层核心（数据可信性 & V4 完善）

| Issue | 标题 | 复杂度 | 理由 |
|-------|------|--------|------|
| Epic→AAV-74→72→73→79 | 市场宏观指标聚合 | Medium | 分层指标框架，Epic 包含 4 个子 Issue |
| AAV-189 | Hub 数据展示 | Medium | V4 架构核心字段，AAV-187 ✅ 后的自然下一步 |
| AAV-90 | Reserve 历史数据 | Medium | 后端 DB+API，历史数据层瓶颈 |
| AAV-261 | Oracle price 对比报警 | Medium | 价格偏差影响决策可信性 |
| AAV-81 | Reward Token 图标 | Medium | 前端体验直接提升 |

### P2 — 前端展示 & 历史可视化（依赖 P1 数据层）

| Issue | 标题 | 复杂度 | 依赖 |
|-------|------|--------|------|
| AAV-344 | Reserve Snapshots 历史趋势 | Medium | 后端 /api/markets/history |
| AAV-262 | TVL 历史展示 | Medium | 数据库迁移 |
| AAV-93 | V3/V4 统一展示重设计 | Medium | AAV-189 |
| AAV-75 | Size/Liquidity 变化趋势 | Medium | AAV-139, updateScheduler |
| AAV-301 | 交互卡顿性能优化 | Medium | AAV-83 |
| AAV-83 | 移动端滑动卡顿 | Medium | AAV-301 |

### P3 — 高级功能 & 安全性（依赖基础层完成）

| Issue | 标题 | 复杂度 | 依赖 |
|-------|------|--------|------|
| AAV-91 | APY 预测 | Medium | AAV-69/68, AAV-301 |
| AAV-107 | APR 币价波动影响 | Medium | AAV-261 |
| AAV-333 | Risk Premium Simulation | Medium | 钱包连接, V4 fetcher |
| AAV-84 | 推荐 reserve | Medium | AAV-91 |
| AAV-85 | 最佳跨链桥推荐 | Medium | 跨链数据源 |
| AAV-88 | 跨链退出路径/时间 | Medium | AAV-89/85 |
| AAV-89 | 链安全性展示 | Medium | 安全数据源 |
| AAV-86 | 资产部署辅助 | Medium | onchainDataService |
| AAV-87 | swap 后存储 | Medium | 用户身份体系 |
| AAV-127 | Liquidity 页面 | Medium | /api/markets |
| AAV-129 | Collateral 使用率 | Medium | 数据库, V4 数据方案 |
| AAV-130 | 资产集中度 | Medium | on-chain 数据 |
| AAV-139 | 历史 Campaign 链接 | Medium | 数据库迁移 |
| AAV-76 | 对比 DefiLlama 数据覆盖 | Medium | — |

### P4 — 代码清理 & 无障碍（机会式执行 / 长期工程）

| Issue | 标题 | 复杂度 | 依赖 |
|-------|------|--------|------|
| AAV-113 | src/lib 精简重构 | Medium | AAV-91 |
| AAV-172 | 清理未使用数据层字段 | Medium | AAV-189 |
| AAV-173 | SimulationSubRow 死代码清理 | Medium | AAV-144, AAV-113 |
| AAV-321 | 整理无障碍规范文档 | Medium | — |
| AAV-322 | 无障碍审计 + 问题清单 | Medium | AAV-321 |
| AAV-323 | 修复重点组件无障碍 | Medium | AAV-322 |
| AAV-248 | 全站无障碍推进 | High | AAV-321/322/323 |

### 已完成 ✅

| Issue | 标题 |
|-------|------|
| AAV-187 | V4 fallback 层级不匹配修复 |

### 依赖链总览

```
P0: AAV-118 → AAV-329
         AAV-134 → AAV-135

P1: Epic(AAV-74→72→73→79) → AAV-75
    AAV-189 → AAV-93
    AAV-90 → AAV-344 → AAV-262

P2: AAV-301 → AAV-83

P3: AAV-91 → AAV-107
         → AAV-84
    AAV-85 → AAV-88

P4: AAV-321 → AAV-322 → AAV-323 → AAV-248
    AAV-113 → AAV-173
```
