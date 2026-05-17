# 开发方案：AAV-144 V3/V4 incentive matching: external sources cannot distinguish protocol version

## 1. Issue 概述
当前外部激励数据源（Merit、Merkl、Brevis）无法区分同链上相同代币的V3和V4协议版本，导致激励匹配错误。需在后端数据结构和外部数据索引逻辑中加入协议版本区分，并持续监控外部数据源V4激励上线情况，及时调整匹配逻辑。

## 2. 当前状态
- 未开始实现
- V4激励数据尚未上线，暂无直接风险
- 已有详细分析文档 `docs/api/v3-v4-incentive-matching.md`

## 3. 影响范围
- 后端仓库：`aave-protocol-analysis`（railway分支）
  - Root数据聚合层（`src/`）
  - Backend API层（`backend/`）
- 前端暂时无影响，因数据结构变更主要在后端

## 4. 实现方案

### 4.1 在后端数据结构中加入协议版本字段
- 修改文件：
  - `src/index.ts`（Root数据聚合入口）
  - `src/types/aave.ts`（定义`FormattedReserveData`类型）
  - `backend/src/services/marketsService.ts`（市场数据管理）
  - 相关序列化文件如`backend/src/services/marketsApiSerialize.ts`
- 关键逻辑：
  - 在聚合V3和V4市场数据时，给每个`FormattedReserveData`对象新增`protocolVersion: 'v3' | 'v4'`字段
  - 该字段根据市场数据来源（V3或V4 fetcher）赋值
  - 后端API响应中包含此字段，保持字段名不变，方便前端和外部调用方使用

### 4.2 修正Brevis索引逻辑，增加协议版本区分
- 修改文件：
  - `src/brevis-api.ts`
  - 可能涉及`src/index.ts`中调用Brevis数据的部分
- 关键逻辑：
  - 当前Brevis索引键为`chainId-tokenAddress`（underlying）
  - 修改为`chainId-protocolId-tokenAddress`，其中`protocolId`为pool地址，能区分V3/V4
  - 需要与Brevis团队确认索引键格式修改的兼容性和数据同步
  - 修改后端匹配激励时，使用新索引键进行准确匹配

### 4.3 监控Merit和Merkl激励数据，动态适配
- 监控点：
  - Merit API（`src/merit-api.ts`）是否开始返回V4相关campaigns
  - Merkl API（`src/merkl-api.ts`）是否出现V4激励
- 预留扩展点：
  - 在`src/index.ts`和相关服务中加入版本判断逻辑
  - 根据实际返回数据格式，调整匹配逻辑（例如Merit可能需扩展key格式，Merkl可能需支持非传统aToken）
- 实施方式：
  - 先实现监控日志和告警（如日志打印V4激励数据出现）
  - 后续根据实际情况迭代实现匹配逻辑调整

### 4.4 相关文档更新
- 更新`docs/api/v3-v4-incentive-matching.md`，记录实现细节和接口变更
- 更新OpenAPI文档（`scripts/generate-openapi.ts`）以包含`protocolVersion`字段

## 5. 依赖关系
- 依赖外部激励数据源（Brevis、Merit、Merkl）开始返回V4激励数据
- 依赖与Brevis团队确认索引键格式修改
- 依赖后续V4市场数据稳定上线

## 6. 验收标准
- 后端API `/api/markets` 返回的`FormattedReserveData`包含准确的`protocolVersion`字段
- Brevis激励索引键已包含`protocolId`，激励匹配正确区分V3/V4
- 监控日志能正确捕捉Merit和Merkl的V4激励数据（若出现）
- OpenAPI文档更新，前端和外部调用方能正确使用新字段
- 通过后端单元测试和集成测试验证新字段及匹配逻辑
- 代码审查通过，文档齐全

## 7. 复杂度评估
- Medium
  - 需修改核心数据结构和索引逻辑，涉及多个后端模块
  - 需与外部数据源协调，保证索引键格式兼容
  - 监控和动态适配部分需设计良好，保证后续可扩展
  - 风险较低，因V4激励尚未上线，开发可分阶段推进

---

此方案建议先完成协议版本字段和Brevis索引修改的基础工作，配合监控机制，待V4激励数据上线后快速响应调整Merit和Merkl匹配逻辑。