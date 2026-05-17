# 开发方案 - AAV-67 读取自己的portfolio

## 1. Issue 概述
实现用户能够读取并展示自己在Aave协议中的个人资产组合（portfolio）信息。包括用户持有的资产、借贷情况、利率、奖励等相关数据，支持前端展示和后端数据接口支持。

## 2. 当前状态
未开始。  
目前前端已有部分 portfolio simulation 功能（usePortfolioSimulation hook、portfolioCalculator.ts），但尚未实现用户钱包连接及真实用户数据读取。

## 3. 影响范围
- 前端仓库：aaveapy / lovable 分支  
- 后端仓库：aave-protocol-analysis / railway 分支（可能需要新增或扩展API接口支持）

## 4. 实现方案

### 4.1 前端实现

#### 4.1.1 钱包连接功能
- 新增钱包连接组件（WalletConnectButton.tsx 或集成第三方钱包库如 wagmi/ethers.js）
- 状态管理中新增用户钱包地址状态（Context或Recoil/Redux）

#### 4.1.2 读取用户portfolio数据
- 新增API调用接口（src/lib/api.ts）调用后端新增的用户portfolio接口
- 使用已有的 `usePortfolioSimulation` hook 结合真实用户数据进行计算和展示
- 在 `src/components/dashboard/Portfolio` 目录下完善个人资产组合展示组件，支持资产列表、借贷详情、奖励信息等

#### 4.1.3 UI/UX
- 在 Dashboard 页面增加“我的组合”入口或Tab
- 增加加载态、错误处理和无数据提示

### 4.2 后端实现

#### 4.2.1 新增用户portfolio数据接口
- 在 `backend/src/routes/` 新增 `/api/portfolio` 路由，支持根据用户钱包地址查询
- 在 `backend/src/controllers/portfolioController.ts` 实现逻辑，调用 `marketsService.ts`、`onchainDataService.ts` 等服务获取用户在各个市场的持仓、借贷、奖励等信息
- 结合 on-chain RPC 数据和数据库缓存，返回结构化的用户portfolio数据

#### 4.2.2 数据结构设计
- 定义用户portfolio的TypeScript类型（backend 和前端共享类型库或单独定义）
- 返回数据包括资产token地址、余额、借贷量、利率、奖励token及数量等

### 4.3 数据流变更
- 用户钱包地址通过前端传递给后端接口
- 后端根据地址调用链上数据和数据库，聚合用户资产组合数据
- 前端接收数据后结合模拟计算，展示给用户

## 5. 依赖关系
- 钱包连接功能（AAV-106/105/66 部分实现，但无钱包连接）
- 可能依赖后端 onchainDataService 的完善和稳定性
- 需确保后端API安全性和性能

## 6. 验收标准
- 用户可以通过钱包连接按钮连接自己的钱包
- 成功连接后，Dashboard中“我的组合”页面正确显示用户资产、借贷、奖励等信息
- 数据与链上实际持仓基本一致，误差在合理范围内
- 异常情况下（如无资产、网络错误）有合理提示
- API接口响应时间满足性能要求

## 7. 复杂度评估
Medium  
理由：涉及前端钱包连接集成、后端链上数据聚合及接口设计，需保证数据准确性和性能，且前后端协同开发。已有部分模拟功能可复用，降低部分复杂度。