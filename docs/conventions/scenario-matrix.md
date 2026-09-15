# Scenario & Risk Verification Matrix

## Why

R2/R3 实施要求主动做适用的场景风险分析。本文档定义风险分析的维度、输出格式和 evidence contract，确保每个已识别风险都有可追溯验证，而不是把每行机械转换成测试。

## When

R2/R3 且涉及**数据流、计算对齐、跨组件或跨 step 契约、高风险既有行为**时必须做场景分析。纯 UI 样式、文案或其他 R1 修改不强制。

## How

### 决策阶段

按 `scenario-enumeration-checklist.md` 逐类检查适用边界，验证各消费者行为一致性。R3 修改必须列出 Modified Files Impact；R2 至少记录会改变行为或契约的文件。

### 记录位置

- S1：记录在当前 scope、todo 或验证计划中，不为矩阵单独创建 spec。
- S2/S3：固化到 spec；R3 spec 无 Modified Files Impact 与 Behavioral Scenarios = 不完整。

S2/S3 的 R3 spec 包含**两个必填 section**：

#### Section 1: Modified Files Impact（修改影响评估）

R3 修改已有文件时必填。纯新建且没有既有消费者时可标为 N/A 并说明原因。

格式：

```
| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| path/to/file.ts | 修改了什么 | Low/Medium/High | 为什么这个风险可接受/已缓解 |
```

风险等级判定：

- **Low** — 纯追加（新函数、新 section），不修改现有逻辑
- **Medium** — 修改现有函数行为、改变数据流、修改有下游消费者的接口
- **High** — 修改核心路径（发布流程、认证、核心管线等），或修改有多个消费者的公共接口

评估必须回答：

1. 修改是否影响现有功能？如何验证？
2. 下游消费者是否受影响？
3. 如果出错，最坏后果是什么？

#### Section 2: Behavioral Scenarios（行为场景矩阵）

格式（列名按实际消费者调整）：

```
| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| 1 | ...      | ...               | ...  | automated test / static-type-lint / runtime-real-data / human acceptance | ... |
```

### Evidence Contract

矩阵每一行都是 verification obligation，必须指定至少一种 evidence：

- **automated test**：预期行为确定，且存在稳定、预先同意的 seam；先 red，再 green。
- **static/type/lint check**：类型、schema、格式、导入边界或文档指针等静态约束。
- **runtime or real-data smoke test**：依赖浏览器、媒体、外部进程、真实格式或跨 step 组合的行为。涉及外部依赖（合约、第三方 API）的集成测试必须用真实端点，不用 mock。
- **human acceptance**：视觉取舍、内容判断或明确保留给 HITL 的行为。

只有确定且可在稳定 seam 自动验证的行为强制 TDD。一个测试可以覆盖多行，一行也可以需要多种 evidence，但映射必须可追溯；不得为了「一行一测」制造脆弱或无行为价值的测试。
