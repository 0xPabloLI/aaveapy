# Frontend-Backend Coordinated Deployment Workflow

## Overview

本文档定义 AaveAPY 前后端协同部署的最佳实践工作流，确保前后端 API 契约一致性，实现零停机的无缝过渡。

## 核心原则

1. **Backend as Source of Truth**：后端 TypeScript 类型是 API 契约的唯一来源，通过自动化工具生成 OpenAPI spec 和前端 Zod schemas。
2. **Staging-First Approach**：所有变更先在 staging 验证，确认无误后再同步到 production。
3. **Seamless Handoff**：前端 production 部署时暂时连接 staging API，确保 API 升级前后前端始终有可用的后端。
4. **Forward Compatible**：前端使用 `.strip()` 模式，忽略后端新增字段；后端保持向后兼容，不删除或重命名字段。

## 分支策略

| Branch | Environment | Role |
|--------|-------------|------|
| `railway` | Staging | 后端 staging，包含所有最新变更 |
| `main` | Production | 后端 production，稳定版本 |
| `lovable` | — | 前端开发分支（GPT-engineer） |
| `dev` | — | 前端集成分支（lovable → dev → main） |

## 部署流程

> **注意**：`AGENTS.md` 中的"标准上线流程 (Production Deployment Checklist)"已将本工作流的 5 步流程整合为统一的 Step 1-5。本文件保留作为详细参考文档。

### Phase 1: Backend Staging Update

1. **后端开发者**在 `railway` 分支进行开发
2. **CI 验证**：GitHub Actions 运行 `ci.yml`，包括：
   - `security-audit`（continue-on-error）
   - `build-and-prune`
   - `socket-firewall`
3. **Railway 部署**：CI 通过后自动部署到 staging
4. **验证**：手动检查 staging API spec (`https://staging-api.aaveapy.com/api/docs/openapi.json`)

### Phase 2: Frontend Staging Sync

1. **前端开发者**从 staging API 拉取最新 spec：
   ```bash
   LIVE_API_BASE=https://staging-api.aaveapy.com/api npm run openapi:fetch
   ```
2. **生成 Zod schemas**：
   ```bash
   npm run schema:codegen
   ```
3. **更新 wrapper 引用**（如需要）：检查 `src/shared/market-contract/schemas.ts` 和 `src/lib/apiSchemas.ts` 中的 `generated.*` 引用是否需要更新
4. **验证**：运行完整 validation gate：
   ```bash
   npm run lint && npm test && npm run build && npx tsc --noEmit
   ```
5. **提交**：
   ```bash
   git add public/openapi.json src/generated/api/schemas.ts ...
   git commit -m "sync: update OpenAPI spec + generated schemas"
   ```

### Phase 3: Frontend Production Deploy (Still on Staging API)

1. **合并 lovable → dev**：
   ```bash
   git checkout dev && git merge lovable --no-edit
   ```
2. **CI 验证**：dev 分支 CI 检查 staging API（所有分支统一检查 staging）
3. **合并 dev → main**：
   ```bash
   git checkout main && git merge dev --no-edit
   ```
4. **Vercel 部署**：main 分支自动部署到 production Vercel
5. **关键点**：此时 production 前端**仍连接 staging API**（通过 `VITE_API_BASE_URL` 环境变量配置）
   - 确保前端 production 部署期间，后端 staging API 保持稳定
   - 前端用户无感知，因为 API 行为未变

### Phase 4: Backend Staging → Production

1. **创建 PR**：`railway` → `main`
2. **CI 验证**：PR CI 运行，验证 production 环境（分支保护）
3. **Review & Merge**：通过 review 后 merge（推荐用 merge commit 保留历史）
4. **Railway Production 部署**：合并后自动部署到 production

### Phase 5: Frontend Production → Production API

1. **更新 Vercel 环境变量**：将 `VITE_API_BASE_URL` 从 staging 改为 production
2. **Vercel 重新部署**：环境变量更新触发重新部署
3. **验证**：检查 production 前端是否正常连接 production API

