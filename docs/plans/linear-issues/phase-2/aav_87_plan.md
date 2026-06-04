# 开发方案：AAV-87 ！推荐资产swap后的存储

## 1. Issue 概述
实现推荐资产（推荐的swap资产）在用户操作swap后，能够将相关数据进行持久化存储。目的是支持后续的数据分析、用户行为追踪及优化推荐逻辑。

## 2. 当前状态
未开始。代码库中暂无针对推荐资产swap后数据存储的相关实现。

## 3. 影响范围
- 前端仓库：aaveapy/lovable 分支  
  负责捕获用户swap操作及推荐资产相关事件，向后端发送存储请求。
- 后端仓库：aave-protocol-analysis/railway 分支  
  负责接收前端请求，持久化存储推荐资产swap数据，提供查询接口。

## 4. 实现方案

### 4.1 后端实现

#### 4.1.1 数据库设计
- 新建数据库表 `recommended_asset_swaps`，字段示例：
  - id (主键)
  - user_id (可选，若支持用户登录)
  - timestamp (swap时间)
  - from_asset (swap源资产标识)
  - to_asset (swap目标资产标识)
  - amount (swap数量)
  - recommendation_source (推荐来源，如算法ID或版本号)
  - additional_metadata (JSON，存储额外信息)

#### 4.1.2 持久化服务
- 在 `backend/src/services/persistenceService.ts` 新增方法 `storeRecommendedAssetSwap(data)`，负责写入数据库。

#### 4.1.3 API 接口
- 新增 Express 路由 `/api/recommended-swap`，支持 POST 请求，接收前端发送的swap数据。
- 在 `backend/src/controllers/recommendedSwapController.ts` 实现请求处理逻辑，调用持久化服务存储数据。

#### 4.1.4 安全与验证
- 对请求参数做严格校验（使用已有的schema验证工具）。
- 若支持用户登录，需校验身份，防止伪造数据。

### 4.2 前端实现

#### 4.2.1 事件捕获
- 在推荐资产swap相关组件（可能在 `src/components/dashboard/` 或 swap逻辑相关文件）中，监听用户完成swap操作事件。

#### 4.2.2 数据收集与发送
- 收集swap相关数据（from_asset, to_asset, amount, 推荐来源等）。
- 使用已有API请求封装工具，向后端 `/api/recommended-swap` 发送POST请求。

#### 4.2.3 用户体验
- 确保数据发送异步且不阻塞用户操作。
- 处理异常情况（如网络失败）可考虑重试或本地缓存。

### 4.3 数据流变更
- 用户完成swap → 前端捕获事件 → 发送推荐资产swap数据到后端 → 后端存储到数据库 → 后续可通过API查询分析。

## 5. 依赖关系
- 需要用户身份体系支持（若需关联用户），否则可匿名存储。
- 依赖后端数据库扩容及权限配置。
- 推荐资产算法或版本号的定义（用于标记recommendation_source字段）。

## 6. 验收标准
- 用户完成推荐资产swap后，相关数据成功写入数据库。
- 后端API接口正确响应，参数校验严格。
- 前端发送数据无明显性能影响，异常情况有合理处理。
- 通过后端接口能查询到历史推荐资产swap数据。
- 代码覆盖单元测试，接口集成测试通过。

## 7. 复杂度评估
Medium  
理由：涉及前后端联动，数据库设计及接口安全校验，需保证数据准确且不影响用户体验，且后续可能扩展分析功能。