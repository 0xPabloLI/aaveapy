# 开发方案 - AAV-69 读取在merkl上的dashboard数据

## 1. Issue 概述
实现从 Merkl 平台读取其 Dashboard 相关数据，并将数据集成到 AaveAPY 项目中，供前端展示和后续分析使用。

## 2. 当前状态
未开始。  
根据项目现有架构，Merkl API 集成已有基础（backend/src/merkl-api.ts），但尚未完成完整 Dashboard 数据的读取与处理。

## 3. 影响范围
- 后端：aave-protocol-analysis 仓库 railway 分支  
- 前端：aaveapy 仓库 lovable 分支（后续展示）

## 4. 实现方案

### 4.1 后端实现

#### 4.1.1 新增或扩展 Merkl API 集成
- 修改文件：
  - `src/merkl-api.ts`：完善调用 Merkl Dashboard 相关接口，支持获取完整 Dashboard 数据结构。
  - `src/index.ts`：在数据聚合流程中加入 Merkl Dashboard 数据的调用与合并。
- 关键逻辑：
  - 调用 Merkl 提供的 Dashboard API，解析返回数据，转换为项目内部统一的数据类型（可参考 RuntimeReserveData 类型设计）。
  - 处理数据缓存和错误重试机制，保证数据稳定性。
- 数据流变更：
  - 在 Root Fetcher 中新增 Merkl Dashboard 数据字段，供后续持久化和 API 返回。

#### 4.1.2 持久化与服务层支持
- 修改文件：
  - `backend/src/services/merklForecastService.ts`（如相关）：扩展或新增服务支持 Dashboard 数据的业务逻辑。
  - `backend/src/services/persistenceService.ts`：根据需要设计数据库表结构或扩展现有表，存储 Merkl Dashboard 数据快照。
  - `backend/src/controllers/` 和 `backend/src/routes/`：新增或扩展 API 路由，支持前端请求 Merkl Dashboard 数据。
- 关键逻辑：
  - 设计合适的存储结构，支持历史数据查询和实时数据访问。
  - 设计 API 返回格式，保持与现有市场数据接口风格一致。

### 4.2 前端实现（后续）

- 修改文件：
  - `src/hooks/useMerklDashboard.ts`（新建自定义 Hook）：封装 Merkl Dashboard 数据请求与状态管理。
  - `src/components/dashboard/MerklDashboard.tsx`（新建组件）：展示 Merkl Dashboard 数据。
- 关键逻辑：
  - 调用后端新增 API，获取 Merkl Dashboard 数据。
  - 设计合理的 UI 展示，支持数据筛选和交互。

## 5. 依赖关系
- 依赖 Merkl 平台提供稳定的 Dashboard API 接口。
- 依赖后端数据聚合和持久化方案完成。
- 可能依赖 AAV-69 相关的其他 Merkl 数据集成任务。

## 6. 验收标准
- 后端能够成功调用 Merkl Dashboard API 并正确解析数据。
- 数据能够持久化存储，并通过新增 API 接口对外提供。
- 前端能够调用该接口并正确展示 Merkl Dashboard 数据。
- 相关单元测试和集成测试覆盖新增功能。
- 部署后无明显性能或稳定性问题。

## 7. 复杂度评估
**Medium**  
理由：涉及第三方 API 集成、数据结构设计、后端持久化及前端展示多方面改动，需协调多个模块，但已有部分 Merkl API 集成基础，风险可控。