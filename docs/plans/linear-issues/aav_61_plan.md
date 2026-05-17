# 开发方案：AAV-61 - 更复杂的simulation，考虑不同supply和borrow

## 1. Issue 概述
实现更复杂的资产组合模拟功能，支持用户在模拟时分别调整不同资产的supply和borrow数量，进行多维度的收益和风险预测。现有的simulation功能较为基础，需增强灵活性和准确性，满足更细粒度的组合模拟需求。

## 2. 当前状态
- 状态：In Progress
- 现有基础：前端已有 `usePortfolioSimulation` hook 和相关计算逻辑（`portfolioCalculator.ts`），支持基础的组合模拟。
- 但目前模拟逻辑较简单，未支持对每个资产分别调整supply和borrow数量的复杂模拟。

## 3. 影响范围
- 前端仓库：aaveapy（lovable分支）
- 主要涉及：`src/hooks/usePortfolioSimulation.ts`，`src/lib/portfolioCalculator.ts`，以及相关UI组件（可能是Portfolio相关组件）

## 4. 实现方案

### 4.1 需求分析
- 支持用户输入或调整每个资产的supply数量和borrow数量（非简单比例调整）
- 计算基于调整后资产组合的收益率、风险指标、借贷成本等
- 保持模拟结果与后端数据一致，考虑利率模型、奖励激励等因素
- UI层面提供灵活的输入控件，展示模拟结果

### 4.2 具体步骤

#### 4.2.1 数据结构调整
- 修改或扩展 `PortfolioSimulationInput` 类型，支持每个资产单独的 `supplyAmount` 和 `borrowAmount` 字段
- 确保类型定义在 `src/types/portfolio.ts` 中同步更新

#### 4.2.2 计算逻辑增强（`portfolioCalculator.ts`）
- 修改计算函数，支持基于每个资产的独立supply和borrow数值进行收益和风险计算
- 引入更复杂的利率模型计算，考虑借贷利率、奖励APY、借贷成本等
- 计算组合的净收益率、风险指标（如杠杆率、流动性风险等）
- 保持计算性能，必要时做性能优化

#### 4.2.3 Hook增强（`usePortfolioSimulation.ts`）
- 修改hook接口，支持传入更复杂的输入结构
- 调用更新后的计算逻辑，返回详细模拟结果
- 支持异步计算（如果涉及后端调用或复杂计算）

#### 4.2.4 UI层面修改
- 在 `src/components/dashboard/Portfolio*` 相关组件中，添加输入控件，允许用户为每个资产输入或调整supply和borrow数量
- 实时展示模拟结果，支持交互体验
- 保持UI风格一致，使用TailwindCSS样式

#### 4.2.5 测试
- 单元测试：覆盖新增和修改的计算逻辑、hook逻辑
- 集成测试：验证UI交互和模拟结果展示
- 性能测试：确保模拟计算响应时间合理

### 4.3 代码文件列表（示例）
- `src/types/portfolio.ts` — 类型定义更新
- `src/lib/portfolioCalculator.ts` — 计算逻辑增强
- `src/hooks/usePortfolioSimulation.ts` — Hook接口和实现更新
- `src/components/dashboard/PortfolioSimulationInput.tsx` — 新增或修改输入组件
- `src/components/dashboard/PortfolioSimulationResults.tsx` — 结果展示组件
- 相关测试文件

## 5. 依赖关系
- 依赖现有的市场数据API（`/api/markets`）保证数据准确
- 依赖后端利率模型和奖励数据的准确性
- 可能依赖AAV-61相关的设计讨论和需求确认

## 6. 验收标准
- 用户可以为每个资产单独输入supply和borrow数量
- 模拟结果准确反映不同组合下的收益和风险
- UI交互流畅，响应及时
- 单元测试覆盖率达到90%以上，测试通过
- 无明显性能瓶颈，模拟计算响应时间<500ms

## 7. 复杂度评估
- 复杂度：Medium
- 理由：涉及前端多处改动，计算逻辑较复杂但已有基础，需保证性能和准确性，UI交互设计需合理。无后端改动，风险较低。