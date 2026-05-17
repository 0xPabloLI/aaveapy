# 开发方案：AAV-325 - 自动生成 API 文档功能

## 1. Issue 概述
为项目添加一个能够根据后端 API 自动生成文档的功能，提升文档维护效率和准确性，方便前后端协作和外部使用者理解接口。

## 2. 当前状态
- 已实现部分自动生成文档功能，后端仓库中已有 `scripts/generate-openapi.ts` 脚本，生成了 `public/openapi.json` 和 `public/swagger.html`。
- 但该功能可能未完全覆盖所有 API 或未集成到 CI/CD 流程中，且前端对文档的使用和展示可能不完善。

## 3. 影响范围
- 后端仓库：`aave-protocol-analysis/railway`（主要负责 OpenAPI 规范生成和文档维护）
- 前端仓库：`aaveapy/lovable`（可考虑集成文档展示页面或链接）

## 4. 实现方案

### 4.1 后端 - 完善自动生成文档
- **检查现有脚本** `scripts/generate-openapi.ts`：
  - 确认所有后端 API 路由均有对应的 OpenAPI 注释或 schema 定义。
  - 补充遗漏的接口注释，确保接口请求参数、响应体、错误码等信息完整。
- **增强脚本功能**：
  - 支持自动从 Express 路由和 controller 中提取注释生成 OpenAPI 规范。
  - 生成的 `openapi.json` 文件放置于 `public/` 目录，方便前端访问。
- **集成 CI/CD**：
  - 在 GitHub Actions 中新增或完善生成文档的步骤，确保每次后端代码变更时自动更新文档。
  - 失败时阻断合并或触发告警。

### 4.2 前端 - 文档展示与访问
- **新增文档页面**：
  - 在 `src/pages/` 下新增 `ApiDocs.tsx`，使用 Swagger UI React 组件加载后端生成的 `openapi.json`。
  - 页面路径如 `/docs/api`，方便用户访问。
- **导航集成**：
  - 在前端 Header 或 Footer 添加“API 文档”链接，指向 `/docs/api`。
- **文档版本管理**（可选）：
  - 支持显示不同版本的 API 文档（如 staging/production），通过配置切换。

### 4.3 其他
- **文档维护规范**：
  - 编写文档注释规范文档，指导开发者如何在代码中添加注释以自动生成文档。
- **开发者体验**：
  - 提供本地运行生成文档的命令，方便开发调试。

## 5. 依赖关系
- 无明显依赖其他未完成功能，建议与 AAV-121（OpenAPI docs 已实现）结合，完善和扩展。

## 6. 验收标准
- 后端所有公开 API 均有完整的 OpenAPI 文档定义。
- 生成的 `openapi.json` 文件可通过浏览器访问。
- 前端新增的 `/docs/api` 页面能正确加载并展示 Swagger UI 文档。
- 文档生成脚本集成到 CI/CD，代码变更自动触发文档更新。
- 文档注释规范文档完成并发布。

## 7. 复杂度评估
- **Medium**
- 理由：基础的自动生成脚本已存在，主要工作在于完善注释、集成 CI/CD 和前端展示，涉及前后端协作，需保证文档准确完整。