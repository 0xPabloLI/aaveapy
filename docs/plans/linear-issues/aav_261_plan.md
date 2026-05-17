# 开发方案：AAV-261 增加oracle price对比及差异报警提示

## 1. Issue 概述
在前端市场数据展示中，增加对oracle价格与其他价格源（如Coingecko、Merkl、Merit等）的对比功能。当价格存在显著差异时，显示报警符号并提示具体差异数值，帮助用户及时发现价格异常风险。

## 2. 当前状态
- **未开始**：目前后端已有oracle价格服务（oracleService.ts），前端展示价格主要来自后端统一接口，但无价格对比及差异报警功能。
- 相关价格数据源（oracle、Coingecko等）均已在后端采集，但未统一对比。

## 3. 影响范围
- **后端**：aave-protocol-analysis/railway（railway分支）
- **前端**：aaveapy/lovable分支

## 4. 实现方案

### 4.1 后端改动

#### 4.1.1 数据准备
- 在`backend/src/services/marketsService.ts`或相关数据聚合逻辑中，确保oracle价格与其他价格源（如Coingecko价格）均可获取。
- 设计并实现一个价格对比函数，计算oracle价格与其他价格源的差异百分比。

#### 4.1.2 API扩展
- 在`backend/src/services/marketsApiSerialize.ts`中，扩展市场API响应结构，新增字段：
  - `oraclePrice`（已有）
  - `coingeckoPrice`（已有或新增）
  - `priceDiffPercent`：oracle与coingecko价格的差异百分比
  - `priceDiffAlert`：布尔值，表示是否超过阈值触发报警
- 阈值可配置（例如5%），放入配置文件`src/config.ts`。

#### 4.1.3 配置和阈值管理
- 在`src/config.ts`添加`priceDiffAlertThreshold`配置项，方便调整报警灵敏度。

### 4.2 前端改动

#### 4.2.1 数据接收与处理
- 在`src/hooks/useAaveMarkets.ts`中，确保新API字段被正确接收和类型定义（更新`aave.ts`类型定义）。
- 在`src/types/aave.ts`中新增对应字段。

#### 4.2.2 UI展示
- 在`src/components/dashboard/ReservesTable/`相关文件中，增加价格差异报警符号（如感叹号图标）。
- 鼠标悬浮或点击报警符号时，显示Tooltip，内容为“Oracle price differs from Coingecko by X%”。
- 设计报警符号样式，符合整体UI风格，使用TailwindCSS。

#### 4.2.3 交互体验
- 保持报警符号不影响表格排序和过滤功能。
- 可考虑在FilterBar中增加“仅显示价格异常资产”筛选项（可选）。

### 4.3 测试
- 后端单元测试覆盖价格差异计算及阈值判断逻辑。
- 前端单元测试覆盖新字段显示和Tooltip交互。
- 集成测试确保API数据正确传递，UI正确渲染。

## 5. 依赖关系
- 无直接依赖其他未完成Issue，但建议结合AAV-261完成后端API文档更新（如OpenAPI文档）。
- 需确认后端oracle价格与其他价格源数据稳定性。

## 6. 验收标准
- 后端API返回数据包含oracle价格、其他价格源价格、差异百分比及报警布尔字段。
- 前端市场表格中，价格差异超过阈值的资产显示报警符号。
- 鼠标悬浮报警符号显示具体差异百分比提示。
- 价格差异低于阈值时不显示报警符号。
- 相关单元测试和集成测试通过。
- 手动验证多个市场资产，确认报警符号准确显示。

## 7. 复杂度评估
- **Medium**
- 理由：涉及后端数据聚合与API扩展，前端UI改动及交互设计，需保证数据准确性和良好用户体验，但功能相对单一，技术难度中等。

---

此方案旨在通过合理的数据对比和友好的UI提示，提升用户对价格风险的感知能力，增强AaveAPY的市场数据可信度。