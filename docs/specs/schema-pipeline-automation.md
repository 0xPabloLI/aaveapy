# Spec: Schema Pipeline Automation

## Problem Statement

前端 Zod schema 和 TypeScript 类型与后端 API 响应不同步。后端 API 已返回的字段（如 `borrowBlacklist`）在前端 schema 和类型中缺失，导致运行时验证通过但 TypeScript 无法访问该字段。根因是前端 schema 全部手写，与后端 OpenAPI spec 无自动关联——`public/openapi.json` 虽然从后端拉取，但前端代码不消费它。

同时，后端 `generate-openapi.ts` 也是手写字段定义，开发者加字段后容易忘记同步 spec，导致 spec 本身就不完整。这是一个双向手写同步问题。

## Solution

建立后端驱动的全链路自动化 schema pipeline：

1. **后端**：将手写的 `generate-openapi.ts` 升级为从 TypeScript API 层类型（`MarketWithSpread`、`MarketsResponse`、`SideDataPayload` 等）自动生成 OpenAPI spec，消除后端 spec 手写同步
2. **前端**：引入 `openapi-zod-client`，从 `public/openapi.json` 自动生成 Zod schema 和 TypeScript 类型到 `src/generated/api/`，消除前端 schema 手写同步
3. **CI**：`openapi-sync` 自动 PR 同时包含 spec + generated 代码，确保两端同步

全链路：`后端 TypeScript interface → ts-json-schema-generator → openapi.json → openapi-zod-client → 前端 generated Zod + TS`，零手写同步。

## User Stories

1. 作为后端开发者，我想在 TypeScript interface 中新增字段后自动反映到 OpenAPI spec 中，这样我不需要手动更新手写的 spec 定义
2. 作为后端开发者，我想在改了 interface 但忘记运行 `gen:openapi` 时 CI 能 fail，这样 spec 不会漏更新
3. 作为前端开发者，我想从 generated schema 直接获得后端新增的字段（如 `borrowBlacklist`），这样不需要手动同步前端 Zod schema
4. 作为前端开发者，我想 generated schema 与手写 schema 在过渡期共存，这样迁移可以渐进式进行而不 break 现有功能
5. 作为前端开发者，我想在迁移完成后删除手写 schema 代码，这样减少维护负担和同步风险
6. 作为前端开发者，我想 `field-canary.test.ts` 从 generated types 导入，这样后端字段重命名时前端能 early warning
7. 作为前端开发者，我想 `apiSchemas.live.test.ts` 用 generated schema 验证真实 API 响应，这样 spec 不准时能端到端发现
8. 作为前端开发者，我想 `architecture-guard.test.ts` 的 429/503 检查从 `public/openapi.json` 读取，这样不再依赖已废弃的前端反向生成函数
9. 作为项目维护者，我想 `openapi-sync` 自动 PR 同时包含 `openapi.json` + `src/generated/api/`，这样同步 PR 一次到位
10. 作为项目维护者，我想 generated 代码提交到 git，这样 PR diff 能看到 schema 变更且不需要装 codegen 工具也能 build
11. 作为项目维护者，我想过渡期 generated schema 保留 `.passthrough()` 容错，这样 spec 不完整时前端不会崩
12. 作为项目维护者，我想验证稳定后去掉 `.passthrough()` 转 strict，这样 spec 成为严格契约
13. 作为开发者，我想后端 `SideDataPayload` 的 `partial: boolean` 被移除并替换为精确的 `errors` 类型，这样前后端 side-data 契约一致
14. 作为开发者，我想后端 `SideDataPayload` 和 `ForecastSnapshot` 提取到共享位置，这样 `ts-json-schema-generator` 能引用它们

## Implementation Decisions

### 后端（`aave-protocol-analysis` repo）

- **工具选择**：`ts-json-schema-generator`，从 TypeScript API 层类型生成 JSON Schema，嵌入 OpenAPI `components.schemas`
- **spec 生成入口类型**：`MarketWithSpread`、`MarketsResponse`、`ApiMeritCampaignGroup`、`ApiMerklOpportunityGroup`、`ApiBrevisCampaignItem`、`SideDataPayload`、`ForecastSnapshot`（API 层类型，非 Runtime 层）
- **429/503 response metadata**：保留手写模板（零变更历史），不纳入自动生成
- **`generate-openapi.ts` 重构**：删除手写的 `RESERVE_PROPERTIES`、`MERIT_CAMPAIGN_BREAKDOWN_PROPERTIES` 等常量，改为调用 `ts-json-schema-generator` 从入口类型生成 schema 部分，response metadata 用固定模板组装
- **类型提取**：`SideDataPayload` 从 `metaController.ts` inline 提取到 `shared-contracts` 或 `backend/src/types`；`ForecastSnapshot` 确认已导出
- **`SideDataPayload` 修复**：移除 `partial: boolean` 字段；`errors` 类型从 `Record<string, string>` 改为 `Partial<Record<'categories' | 'fdv' | 'forecast' | 'campaignAccess', string>>`
- **CI 新增**：`openapi-consistency` job — 运行 `gen:openapi` 后 `git diff --exit-code static/openapi.json`，确保 spec 已提交

### 前端（`aaveapy` repo）

- **工具选择**：`openapi-zod-client`，从 `public/openapi.json` 生成 Zod schema + TypeScript 类型
- **生成目录**：`src/generated/api/`，包含 `schemas.ts`（Zod）和 `types.ts`（TS），提交到 git
- **`.passthrough()` 策略**：Phase 1 wrapper 层加 `.passthrough()` 容错；Phase 2 验证后去掉转 strict
- **迁移 3 阶段**：
  - Phase 1（过渡期）：`schemas.ts` / `apiSchemas.ts` 改为从 generated 导入 + 加 `.passthrough()`，业务代码 import 路径不变
  - Phase 2（验证后）：去掉 `.passthrough()`，纯 re-export
  - Phase 3（终态）：删除手写 schema 文件，业务代码直接 import generated
