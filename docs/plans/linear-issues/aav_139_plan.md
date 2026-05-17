# 开发方案：AAV-139 - 历史 Campaign 链接展示，尤其是刚过期的 Campaign

## 1. Issue 概述
需要在前端界面合适位置增加一个历史 Campaign 的入口链接，方便用户查看历史（尤其是刚过期的）Campaign 信息。目前已有设计文档，但尚未实现历史 Campaign 数据的存储和展示。

## 2. 当前状态
- 设计文档已存在：`docs/backend/campaign-history.md`
- 后端无对应数据库表（campaign_history）和数据持久化逻辑
- 前端无历史 Campaign 页面或链接入口
- 状态：部分设计完成，代码未实现

## 3. 影响范围
- 后端：`aave-protocol-analysis` 仓库 railway 分支
- 前端：`aaveapy` 仓库 lovable 分支

## 4. 实现方案

### 4.1 后端实现

#### 4.1.1 数据库设计
- 创建 `campaign_history` 表，字段参考设计文档，包含：
  - campaignId, startTimestamp, endTimestamp, related market/reserve info
  - incentive details, status（已过期/活跃标记）
  - 其他必要的历史快照字段

#### 4.1.2 数据持久化逻辑
- 在 `persistenceService.ts` 中新增方法：
  - 定期将已结束的 Campaign 数据写入 `campaign_history` 表
  - 可能基于现有的 cron 任务（`updateScheduler.ts`）触发
- 设计数据迁移脚本，放入 `backend/migrations/`，确保数据库结构更新

#### 4.1.3 API 接口
- 新增 API 路由 `/api/campaigns/history`，支持分页查询历史 Campaign
- Controller 层实现查询逻辑，返回历史 Campaign 列表
- API 返回数据结构遵循现有后端字段命名规范

### 4.2 前端实现

#### 4.2.1 页面设计
- 新建页面组件 `src/pages/CampaignHistory.tsx`
- 设计列表展示历史 Campaign，重点突出刚过期的 Campaign（如高亮或置顶）
- 支持分页和搜索（可选）

#### 4.2.2 链接入口
- 在主界面（如 Dashboard Header 或 Campaign 相关模块）增加“历史 Campaign”链接按钮
- 点击跳转至历史 Campaign 页面

#### 4.2.3 数据请求
- 新增 Hook `useCampaignHistory`，调用后端 `/api/campaigns/history` 接口获取数据
- 结合现有 UI 组件（Table/List）展示数据

### 4.3 其他
- 编写单元测试覆盖后端持久化和 API
- 编写前端组件测试和集成测试
- 更新 API 文档（OpenAPI）包含新接口

## 5. 依赖关系
- 依赖数据库迁移和后端持久化功能完成
- 依赖后端 API 实现完成后前端才能调用
- 可能依赖现有 Campaign 数据结构和定时任务框架

## 6. 验收标准
- 数据库存在 `campaign_history` 表，且能正确存储历史 Campaign
- 后端提供 `/api/campaigns/history` 接口，返回正确的历史 Campaign 数据
- 前端主界面有“历史 Campaign”入口链接，点击跳转至历史 Campaign 页面
- 历史 Campaign 页面能正确分页展示数据，且刚过期 Campaign 明显区分
- 相关单元测试和集成测试通过
- API 文档更新完成

## 7. 复杂度评估
- **Medium**  
  理由：涉及数据库设计与迁移、后端定时任务和 API 开发、前端新页面设计及数据展示，跨前后端协作，工作量适中但需保证数据准确和用户体验。