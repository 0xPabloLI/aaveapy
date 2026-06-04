# Handoff: AAV-325 后续工作

## 已完成（本 session）

1. **后端 Swagger UI** — 已 commit 到 `aave-protocol-analysis` 的 `railway` 分支（`1d7e920`）
   - `backend/src/routes/swagger.ts`：`GET /api/docs` + `GET /api/docs/openapi.json`
   - `backend/src/server.ts`：挂载 swaggerRouter
   - `backend/static/openapi.json`：从前端复制的 spec
   - `backend/static/swagger.html`：Swagger UI HTML
   - **注意**：commit 只在本地，未 push

2. **Linear issues 关闭**：AAV-113(Canceled)、AAV-129(Done)、AAV-325(Done)

3. **Plan 文档更新**：前端和后端仓库各有一份更新后的 `aav_325_plan.md`

4. **Grill-with-docs 决议**：已更新 plan 文档，精简 scope

## 待完成

### 1. Push 后端 commit
```bash
cd /Users/pabloli/Documents/code/aave-protocol-analysis
git push
```

### 2. 验证 Swagger UI 可访问
- 启动后端 dev server
- 访问 `http://localhost:<port>/api/docs` → 应显示 Swagger UI
- 访问 `http://localhost:<port>/api/docs/openapi.json` → 应返回 JSON
- 确认 Railway 部署后 `backend/static/` 目录可用

### 3. 前端 CI 接入 openapi:check
- 在现有 CI workflow 中增加一步 `npm run openapi:check`
- 确保 Zod schema 变更时 `public/openapi.json` 同步，否则 CI 失败

### 4. generate-openapi.ts 文件头 JSDoc
- 加注释说明：用法、流程、CI 防护

### 5. 前端 plan 文档需 commit
- `/Users/pabloli/Documents/code/aaveapy/docs/plans/linear-issues/aav_325_plan.md` 已更新但未 commit

## 架构决议（grill-with-docs）

| 议题 | 决议 | 理由 |
|---|---|---|
| API 文档方向 | 前端驱动（维持现状） | 理想方向（后端驱动/共亨 spec）超出 scope，另开 issue |
| CI/CD 跨 repo 同步 | 不在本 scope | 方案 A 前提不成立，C 有风险，B 正确但 token 配置复杂 |
| 前端导航入口 | 不加 | 开发者工具，直接访问 URL 即可，不占 UI 空间 |
| 文档注释 | 代码内 JSDoc | 流程简单，无需独立文档 |

## 后续 issue（AAV-325 之外）

- **跨 repo CI 同步**：GitHub Actions workflow，前端 openapi.json 变更 → 自动 PR 到后端仓库（需 PAT token 配置）
- **共享 spec 仓库**：提取独立 repo（如 aave-api-spec），前后端都从中消费（架构重构）

## 关键文件位置

| 文件 | 仓库 |
|---|---|
| `backend/src/routes/swagger.ts` | aave-protocol-analysis |
| `backend/src/server.ts` | aave-protocol-analysis |
| `backend/static/openapi.json` | aave-protocol-analysis |
| `backend/static/swagger.html` | aave-protocol-analysis |
| `docs/plans/linear-issues/aav_325_plan.md` | 两个仓库各一份 |
| `src/lib/apiSchemas.ts` | aaveapy（OpenAPI schema 源头） |
| `scripts/generate-openapi.ts` | aaveapy（生成脚本） |
| `public/openapi.json` | aaveapy（前端 spec） |
| `public/swagger.html` | aaveapy（前端 Swagger UI） |
