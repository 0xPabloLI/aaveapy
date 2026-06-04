# 开发方案 - AAV-130 资产集中度展示

## 1. Issue 概述
实现资产集中度（Concentration Risk）数据的展示，重点体现如 rsETH 和 wETH 这类资产的集中借贷情况。数据需支持按用户维度（钱包地址）展示持仓和借贷规模，帮助用户了解市场中高杠杆和集中风险的分布情况。同时前端界面需新增对应展示模块。

## 2. 当前状态
- 未开始。  
- 目前后端已有部分市场数据和借贷数据，但无按用户维度的集中度数据统计和展示。  
- 前端暂无相关展示组件。

## 3. 影响范围
- 后端：aave-protocol-analysis 仓库 railway 分支  
- 前端：aaveapy 仓库 lovable 分支

## 4. 实现方案

### 4.1 后端实现

#### 4.1.1 数据采集与存储
- **新增数据库表**（migration）  
  - `user_asset_exposure`：存储用户地址、资产类型、持仓量（collateral）、借贷量（borrowed）、时间戳等字段。  
- **数据来源**  
  - 利用现有 on-chain RPC 数据服务（onchainDataService.ts）扩展，定期抓取各用户在重点资产（如 rsETH、wETH）上的抵押和借贷信息。  
  - 结合 marketsService.ts，筛选出高风险资产和高杠杆用户。  
- **数据更新**  
  - 在 updateScheduler.ts 中新增定时任务，定期更新用户资产集中度数据，写入数据库。

#### 4.1.2 API 扩展
- 新增接口 `/api/markets/concentration`，返回按资产和用户维度的集中度数据，结构示例：
  ```ts
  interface UserExposure {
    userAddress: string;
    collateralAmount: number;
    borrowedAmount: number;
  }
  interface AssetConcentration {
    assetSymbol: string;
    totalCollateral: number;
    totalBorrowed: number;
    topUsers: UserExposure[];
  }
  ```
- API 返回重点资产的集中度情况，包含总量和前若干高杠杆用户明细。

### 4.2 前端实现

#### 4.2.1 新增 ConcentrationRisk 组件
- 创建 `src/components/dashboard/ConcentrationRisk.tsx`  
- 组件功能：  
  - 调用 `/api/markets/concentration` 获取数据  
  - 以表格或图表形式展示资产集中度，重点显示 rsETH、wETH 等资产的用户持仓分布  
  - 支持展开查看具体高杠杆用户地址及其持仓/借贷金额  

#### 4.2.2 页面集成
- 在主 Dashboard 页面（如 `src/pages/Index.tsx` 或 `src/components/dashboard/ReservesTable.tsx`）新增 ConcentrationRisk 组件入口，确保用户能方便访问该信息。

#### 4.2.3 样式与交互
- 使用 TailwindCSS 设计简洁明了的展示界面  
- 支持搜索或筛选用户地址（可选）

### 4.3 数据流变更
- 后端定时任务采集用户资产集中度数据，写入数据库  
- API 提供按资产和用户维度的集中度数据  
- 前端调用API并渲染，供用户查看

## 5. 依赖关系
- 依赖后端 on-chain 数据采集能力完善  
- 依赖数据库支持新增表结构  
- 需协调后端API设计与前端展示需求

## 6. 验收标准
- 后端数据库成功存储用户资产集中度数据  
- 新增API `/api/markets/concentration` 返回正确且及时的集中度数据  
- 前端 ConcentrationRisk 组件正确调用API并展示数据  
- 能清晰看到 rsETH、wETH 等重点资产的集中借贷情况及高杠杆用户明细  
- 代码通过单元测试和集成测试，部署后无明显性能问题

## 7. 复杂度评估
- Medium  
- 理由：涉及链上数据采集、数据库设计、定时任务调度、API设计及前端新组件开发，跨前后端协作，数据量和实时性要求较高，但已有基础设施支持，难度适中。