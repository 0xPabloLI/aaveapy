# Scenario & Risk Verification Matrix

## Why

`docs/lessons/rate-simulation.md` 记录了 AAV-1060/1086/1120/1140 等 bug——根因都是 Grill 阶段没有充分穷举场景，导致跨组件数据不一致。

## When

涉及**数据流、计算对齐、跨组件契约**的决策，必须做场景矩阵。纯 UI 样式、文案修改不强制。

## How

### Grill 阶段

穷举边界场景，验证各消费者行为一致性：
- wallet / no-wallet
- input / no-input
- hidden / visible
- 不同 mode（single / portfolio）

### Spec 阶段

固化成场景矩阵，**无矩阵 = spec 不完整**。

格式：

```
| 场景 | 输入状态 | 消费者A 期望 | 消费者B 期望 | 必须一致的原因 |
|------|---------|-------------|-------------|---------------|
| ...  | ...     | ...         | ...         | ...           |
```

列名按实际消费者调整（如 Calculator / Tooltip / Table Row）。

### TDD 阶段

矩阵每一行 = 一个测试用例，必须全部覆盖。
