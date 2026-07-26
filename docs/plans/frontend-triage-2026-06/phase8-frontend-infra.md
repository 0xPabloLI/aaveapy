# Phase 8: 前端基础设施 + 样式统一 + 性能

> Issues: AAV-1104, AAV-734, AAV-1095, AAV-783, AAV-1141
> 估计: 2 sessions
> Branch: `refactor/aav-1141-frontend-infra`

## 代码审查状态（2026-07-21）

### Issue 状态清单

| Issue | Linear 状态 | 代码现状 |
|-------|------------|----------|
| AAV-1104 | Backlog | URL 仍用 query string `?chain=xxx&category=xxx&search=xxx`（`Index.tsx:198-268`） |
| AAV-734 | Ready for agent | `PortfolioPanel.tsx:174` 用 `destructive` token；PortfolioTokenRow 已被 UnifiedTable 替代；`button.tsx` 有 shadcn 默认 `destructive` variant |
| AAV-1095 | Backlog | `apiSchemas.ts` 仍手写 Zod schema，未从 `public/openapi.json` 生成 |
| AAV-783 | Ready for agent | memory leak 修复在 `railway` 分支，未合并到 main/production（backend issue） |
| AAV-1141 | Backlog | 无 Lighthouse 分析，无性能优化 |

### 各 Issue 详细状态

#### AAV-1104 — URL query string 优化

- **当前**：`Index.tsx` 使用 `setSearchParams` 维护 `?chain=&category=&search=` query string
- **目标**：去掉 `?`，改为 path params 或 hash
- **复杂度**：需要重构路由 + 向后兼容旧 URL
- **代码证据**：`Index.tsx:241-250` — `setSearchParams` 双向同步

#### AAV-734 — 统一 destructive hover 样式

- **当前**：`PortfolioPanel.tsx` 已用 `destructive` 语义 token（`hover:text-destructive hover:bg-destructive/10`）
- **PortfolioTokenRow 已被 UnifiedTable 替代** — 原 `text-red-500` 代码可能已不存在
- **需确认**：`portfolioTheme.ts` 是否有共享 destructive hover token
- **代码证据**：`PortfolioPanel.tsx:174` — `hover:text-destructive hover:bg-destructive/10`

#### AAV-1095 — Unify frontend Zod schemas

- **当前**：`apiSchemas.ts` 手写 Zod schema，独立于 `public/openapi.json`
- **已有**：`openapi:fetch` CI 从 staging API 拉取 spec；`openapi:check` 检测漂移
- **缺失**：从 spec 生成 Zod schema 的 pipeline
- **代码证据**：`src/lib/apiSchemas.ts` + `public/openapi.json` + `scripts/generate-openapi.ts`

#### AAV-783 — Memory leak 验证（backend）

- **当前**：5 个 memory leak 修复 commit 在 `railway` 分支，未合并到 main
- **这是 backend issue**，前端 plan 中仅做跟踪
- **阻塞**：需要后端 PR railway → main

#### AAV-1141 — 前端页面加载速度

- **当前**：无 Lighthouse 分析记录，无性能优化措施
- **需要**：先做 Lighthouse 分析确定瓶颈，再针对性优化

## 改动方向

1. **AAV-1104** — URL query string → path params 或 hash（与 Phase 5 有重叠，建议合并）
2. **AAV-734** — 审查全项目 `hover:bg-red` / `hover:text-red`，统一为 `destructive` token；在 `portfolioTheme.ts` 抽象共享样式
3. **AAV-1095** — 评估 OpenAPI codegen 工具（openapi-zod-client / orval），从 spec 生成前端 Zod schema
4. **AAV-783** — 跟踪 backend PR 进度（不在前端 scope 内）
5. **AAV-1141** — Lighthouse 分析 + 性能优化（code splitting / lazy load / bundle size）

## Grill 要点

- AAV-1095 Zod schema 统一方案：OpenAPI codegen vs 手动同步？
- AAV-1141 先做 Lighthouse 分析确定瓶颈
- AAV-1104 与 Phase 5 (AAV-755) 有重叠——URL 路由重构应一起做
