# 开发方案：AAV-325 - 自动生成 API 文档功能

## 1. Issue 概述
为项目添加 API 文档功能，提升文档维护效率和准确性，方便前后端协作和外部使用者理解接口。

## 2. 当前状态
- ✅ 前端已有完整 OpenAPI 链路：`src/lib/apiSchemas.ts` (Zod) → `scripts/generate-openapi.ts` → `public/openapi.json` → `public/swagger.html`
- ✅ 后端已挂载 Swagger UI：`/api/docs` serve Swagger UI，`/api/docs/openapi.json` serve spec（commit `1d7e920`）
- ⬜ 前端 CI 接入 `openapi:check`：确保 `public/openapi.json` 与 Zod schema 保持同步
- ⬜ 代码内注释：`generate-openapi.ts` 文件头加 JSDoc 说明用法

## 3. 影响范围
- 前端仓库：`aaveapy/lovable` — OpenAPI schema 定义 + 生成脚本 + CI 防护
- 后端仓库：`aave-protocol-analysis/railway` — serve Swagger UI + openapi.json（已完成）

## 4. 实现方案

### 4.1 后端 — 已完成
- 直接 serve 前端已有的 `openapi.json`，不在后端重新生成
- `backend/src/routes/swagger.ts`：`GET /api/docs` → swagger.html，`GET /api/docs/openapi.json` → spec
- `backend/src/server.ts`：挂载 `app.use('/api/docs', swaggerRouter)`
- `backend/static/openapi.json` + `backend/static/swagger.html`

### 4.2 前端 CI 防护 — 待做
- **目标**：前端 Zod schema 变更时，`public/openapi.json` 必须同步更新，否则 CI 失败
- **方案**：在现有 CI workflow 中增加一步运行 `npm run openapi:check`
- `openapi:check` 已定义：生成 openapi.json + `git diff --exit-code`，diff 非零则失败

### 4.3 代码内注释 — 待做
- 在 `scripts/generate-openapi.ts` 文件头加 JSDoc，说明：
  - 用法：`npm run openapi:generate` 重新生成 spec
  - 流程：修改 `apiSchemas.ts` 中的 Zod schema → 运行 `openapi:generate` → commit 生成的 `openapi.json`
  - CI 防护：`openapi:check` 在 CI 中验证一致性

## 5. 验收标准
- ✅ 后端 `/api/docs` 显示 Swagger UI
- ✅ 后端 `/api/docs/openapi.json` 返回有效 JSON spec
- ⬜ 前端 CI 中 `openapi:check` 通过（schema 变更时 openapi.json 同步）
- ⬜ `generate-openapi.ts` 有 JSDoc 说明用法

## 6. 复杂度评估
- **Small** — 剩余工作仅 CI 配置和文件注释，不涉及业务逻辑

## 7. 架构决议（grill-with-docs 记录）

### 7.1 API 文档方向：前端驱动（现状维持）
- 当前前端 `apiSchemas.ts` 是唯一 schema source of truth，后端只做 serve
- 理想方向（后端驱动 / 共享 spec 仓库）超出 AAV-325 scope，留作独立 issue

### 7.2 CI/CD 跨 repo 同步：不在本 scope
- 方案 A（monorepo 复制）：前提不成立（两个独立仓库）
- 方案 C（运行时拉取）：有缓存和可用性风险，否决
- 方案 B（GitHub Actions PR 到后端）：方向正确，但跨 repo token 权限配置复杂度高，另开 issue

### 7.3 前端导航入口：不加
- Swagger UI 是开发者工具，用户直接访问 `/swagger.html` 或后端 `/api/docs` 即可
- 不占 Header/Footer 空间

### 7.4 文档注释：代码内注释，不单独写文档
- 流程简单（改 Zod → generate → commit），JSDoc 足够
