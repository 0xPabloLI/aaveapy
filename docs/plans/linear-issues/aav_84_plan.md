# 开发方案 - AAV-84 根据输入金额/token自动推荐存到哪些reserve最划算

## 1. Issue 概述
实现一个功能，用户输入金额或指定token后，系统自动推荐将资金存入哪些Aave reserve（资产池）最划算。推荐依据应综合考虑当前APY、激励奖励、流动性限制、风险参数等因素，帮助用户做出最优存款决策。

## 2. 当前状态
未开始。代码库中已有部分相关功能基础，如前端已有ReservesTable展示各reserve数据，后端提供完整的reserve数据及激励信息，且已有portfolio simulation相关hook，但尚无自动推荐逻辑。

## 3. 影响范围
- 前端仓库：aaveapy/lovable 分支
- 后端仓库：aave-protocol-analysis/railway 分支（视推荐算法复杂度，可能需新增API支持）

## 4. 实现方案

### 4.1 后端部分（可选，视推荐算法复杂度决定）
- **目标**：提供一个API接口，接收用户输入的金额和token，返回推荐的reserve列表及理由。
- **文件修改/新增**：
  - `backend/src/controllers/recommendationController.ts`（新建）
  - `backend/src/routes/recommendationRoutes.ts`（新建）
  - `backend/src/services/recommendationService.ts`（新建）
- **关键逻辑**：
  - 解析输入token及金额，转换为统一计价单位（如USD）
  - 遍历当前所有reserve，计算存入该reserve的预期收益（APY + 激励奖励折算）
  - 考虑reserve的流动性限制（supplyCapPct）、风险参数（如是否可作为抵押）
  - 根据综合收益排序，筛选出前N个推荐reserve
- **数据流变更**：
  - 新增 `/api/recommendations` GET或POST接口，输入参数：tokenAddress, amount
  - 返回推荐reserve列表，包含reserveId、预期收益率、流动性状态等

### 4.2 前端部分
- **目标**：新增推荐组件，允许用户输入金额和token，展示推荐结果，支持快速点击存入。
- **文件修改/新增**：
  - `src/components/dashboard/RecommendationInput.tsx`（新建）
  - `src/components/dashboard/RecommendedReservesList.tsx`（新建）
  - `src/hooks/useRecommendations.ts`（新建，调用后端推荐API）
  - 修改 `src/pages/Index.tsx` 或 Dashboard主页面，集成推荐组件
- **关键逻辑**：
  - 输入框支持token选择（可复用已有token选择组件）和金额输入
  - 调用后端推荐API，获取推荐reserve列表
  - 列表展示每个reserve的名称、预期收益、流动性状态等
  - 支持点击快速跳转到存款操作（可跳转到对应reserve详情或弹窗）
- **数据流变更**：
  - 新增调用 `/api/recommendations` 接口
  - 结合已有的reserve数据展示逻辑，增强用户体验

### 4.3 推荐算法设计（核心）
- 计算公式示例：
  - 预期收益 = supplyAPY + incentiveAPR（折算为同一单位）
  - 考虑流动性剩余量，若不足则降低权重或排除
  - 可选加入风险调整系数（如是否可作为抵押）
- 推荐结果排序，默认返回前3~5个reserve

## 5. 依赖关系
- 依赖后端已稳定提供reserve实时数据及激励信息（已实现）
- 依赖前端已有token选择组件和reserve展示组件
- 可能依赖AAV-91（APY预测）作为未来增强推荐的输入

## 6. 验收标准
- 用户在推荐组件输入token和金额后，能看到合理排序的推荐reserve列表
- 推荐结果正确反映当前APY和激励奖励情况
- 推荐reserve均满足流动性和风险基本要求
- 点击推荐项能跳转或触发存款操作
- 推荐接口响应时间合理，前端无明显卡顿
- 代码覆盖单元测试，接口有集成测试

## 7. 复杂度评估
**Medium**  
理由：涉及前后端联动，需设计合理的推荐算法，保证性能和准确性。前端交互较复杂，需良好用户体验设计。后端推荐服务相对独立，便于后续迭代优化。

---

以上为AAV-84的详细开发方案，建议先从后端推荐服务接口设计入手，随后实现前端交互组件，最后调优推荐算法。