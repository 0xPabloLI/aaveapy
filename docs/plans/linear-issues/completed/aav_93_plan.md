# 开发方案：AAV-93 重新设计前端数据展示，同时包含v3 v4，考虑同名reserve怎么处理

## 1. Issue 概述
重新设计前端的市场数据展示，使其能够同时展示Aave V3和V4的reserve数据，并且考虑未来扩展到其他借贷协议的可能性。重点解决同名reserve（token）在不同协议或版本中如何区分和展示的问题，保证数据准确且用户体验良好。

## 2. 当前状态
- **未开始**：当前前端主要展示单一版本（V3或V4）数据，且未统一展示多协议数据。
- 后端已支持V3/V4数据聚合（部分字段如hubId/hubName/spokeId等已存在），但前端未做统一展示。
- 同名reserve冲突处理无明确方案。

## 3. 影响范围
- **前端仓库**：aaveapy（lovable分支）
- **后端仓库**：aave-protocol-analysis（railway分支），涉及API数据结构调整和接口支持

## 4. 实现方案

### 4.1 后端调整
- **文件修改**
  - `backend/src/services/marketsService.ts`：调整数据聚合逻辑，确保V3和V4的reserve数据都能完整且区分地提供。
  - `backend/src/services/marketsApiSerialize.ts`：调整API序列化，新增字段标识reserve所属协议版本（如`protocolVersion: "v3" | "v4" | "other"`）。
  - `backend/src/routes/markets.ts`：确认API接口返回结构支持多协议数据。
- **关键逻辑**
  - 在返回的reserve对象中加入唯一标识字段（例如`protocolId`、`reserveId`或`protocolVersion`）以区分同名reserve。
  - 保证API返回数据结构兼容现有前端，新增字段为非破坏性扩展。
- **数据流**
  - 数据聚合层区分不同协议数据源，合并后传递给API层。

### 4.2 前端调整
- **文件创建/修改**
  - `src/components/dashboard/ReservesTable.tsx`：重构展示逻辑，支持展示多协议reserve列表。
  - `src/hooks/useAaveMarkets.ts`：调整数据请求和处理逻辑，支持多协议数据结构。
  - `src/lib/formatters.ts`：新增格式化函数，支持展示协议版本标签。
  - `src/components/dashboard/FilterBar.tsx`：新增协议版本筛选功能，允许用户筛选V3、V4或所有。
  - `src/types/aave.ts`：扩展类型定义，新增协议版本相关字段。
- **关键逻辑**
  - 在reserve列表中增加“协议版本”列或图标，清晰区分同名reserve。
  - 对于同名reserve，使用协议版本+地址等联合唯一标识，避免混淆。
  - 支持用户通过FilterBar筛选不同协议版本。
  - 设计UI时考虑未来扩展其他协议，保持组件通用性和可扩展性。
- **数据流**
  - 从后端API获取包含多协议数据的reserve列表，前端根据协议版本字段进行分类和展示。

### 4.3 设计与用户体验
- 设计清晰的协议版本标签（如V3、V4、Compound等未来协议）。
- 对于同名reserve，展示协议版本和对应地址，避免误导。
- 保持现有功能兼容，新增功能可通过筛选打开或关闭。

### 4.4 测试
- 单元测试覆盖新字段和筛选逻辑。
- 集成测试确保前后端数据一致。
- UI测试验证多协议数据展示效果。

## 5. 依赖关系
- 依赖后端完成多协议数据聚合和API字段扩展（同步开发）。
- 需协调设计团队确认协议版本标签UI设计。
- 可能依赖AAV-93相关的后端数据结构调整。

## 6. 验收标准
- 前端能够正确展示来自V3和V4的reserve数据。
- 同名reserve在列表中有明确协议版本区分。
- 用户可以通过筛选功能选择显示特定协议版本的reserve。
- UI设计符合设计规范，用户体验良好。
- 后端API返回数据包含协议版本字段，且数据准确。
- 相关单元和集成测试通过。

## 7. 复杂度评估
- **Medium**
- 理由：涉及前后端多处改动，需保证数据结构兼容和UI展示清晰，同时考虑未来扩展性，设计和实现均有一定复杂度，但已有部分后端多协议支持基础，减少了难度。

---

以上方案旨在系统性解决多协议数据展示问题，兼顾当前需求和未来扩展，确保AaveAPY前端数据展示的准确性和用户体验。