- **`src/types/aave.ts` 处理**：
  - 纯 API 类型（`BaseCampaignBreakdown`、`CampaignGroup`、`MerklCampaignBreakdown` 等）→ 从 generated 导入
  - 前端派生类型（`MeritCampaignGroup`、`BrevisIncentive`、`ReserveWithSpread`、`BannedReserveUsdFields`、`IncentiveMessage`）→ 保留，基于 generated base 组合
  - 前端专属类型和常量（`CampaignAccessStatus`、`SortField`、`STABLECOINS` 等）→ 保留不动
- **`ReserveWithSpread` 实现**：`interface ReserveWithSpread extends GeneratedReserve, BannedReserveUsdFields {}`
- **删除的文件**：
  - `scripts/generate-openapi.ts`（前端反向生成，方向错误）
  - `scripts/generate-openapi-cli.ts`
  - `src/test/generate-openapi-no-side-effect.test.ts`
- **调整的测试**：
  - `architecture-guard.test.ts`：429/503 检查从 `generateOpenApiDocument()` 改为 `readFileSync('public/openapi.json')`
  - `field-canary.test.ts`：import 从 `./aave` 改为 `@/generated/api/types`（经 `aave.ts` re-export 后实际路径不变）
  - `apiSchemas.live.test.ts`：import 从 `./apiSchemas` 改为 generated schemas（经 wrapper 层后实际路径不变）
- **保留的文件**：
  - `scripts/fetch-openapi.ts` — 不变
  - `src/test/ci-openapi-workflow-guard.test.ts` — 可能微调，核心逻辑不变

### CI 流程

- **后端 CI 新增**：`openapi-consistency` job — `gen:openapi` → `git diff --exit-code static/openapi.json`
- **前端 `openapi-sync` 升级**：在 fetch spec 后加 `npm run schema:codegen` 步骤，PR 同时包含 `public/openapi.json` + `src/generated/api/`
- **前端 `openapi-sync` 合并策略**：仅创建 PR，不自动合并（generated 变更可能 break 编译，需人工确认）
- **前端新增 script**：`schema:codegen`（调用 `openapi-zod-client`）、`schema:check`（codegen 后 `git diff --exit-code src/generated/api/`）

### 依赖顺序

1. 后端先：升级 `generate-openapi.ts` → 重新生成 `static/openapi.json`（含 `borrowBlacklist`）→ 修复 `SideDataPayload` → 部署到 staging/production
2. 前端后：`openapi:fetch` 拉取新 spec → 引入 `openapi-zod-client` → 生成代码 → 渐进式迁移 → 删除废弃代码

## Testing Decisions

### 测试原则

- 只测外部行为，不测实现细节
- 复用现有测试文件和模式，优先改 import/数据源而非新建测试
- 过渡期临时测试（generated vs 手写等价性对比）在 Phase 3 删除

### 后端测试

- **`generate-openapi.ts` 输出验证**：验证生成的 `static/openapi.json` 包含所有 API 层类型字段（含 `borrowBlacklist`），required/optional 标记正确。Prior art: `backend/tests/buildScriptWriteSafety.test.ts`
- **spec vs live API 一致性**（可选增强）：对比 spec 字段集与实际 API 响应字段集。Prior art: 前端 `apiSchemas.live.test.ts`

### 前端测试

- **`architecture-guard.test.ts` 429/503 检查**：从 `public/openapi.json` 读取 spec 验证每个 GET endpoint 有 429/503 + Retry-After。现有测试块改数据源
- **`field-canary.test.ts`**：import 改为 generated types，验证字段名受保护。现有测试改 import
- **`apiSchemas.live.test.ts`**：import 改为 generated schemas，验证 live API 响应通过 generated schema 验证。现有测试改 import
- **`schema:check` CI**：`npm run schema:codegen` 后 `git diff --exit-code src/generated/api/`。Prior art: 现有 `openapi:check` 模式
- **generated vs 手写等价性**（过渡期专用）：对比 generated schema 字段集与手写 schema 字段集，确保迁移无遗漏。Phase 3 删除

## Out of Scope

- 后端引入 Zod 运行时验证（后端是 API producer，不需要验证外部输入）
- 后端 `RuntimeReserveData` 到 `MarketWithSpread` 的序列化逻辑重构
- 前端业务逻辑改动（如 `rateSimulationCalculator` 消费 `borrowBlacklist` 的逻辑——这是 triage phase 的工作）
- 前端 data fetching 层改动（`useAaveMarkets` 等 hook 的逻辑不变，只是 import 来源变化）
- 前端 UI 组件改动

## Further Notes

- `borrowBlacklist` 已在后端 `CampaignGroup` interface 中定义（`aave-shared-config`），且 fetcher 层已序列化到 API 响应。升级到 B1 后 spec 自动包含此字段，前端 generated schema 自然获得
- 后端 `generate-openapi.ts` 的 git 历史显示 12 次 commit 中 429/503 metadata 从未变更，所有改动都是 schema 字段——验证了"schema 自动生成 + metadata 手写模板"的分工合理性
- 前端 `ReserveWithSpread` 的 `BannedReserveUsdFields` guard 是编译时机制，与 generated types 正交，通过 `interface extends` 组合即可保留
- `openapi-zod-client` 社区较小，通过 pin 版本 + 锁定生成产物 + CI 检查兜底
