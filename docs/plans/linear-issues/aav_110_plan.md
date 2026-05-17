# AAV-110 开发方案

## 1. Issue 概述
将 backend 目前依赖的 root build 产物（`dist/index.js` 中的共享契约如 `MarketsPayload`、`RuntimeReserveData` 及相关类型和序列化逻辑）拆分出来，迁移到独立的共享 package 中，减少 backend 对 root dist 的运行时耦合。完成后，backend 通过共享 package 引用契约定义和序列化逻辑，保证构建和启动正常。

## 2. 当前状态
- 部分实现：共享契约目前仍在 root dist 中，backend 直接引用运行时产物。
- 共享契约未独立成包，存在耦合。
- 相关测试覆盖需更新。

## 3. 影响范围
- 后端仓库：`aave-protocol-analysis`（railway 分支）
- 根仓库（root build）：`aave-protocol-analysis` 根目录（src/）
- 共享层（新建或已有共享 package）

## 4. 实现方案

### 4.1 新建共享 package
- 在根目录或 monorepo 结构下创建 `packages/aave-shared-contracts`（或类似命名）
- 迁移以下内容到共享 package：
  - 类型定义：`MarketsPayload`、`RuntimeReserveData`、相关 TypeScript 类型（如 reserves、incentives 等）
  - 序列化约定和函数（如 `marketsApiSerialize.ts` 中的序列化逻辑）
  - 相关工具函数（如格式化、验证契约的辅助函数）

### 4.2 修改 root build
- root build 仅负责业务逻辑和数据聚合，不再导出共享契约
- 依赖共享 package 中的类型和序列化逻辑
- 调整 `src/index.ts` 等文件的导入路径，改为从共享 package 引入

### 4.3 修改 backend 代码
- 将 backend 中对 `../../../dist/index.js` 的引用改为直接从共享 package 引入对应类型和序列化函数
- 确保 backend 构建流程中共享 package 被正确解析和打包
- 更新 `backend/src/services/marketsApiSerialize.ts`，改为使用共享 package 中的序列化逻辑或类型定义

### 4.4 构建和启动验证
- 修改根目录和 backend 的 `package.json`，确保共享 package 作为依赖正确安装
- 运行 `npm run build`（根目录和 backend）验证构建无误
- 启动 backend 服务，确保正常运行且接口返回数据正确

### 4.5 测试覆盖更新
- 在共享 package 中添加针对类型和序列化逻辑的单元测试
- backend 的相关测试（如 marketsApiSerialize 相关）改为引用共享 package 的实现
- 运行所有测试确保无回归

### 4.6 文档更新
- 在项目文档（如 `SESSION-BOARD.md`）中补充架构边界说明，明确共享契约所在位置及职责
- 说明 root build 与 backend 之间的依赖关系调整

## 5. 依赖关系
- 无直接依赖其他 Issue，但建议同步关注 AAV-113（src/lib refactor）以避免重复改动

## 6. 验收标准
- 共享契约及序列化逻辑成功拆分到独立共享 package
- backend 不再依赖 root dist 运行时产物，改为共享 package 引用
- `npm run build` 后 backend 能正常启动且接口正常响应
- 相关测试覆盖完整且通过
- `SESSION-BOARD.md` 中有明确架构边界描述

## 7. 复杂度评估
- Medium  
  理由：涉及多仓库依赖调整和构建流程变更，需保证类型兼容和序列化一致性，且影响后端启动流程，需谨慎测试和验证。