## Spec 生成管道

### Backend (Source of Truth)

1. **类型定义**：`backend/src/types/index.ts`, `packages/aave-shared-contracts/src/index.ts`
2. **自动化生成**：`npx tsx backend/scripts/generate-openapi.ts`
   - 使用 `ts-json-schema-generator` 从 TS 类型生成 JSON Schema
   - **重写 $ref 路径**：`#/definitions/` → `#/components/schemas/`
   - **清理 schema 名称**：移除 `<>` 等不安全字符（`CampaignGroup<X>` → `CampaignGroupX`）
3. **产物**：`backend/static/openapi.json`
4. **API endpoint**：`/api/docs/openapi.json`

### Frontend (Consumer)

1. **拉取 spec**：`npm run openapi:fetch`（从 staging API）
2. **生成 Zod schemas**：`npm run schema:codegen`（使用 `openapi-zod-client`）
3. **产物**：`src/generated/api/schemas.ts`
4. **Wrapper 层**：`src/shared/market-contract/schemas.ts`, `src/lib/apiSchemas.ts`
   - 包装生成的 schemas
   - 添加前端特定字段和转换逻辑
   - 使用 `.strip()` 模式确保严格契约

## CI 检查逻辑

### Backend CI (`aave-protocol-analysis/.github/workflows/ci.yml`)

- **Railway 分支**：检查所有 job（`security-audit`, `build-and-prune`, `socket-firewall`）
- **Main 分支**：同 railway，但部署到 production
- **Auto-revert**：CI 失败时自动 revert commit（仅 direct push，PR merge 不触发）

### Frontend CI (`aaveapy/.github/workflows/ci.yml`)

- **所有分支**：统一检查 staging API（`LIVE_API_BASE=https://staging-api.aaveapy.com/api`）
- **验证内容**：
  - `openapi:check`：拉取 staging spec 并与 `public/openapi.json` diff
  - `schema:check`：验证生成的 schemas 是否与 committed 版本一致
  - Full validation gate：`lint + test + build + tsc`

## 故障排查

### Scenario: CI 失败

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `openapi:check` 失败 | 后端 staging spec 变更 | 从 staging 重新拉取 spec，生成 schemas |
| `security-audit` 失败 | 新增 GHSA 漏洞 | 检查漏洞是否影响本项目，如不影响则加入排除列表 |
| `schema:codegen` 失败 | `$ref` 路径或 schema 名称不兼容 | 检查后端 `generate-openapi.ts` 是否包含 rewrite 和 sanitize |

### Scenario: 前端构建失败

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| TypeScript 错误 | Schema 名称变更未更新 wrapper | 更新 `src/shared/market-contract/schemas.ts` 中的 `generated.*` 引用 |
| Test 失败 | API 响应结构变化 | 更新测试用例或 wrapper schema 定义 |

### Scenario: Production API 停机

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 前端无法连接 production API | 后端 production 部署失败 | 检查 Railway deployment logs，回滚到上一个 stable 版本 |
| Spec 不匹配 | 前后端版本不同步 | 按本工作流重新部署，确保 frontend production 先部署（连 staging），后端后升级 |

## 最佳实践

1. **小步快跑**：每次只变更有限数量的 schema，减少 merge conflict
2. **测试先行**：后端 staging 部署后，前端先在本地跑 `schema:codegen` 验证
3. **文档同步**：API 变更后立即更新本文档和相关 ADR
4. **回滚预案**：保留最近的稳定 production commit，以便快速回滚
5. **监控告警**：设置 Railway 和 Vercel 部署状态告警，及时发现部署失败

## 相关文档

- ADR: `docs/adr/0026-schema-pipeline-automation.md`
- Spec: `docs/specs/schema-pipeline-automation.md`
- Lessons: `docs/lessons/`（各领域经验教训）