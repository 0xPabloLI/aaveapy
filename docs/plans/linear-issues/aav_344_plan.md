# 开发方案：AAV-344 历史数据的获取

## 1. Issue 概述
实现历史数据的获取与存储功能，支持对Aave市场历史状态（如reserve数据、incentives、价格等）的时序记录和查询，满足后续分析和展示需求。

## 2. 当前状态
- 设计阶段，已有设计文档（docs/backend/campaign-history.md）涉及部分历史数据设计，但未实现。
- 数据库中无历史数据表（如campaign_history等）。
- 后端无历史数据采集、存储逻辑。
- 前端无历史数据展示相关功能。

## 3. 影响范围
- 后端仓库：aave-protocol-analysis/railway（主要实现历史数据采集、存储、API支持）
- 前端仓库：aaveapy/lovable（后续可能新增历史数据展示页面或组件）

## 4. 实现方案

### 4.1 数据库设计与迁移
- 新建历史数据相关表（如`reserve_history`、`campaign_history`等），设计字段包含时间戳、reserve标识、各类指标（liquidity, borrow, incentives, prices等）。
- 编写对应的数据库迁移脚本，放置于 `backend/migrations/`。

### 4.2 后端数据采集与存储
- 在根数据抓取服务（`src/index.ts`及相关fetcher）增加定时快照逻辑，定期抓取当前市场数据快照。
- 在`backend/src/services/persistenceService.ts`中新增历史数据写入接口，支持批量插入历史快照。
- 在`backend/src/services/updateScheduler.ts`中添加定时任务，调用历史数据写入接口，保证数据定期持久化。
- 保持cron-write/API-read-only架构，历史数据只写入不对外修改。

### 4.3 后端API支持
- 在`backend/src/routes/`新增历史数据查询接口，如`GET /api/markets/history`，支持时间范围、reserve筛选等参数。
- 在`backend/src/controllers/`实现对应控制器，调用持久层查询历史数据。
- API返回格式设计需兼容前端需求，支持分页和时间序列数据格式。

### 4.4 前端支持（后续迭代）
- 设计并实现历史数据展示组件（如历史趋势图、时间轴等）。
- 在`src/hooks/`新增历史数据请求hook（如`useHistoricalMarkets`）。
- 在`src/pages/`或`src/components/dashboard/`中集成历史数据视图。

## 5. 依赖关系
- 依赖AAV-139（Campaign history设计）相关设计文档。
- 依赖后端数据库环境支持新增表。
- 需协调后端定时任务与数据抓取稳定性（AAV-301性能优化可能相关）。

## 6. 验收标准
- 数据库成功创建历史数据表，并能存储多条历史快照。
- 后端定时任务能定期写入历史数据，无错误日志。
- API接口能正确返回指定时间范围内的历史数据，格式正确。
- 前端能通过新增hook请求历史数据（基础测试即可，展示组件后续迭代）。
- 代码通过单元测试和集成测试，CI/CD流程正常。

## 7. 复杂度评估
**Medium**  
理由：涉及数据库设计与迁移，后端定时任务与数据持久化逻辑，API设计与实现，跨模块协作，前端后续支持需协调。技术难度中等，需保证数据一致性和性能。