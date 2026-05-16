# OpenAPI 自动生成设计方案

**日期**: 2026-05-15
**关联 Issue**: [AAV-121](https://linear.app/aaveapy/issue/AAV-121/添加-openapi-文档和-postman-集合)

## 背景

项目已建立基于 Zod Schema 的四层 API 契约防线（`src/lib/apiSchemas.ts`），但缺少 OpenAPI 文档。OpenAPI 文档可以：
- 供 Swagger UI / Redoc 渲染交互式 API 文档
- 供其他语言的客户端生成工具自动生成 SDK
- 作为 API 契约的标准化表述，方便外部合作方接入

## 目标

从 `src/lib/apiSchemas.ts` 的 Zod Schema **自动**生成 `public/openapi.json`，零手动操作。Schema 变更后 `dev` / `build` 自动触发生成。

## 方案

### 技术选型

| 层 | 选型 | 理由 |
|----|------|------|
| Zod → OpenAPI 转换 | `zod-to-openapi` | 专为此场景设计，API 简洁，维护活跃 |
| 自动触发 | Vite 插件 `buildStart` hook | `dev` / `build` 时自动跑，无需额外命令 |
| CI 闸门 | `npm run build` 后 dirty check | 防止改了 Schema 忘记提交产物 |

### 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `scripts/generate-openapi.ts` | 新增 | 核心生成逻辑：读取 Zod schema → 输出 `public/openapi.json` |
| `vite.config.ts` | 修改 | 加 Vite 插件 `buildStart` hook 调用生成脚本 |
| `package.json` | 修改 | 加 `zod-to-openapi` devDependency |
| `public/openapi.json` | 新增 | 生成产物，提交到 Git |

### 触发流程

```
改 apiSchemas.ts → npm run dev / build
                         │
                    Vite buildStart hook
                         │
              scripts/generate-openapi.ts
                         │
                  public/openapi.json (自动更新)
```

### OpenAPI 文档结构

```yaml
info:
  title: AaveAPY API
  version: 1.0.0
servers:
  - url: https://staging-api.aaveapy.com/api
  - url: https://api.aaveapy.com/api
paths:
  GET /markets:
    responses:
      200:
        content: application/json
        schema: MarketsResponse
  GET /meta/side-data:
    responses:
      200:
        content: application/json
        schema: SideDataMetaResponse
components:
  schemas:
    # 所有内嵌 Zod schema 扁平注册到 components/schemas
    Reserve: ...
    MeritIncentive: ...
    MerklCampaignBreakdown: ...
    BrevisIncentive: ...
    CoingeckoFdvResponse: ...
```

### 注意事项

- `zod-to-openapi` Vite 构建时脚本运行在 Node.js 环境，需要 `@zod-to-openapi/openapi` 的 Node 兼容版本
- 如果 `zod-to-openapi` 不支持某些 Zod 类型（如 `z.literal().brand()`），需要 fallback 注册为 `z.any()` 并记录 warning
- 生成脚本需要 `tsx` 或 `ts-node` 来执行 TypeScript，检查项目现有依赖

## 测试策略 (TDD)

按照 TDD 流程，先写测试再写代码：

### 测试用例

| # | 测试文件 | 验证内容 |
|---|---------|----------|
| 1 | `scripts/generate-openapi.test.ts` | OpenAPI 结构完整性：`info`、`servers`、`paths`、`components.schemas` 都存在 |
| 2 | 同上 | Schema 覆盖度：`MarketsResponse`、`SideDataMetaResponse`、`CoingeckoFdvResponse` 都在 `components/schemas` 中 |
| 3 | 同上 | 路径定义：`/markets` 和 `/meta/side-data` 两个端点都有 GET 定义 |
| 4 | 同上 | 关键字段：Reserve schema 包含 `reserveId`、`tokenSymbol`、`supplyApy` 等核心字段 |
| 5 | 同上 | `z.record()` / `z.lazy()` 等高级类型能正确转换为 OpenAPI schema |
| 6 | 同上 | 产物与源码一致（generated snapshot 对比），防止手动修改产物 |

### 不做

- Postman 集合（OpenAPI JSON 转 Postman 一行命令的事，不需要单独维护）
- Swagger UI 前端页面（`public/openapi.json` 放在那，后续需要接 Swagger UI 只需几行 HTML）