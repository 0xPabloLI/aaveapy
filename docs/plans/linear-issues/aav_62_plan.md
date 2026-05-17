# 开发方案：支持导入现有portfolio (AAV-62)

## 1. Issue 概述
实现用户能够导入已有的投资组合（portfolio）数据功能，方便用户将外部或历史的资产持仓信息导入到 AaveAPY 项目中进行模拟和分析。

## 2. 当前状态
未开始。当前项目已有 portfolio 相关的模拟功能（usePortfolioSimulation hook，portfolioCalculator.ts），但尚无导入现有 portfolio 数据的功能。

## 3. 影响范围
- 前端仓库：aaveapy / lovable 分支
- 可能涉及后端仓库：aave-protocol-analysis / railway 分支（视导入数据是否需要后端存储或校验）

## 4. 实现方案

### 4.1 前端实现

#### 4.1.1 新增导入入口组件
- 文件：`src/components/dashboard/PortfolioImport.tsx`（新建）
- 功能：
  - 提供文件上传（JSON/CSV）或文本粘贴输入框
  - 支持常见格式的 portfolio 数据导入（例如包含 token 地址、数量、链信息等）
  - 简单格式校验和错误提示

#### 4.1.2 解析与格式转换
- 在 `src/hooks/usePortfolioSimulation.ts` 或新建 `src/hooks/usePortfolioImport.ts` 中实现导入数据的解析和转换逻辑
- 将导入数据转换为现有 portfolio 模拟所需的标准数据结构（符合 `src/types/portfolio.ts` 中定义）

#### 4.1.3 集成导入功能到 Portfolio 相关页面
- 文件：`src/components/dashboard/Portfolio.tsx`（修改）
- 在界面中增加“导入现有portfolio”按钮，点击弹出导入组件
- 导入成功后，将数据传递给 portfolio 模拟逻辑，更新模拟结果展示

### 4.2 后端支持（可选）

- 评估是否需要后端接口支持导入数据的校验或持久化
- 若需要，新增 API 接口 `/api/portfolio/import`，实现数据校验和存储
- 相关文件：
  - `backend/src/controllers/portfolioController.ts`（新建）
  - `backend/src/routes/portfolioRoutes.ts`（新建）
  - `backend/src/services/portfolioService.ts`（新建或扩展）

### 4.3 数据流变更

- 用户上传或粘贴 portfolio 数据 → 前端解析转换 → 调用 portfolio 模拟 hook → 更新模拟结果展示
- （可选）前端调用后端接口进行数据校验或存储

## 5. 依赖关系
- 依赖现有 portfolio 模拟功能（usePortfolioSimulation）
- 可能依赖后端持久化设计（当前无持久化，需评估）

## 6. 验收标准
- 用户能够通过文件上传或文本粘贴方式导入 portfolio 数据
- 导入数据格式支持 JSON 和 CSV（至少一种）
- 导入后，portfolio 模拟结果正确更新，界面展示正常
- 导入错误时，给出明确错误提示
- （如涉及后端）导入数据通过后端校验且持久化成功

## 7. 复杂度评估
Medium  
理由：前端涉及文件解析、格式转换和 UI 交互实现，需保证数据格式兼容和错误处理；后端支持为可选项，增加一定复杂度。整体技术难度中等。