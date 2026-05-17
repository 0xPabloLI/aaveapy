# 开发方案 - AAV-174 [Cleanup] 移除 V4 spoke 无消费字段 (spokeId/spokeName/spokeAddress)

## 1. Issue 概述
清理代码中未被使用的 V4 spoke 相关字段 `spokeId`、`spokeName`、`spokeAddress`。这三个字段在类型定义和部分 Zod schema 中声明，但项目中无任何读取或使用，存在冗余。需移除这些字段以简化代码，或若为预留字段则补全 schema 并加注释说明。

## 2. 当前状态
- 字段在 `src/types/aave.ts` 中声明（可选字段）
- 仅 `spokeAddress` 在 `src/lib/apiSchemas.ts` 的 Zod schema 中声明
- `spokeId` 和 `spokeName` 未在 schema 中声明，仅靠 `.passthrough()` 放行
- 全项目无任何 `.spokeId` / `.spokeName` / `.spokeAddress` 的读取代码（grep 结果为零）

## 3. 影响范围
- 前端仓库：`aaveapy`（lovable 分支）
  - 主要修改 `src/types/aave.ts` 和 `src/lib/apiSchemas.ts`
- 后端仓库无影响（字段为前端类型定义和校验）

## 4. 实现方案

### 4.1 确认是否短期有消费计划
- 与产品/架构沟通确认这三个字段是否预留，是否有近期使用计划
- 若确认无计划，执行 4.2
- 若预留，执行 4.3

### 4.2 移除字段（推荐方案）
- 修改文件：
  - `src/types/aave.ts`：删除 `spokeId?`, `spokeName?`, `spokeAddress?` 字段声明（L127-129）
  - `src/lib/apiSchemas.ts`：删除 `spokeAddress` 字段的 Zod schema 声明（L141）
- 代码变更：
  - 移除字段声明后，相关类型不再包含这三个字段
  - Zod schema 不再校验这三个字段，避免冗余
- 验证：
  - 运行 grep 命令确认项目中无 `.spokeId`、`.spokeName`、`.spokeAddress` 的使用
  - 项目编译无错误
  - 相关单元测试通过（若有涉及类型校验的测试）

### 4.3 保留字段（备选方案）
- 修改文件：
  - `src/types/aave.ts`：保留字段声明，添加注释说明预留意图和预计使用时间点
  - `src/lib/apiSchemas.ts`：补齐 `spokeId` 和 `spokeName` 的 Zod schema 声明，保持 `spokeAddress` 也声明
- 代码变更：
  - 在 schema 中显式声明这三个字段，避免依赖 `.passthrough()` 放行
  - 注释中说明字段当前无消费，仅作预留
- 验证：
  - 运行 grep 命令确认无其他代码使用
  - 项目编译无错误
  - 相关单元测试通过

## 5. 依赖关系
- 无依赖其他 Issue，独立清理工作
- 需与产品/架构确认字段使用计划

## 6. 验收标准
- `src/types/aave.ts` 和 `src/lib/apiSchemas.ts` 中不再声明或已补齐声明并有注释
- 项目中无任何 `.spokeId`、`.spokeName`、`.spokeAddress` 的代码读取或使用（grep 结果为零）
- 项目编译通过，无类型错误
- 相关单元测试通过
- 代码审查确认无遗漏

## 7. 复杂度评估
- 复杂度：Low
- 理由：仅涉及类型定义和 schema 的简单增删，无业务逻辑改动，风险低，改动面小

---

以上为 AAV-174 的详细开发方案。建议优先确认字段是否预留，若无使用计划则直接移除，保持代码整洁。