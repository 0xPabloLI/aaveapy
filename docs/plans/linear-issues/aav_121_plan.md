# 开发方案：AAV-121 添加 OpenAPI 文档和 Postman 集合

## 1. Issue 概述
为后端 API 添加完整的 OpenAPI（Swagger）文档支持，方便自动生成客户端 SDK 和接口文档。同时，基于 OpenAPI 文档生成 Postman 或 Insomnia 的 API 测试集合，方便开发和测试团队使用。

## 2. 当前状态
**已实现 / 部分实现 / 未开始**  
已实现。  
项目中已存在 OpenAPI 文档相关实现，包含 `scripts/generate-openapi.ts` 脚本生成 `public/openapi.json` 和 `public/swagger.html`。但 Issue 状态为 Todo，可能是文档未完全覆盖或 Postman 集合未生成。

## 3. 影响范围
- 后端仓库：`aave-protocol-analysis`（railway 分支）
- 前端仓库：`aaveapy`（lovable 分支）（用于集成 Swagger UI 或 Postman 集合）

## 4. 实现方案

### 4.1 OpenAPI 文档完善与自动生成
- **文件修改/新增**：
  - `backend/scripts/generate-openapi.ts`：完善脚本，确保所有 API 路由和数据模型均被覆盖。
  - `backend/src/routes/` 和 `backend/src/controllers/`：补充或完善注释和类型定义，确保自动生成的文档准确。
  - `backend/public/openapi.json`：自动生成的 OpenAPI JSON 文件。
  - `backend/public/swagger.html`：基于 `openapi.json` 的 Swagger UI 静态页面。

- **关键逻辑变更**：
  - 确保所有 Express 路由均有对应的 OpenAPI schema 定义。
  - 使用现有的 Zod Schema（`src/lib/apiSchemas.ts`）作为数据模型定义源，结合工具（如 `zod-to-openapi`）自动转换为 OpenAPI schema，避免重复维护。
  - 在 CI/CD 流程中集成生成脚本，确保文档始终最新。

### 4.2 Postman / Insomnia 集合生成
- **文件新增**：
  - `backend/scripts/generate-postman-collection.ts`：基于 `openapi.json` 自动生成 Postman 集合 JSON 文件。
  - 生成的 Postman 集合文件放置于 `backend/public/postman-collection.json`。

- **关键逻辑变更**：
  - 使用开源工具（如 `openapi-to-postmanv2`）将 OpenAPI JSON 转换为 Postman 集合。
  - 集合中包含所有 API 请求定义，带有示例请求体和响应体，方便测试。
  - 可选：生成 Insomnia 导入格式。

### 4.3 前端集成（可选）
- 在前端项目 `aaveapy` 中新增页面或组件，集成 Swagger UI，方便浏览 API 文档。
- 或在 README 或开发文档中提供 Postman 集合下载链接及使用说明。

### 4.4 文档与说明
- 更新项目 README，说明如何生成和使用 OpenAPI 文档及 Postman 集合。
- 说明如何在本地或 CI 中运行生成脚本。

## 5. 依赖关系
- 依赖 Zod Schema 完整且准确（已实现）。
- 依赖现有的 API 路由定义和注释规范。
- 可能依赖 CI/CD 流程调整（如 GitHub Actions）。

## 6. 验收标准
- 运行 `scripts/generate-openapi.ts` 后，生成的 `openapi.json` 包含所有后端 API 路由及数据模型。
- `public/swagger.html` 页面能正确展示所有接口文档，且无错误。
- 生成的 Postman 集合文件可导入 Postman，且包含所有 API 请求定义。
- 文档和集合在 README 中有明确使用说明。
- CI/CD 流程中集成文档生成，确保文档持续更新。

## 7. 复杂度评估
**Low**  
项目已有基础设施和部分实现，主要工作是完善覆盖、自动化生成和文档说明，技术难度较低，主要需细致梳理和验证。