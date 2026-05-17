# AAV-127 Liquidity 页面开发方案

## 1. Issue 概述
需要新增一个专门展示各市场（per market）流动性（liquidity）情况的页面。该页面应清晰展示每个市场的流动性指标，方便用户快速了解整体和单个市场的资金状况。

## 2. 当前状态
未开始。代码库中暂无专门的 Liquidity 页面，相关流动性数据在 ReservesTable 等组件中部分展示，但缺少集中展示和分析页面。

## 3. 影响范围
- 前端：aaveapy 仓库 lovable 分支
- 后端：aave-protocol-analysis 仓库 railway 分支（视是否需要新增或调整接口）

## 4. 实现方案

### 4.1 后端部分（如需）

- **评估现有接口**  
  目前 `/api/markets` 接口已返回所有市场的 reserve 数据及流动性相关字段（如 liquidity、availableLiquidity、totalLiquidity 等）。  
  只要数据完整，无需新增接口。若数据不全，需在 `backend/src/services/marketsService.ts` 中补充流动性相关字段的计算和序列化。

- **文件修改**  
  - `backend/src/services/marketsService.ts`（如需补充字段）  
  - `backend/src/services/marketsApiSerialize.ts`（确保接口返回完整流动性数据）

- **数据流**  
  后端定时抓取并缓存流动性数据，API 直接返回给前端。

### 4.2 前端部分

- **新增页面**  
  - 文件：`src/pages/LiquidityPage.tsx`  
  - 路由：新增 `/liquidity` 路由入口（修改 `src/pages/index.tsx` 或路由配置文件）  

- **页面功能**  
  - 调用后端 `/api/markets` 获取所有市场数据  
  - 以表格或图表形式展示每个市场的流动性指标（如总流动性、可用流动性、流动性利用率等）  
  - 支持按市场名称、流动性大小排序  
  - 支持搜索过滤市场  
  - 可考虑展示历史流动性趋势（若后端支持历史数据）  

- **组件复用**  
  - 可复用 `src/components/dashboard/ReservesTable` 的部分逻辑和样式，或新建专门的 `LiquidityTable` 组件  
  - 使用已有的排序、过滤工具（`src/lib/sorters.ts`、`src/components/dashboard/FilterBar`）  

- **样式**  
  - 使用 TailwindCSS 统一风格  
  - 保持响应式设计，兼容移动端  

- **文件修改**  
  - 新增 `src/pages/LiquidityPage.tsx`  
  - 可能新增 `src/components/dashboard/LiquidityTable.tsx`  
  - 路由配置文件（如 `src/main.tsx` 或路由相关文件）  
  - 可能调整 `src/hooks/useAaveMarkets.ts` 以支持流动性专用数据获取  

- **数据流**  
  页面加载时调用 API，数据通过 React state 管理，支持用户交互（排序、搜索）。

## 5. 依赖关系
- 依赖后端 `/api/markets` 接口完整返回流动性数据（现有接口应满足）  
- 依赖前端已有的市场数据获取 hooks 和表格组件逻辑  
- 无需依赖其他未完成 Issue  

## 6. 验收标准
- 新增 `/liquidity` 页面可访问，且在主导航或其他入口可达  
- 页面正确调用后端接口，展示所有市场的流动性数据  
- 支持排序和搜索功能，交互流畅无明显卡顿  
- UI 样式符合整体设计规范，响应式良好  
- 无明显前后端错误或异常日志  
- 代码覆盖单元测试（如适用）  

## 7. 复杂度评估
**Medium**  
理由：  
- 需要新增页面及相关组件，涉及前端路由和数据展示逻辑  
- 后端接口大概率无需改动，降低复杂度  
- 需保证数据准确性和良好用户体验  
- 需考虑未来扩展（如历史趋势展示）  

---

以上方案旨在快速搭建一个功能完整、用户体验良好的 Liquidity 页面，方便用户查看和分析各市场流动性情况。