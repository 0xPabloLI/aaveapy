# 开发方案 - AAV-80 个人position/liquidity

## 1. Issue 概述
实现用户个人持仓（position）和流动性（liquidity）展示功能，支持用户查看自己在Aave协议中的资产和负债情况，提升产品的个性化和用户粘性。

## 2. 当前状态
未开始。  
目前前端已有部分模拟个人投资组合的功能（usePortfolioSimulation hook，portfolioCalculator.ts），但尚未实现钱包连接和真实用户数据的获取与展示。后端暂无用户个人持仓相关API支持。

## 3. 影响范围
- 前端仓库：aaveapy/lovable  
- 后端仓库：aave-protocol-analysis/railway  

## 4. 实现方案

### 4.1 后端实现

- **新增用户持仓数据接口**  
  - 文件：`backend/src/controllers/userPositionController.ts`（新建）  
  - 路由：新增 `/api/user/positions` GET接口，返回用户在各个市场的存款、借款、抵押等详细数据  
  - 逻辑：  
    - 通过用户钱包地址参数，调用链上RPC接口（或缓存数据库）获取用户在Aave V3/V4的持仓数据  
    - 结合市场数据（利率、价格等）计算用户资产价值、负债价值及流动性指标  
  - 依赖服务：`onchainDataService.ts`扩展，支持按用户地址查询持仓数据  

- **数据缓存与性能优化**  
  - 设计缓存策略，避免频繁链上查询  
  - 可考虑定时同步用户持仓快照（针对活跃用户）  

### 4.2 前端实现

- **钱包连接功能**  
  - 文件：`src/components/wallet/WalletConnector.tsx`（新建或扩展）  
  - 集成主流钱包连接库（如 ethers.js + web3modal）  
  - 支持用户连接/断开钱包，获取钱包地址  

- **个人持仓数据请求与展示**  
  - Hook：`src/hooks/useUserPositions.ts`（新建）  
    - 负责调用后端 `/api/user/positions` 接口，获取并管理用户持仓数据状态  
  - 组件：`src/components/dashboard/UserPositions.tsx`（新建）  
    - 展示用户各资产的存款、借款、抵押额度、流动性等信息  
    - 支持分页、排序和筛选  
  - 集成到主Dashboard页面（`src/pages/Index.tsx`或`src/components/dashboard/Portfolio.tsx`）  

- **UI/UX设计**  
  - 设计简洁明了的个人资产视图  
  - 显示关键指标：总资产价值、总负债价值、净流动性、各资产明细等  

### 4.3 数据流变更

- 用户通过钱包连接获取地址  
- 前端调用后端接口获取该地址的持仓数据  
- 后端调用链上RPC或数据库缓存获取数据并返回  
- 前端渲染展示用户个人持仓和流动性信息  

## 5. 依赖关系
- 钱包连接功能（AAV-106/105/66部分实现）  
- 链上RPC数据支持（onchainDataService扩展）  
- 可能依赖后端缓存和性能优化方案（后续迭代）  

## 6. 验收标准
- 用户能够通过钱包连接成功登录  
- 前端能正确展示用户在Aave协议中的存款、借款、抵押等持仓数据  
- 数据准确反映链上状态，且响应时间合理（<2秒）  
- UI界面友好，支持基本交互（排序、筛选）  
- 后端接口稳定，支持高并发访问  
- 代码覆盖率达到团队标准，且无严重安全漏洞  

## 7. 复杂度评估
**Medium**  
理由：涉及前后端联动，需实现钱包连接、链上数据查询及缓存，且对性能和用户体验有一定要求，但已有部分模拟功能和链上数据服务基础，开发难度中等。