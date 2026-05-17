# 开发方案：AAV-105 倒入黑名单，自动识别是不是在黑名单

## 1. Issue 概述
实现黑名单功能，支持将地址倒入黑名单，并在前后端自动识别用户地址是否在黑名单中，从而限制或调整相关功能的访问和展示。

## 2. 当前状态
未开始。  
目前后端已有部分 whitelistOnly 标志，但无完整黑名单管理和识别机制，前端无钱包连接和黑名单识别功能。

## 3. 影响范围
- 后端：aave-protocol-analysis/railway（黑名单数据存储与API支持）  
- 前端：aaveapy/lovable（钱包连接、黑名单识别及UI提示）

## 4. 实现方案

### 4.1 后端实现

#### 4.1.1 数据库设计
- 新建 `blacklist` 表，字段示例：
  - `address` (主键，string)
  - `addedAt` (timestamp)
  - `reason` (string，可选)
- 设计迁移脚本放入 `backend/migrations/`。

#### 4.1.2 服务层
- 在 `persistenceService.ts` 增加黑名单相关接口：
  - `addToBlacklist(address: string, reason?: string)`
  - `removeFromBlacklist(address: string)`
  - `isBlacklisted(address: string): Promise<boolean>`
  - `getBlacklist(): Promise<string[]>`

#### 4.1.3 API接口
- 新增黑名单管理API（仅限管理员调用，鉴权待规划）：
  - `POST /api/admin/blacklist` - 添加地址
  - `DELETE /api/admin/blacklist/:address` - 移除地址
  - `GET /api/blacklist` - 获取当前黑名单列表
- 在 `/api/meta/side-data` 或独立接口返回黑名单列表或黑名单状态查询接口，供前端调用。

#### 4.1.4 中间件支持
- 如有需要，在关键API请求中增加黑名单校验逻辑，拒绝黑名单用户访问敏感接口。

### 4.2 前端实现

#### 4.2.1 钱包连接
- 集成钱包连接功能（如 MetaMask），获取当前用户地址（若已有相关钱包连接方案，复用）。

#### 4.2.2 黑名单识别
- 调用后端黑名单查询接口，判断当前钱包地址是否在黑名单中。
- 在 `src/hooks/` 新增 `useBlacklistStatus.ts`，封装黑名单状态查询逻辑。

#### 4.2.3 UI提示
- 在全局 Header 或关键页面显著位置显示黑名单提示（如弹窗或Banner），告知用户其地址被限制。
- 禁用或隐藏黑名单用户无法操作的功能按钮。

#### 4.2.4 黑名单导入
- 设计后台管理页面（可选，后续迭代）或通过命令行脚本导入黑名单地址。

## 5. 依赖关系
- 钱包连接功能（若无需钱包连接，则无法自动识别用户地址）
- 后端鉴权机制（管理员权限管理，确保黑名单管理接口安全）
- 可能依赖 AAV-106/105/66（Whitelist/Blacklist相关功能）

## 6. 验收标准
- 后端数据库成功存储黑名单地址，API接口正常增删查黑名单数据。
- 前端能正确识别当前连接钱包地址是否在黑名单中。
- 黑名单用户访问受限功能时，页面有明显提示且功能被禁用。
- 管理员能够通过API接口添加和移除黑名单地址。
- 黑名单状态实时更新，刷新页面后仍保持正确状态。

## 7. 复杂度评估
Medium  
涉及数据库设计、后端API开发、前端钱包集成及状态管理，需保证安全性和用户体验，且需考虑权限控制和数据同步。