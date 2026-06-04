# 开发方案 - AAV-76 对比一下defillama有没有这些内容

## 1. Issue 概述
对比 AaveAPY 项目中展示的市场数据和指标内容，确认 DefiLlama 是否也提供相似的数据或指标。目标是了解 DefiLlama 的数据覆盖范围和展示内容，评估是否需要引入 DefiLlama 的数据源或调整现有展示内容以增强对比性和完整性。

## 2. 当前状态
未开始。项目中尚无针对 DefiLlama 数据的集成或对比分析。

## 3. 影响范围
- 后端：`aave-protocol-analysis/railway`（可能需要新增 DefiLlama 数据抓取和存储逻辑）
- 前端：`aaveapy/lovable`（可能需要新增 DefiLlama 数据展示和对比视图）

## 4. 实现方案

### 4.1 调研阶段
- 研究 DefiLlama 官网及其 API（https://defillama.com/docs/api）提供的数据类型和指标，重点关注与 AaveAPY 现有数据（如市场规模、流动性、借贷利率、奖励等）的重合和差异。
- 列出 DefiLlama 支持的关键指标和数据字段，形成对比表。

### 4.2 设计阶段
- 根据调研结果，确定需要从 DefiLlama 获取的具体数据。
- 设计后端数据抓取方案：
  - 新建 `src/defillama-api.ts`，封装 DefiLlama API 调用逻辑。
  - 在 `backend/src/services/` 下新增 `defillamaService.ts`，负责数据请求、缓存和格式转换。
- 设计数据库存储方案（如需要历史数据存储）：
  - 评估是否需要新增表或字段存储 DefiLlama 数据。
- 设计前端展示方案：
  - 新增 DefiLlama 数据对比视图组件（如 `src/components/dashboard/DefiLlamaComparison.tsx`）。
  - 在现有市场数据页面增加 DefiLlama 数据对比入口或展示区域。

### 4.3 实现阶段
- 后端
  - 实现 DefiLlama API 调用模块，支持定时抓取或按需请求。
  - 将抓取的数据转换为与现有市场数据兼容的格式。
  - 如需存储，新增数据库表及对应的持久化逻辑。
  - 在现有 API（如 `/api/meta/side-data`）中增加 DefiLlama 数据字段，供前端调用。
- 前端
  - 新增 DefiLlama 数据对比组件，展示关键指标的对比。
  - 调整数据请求逻辑，调用新增的后端接口获取 DefiLlama 数据。
  - 优化 UI/UX，确保对比信息清晰易懂。

### 4.4 测试阶段
- 编写单元测试覆盖 DefiLlama API 调用和数据处理逻辑。
- 前端组件测试，确保数据正确展示且交互正常。
- 集成测试，验证前后端联动及接口稳定性。

## 5. 依赖关系
- 无直接依赖，但建议先完成 AAV-76 的调研确认后再进行开发。
- 可能与 AAV-76 相关的其他市场数据增强需求同步协调。

## 6. 验收标准
- 完成 DefiLlama 数据调研报告并确认数据字段。
- 后端成功集成 DefiLlama API，数据能定时或按需获取。
- 前端新增 DefiLlama 数据对比视图，能正确展示 DefiLlama 与 AaveAPY 数据对比。
- 相关单元测试和集成测试通过。
- 代码合并后，部署环境中接口和页面正常运行，无性能明显下降。

## 7. 复杂度评估
**Medium**

理由：
- 需要调研第三方数据源，理解其数据结构和更新频率。
- 需新增后端数据抓取和处理逻辑，可能涉及数据库设计。
- 前端需新增对比视图，涉及数据整合和 UI 设计。
- 但整体功能较为独立，风险和复杂度适中。