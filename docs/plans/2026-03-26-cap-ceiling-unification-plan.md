# Incentive Cap/Ceiling 命名统一方案

> 目标读者：后续负责审查和执行的 coding agents
> 状态：Implemented (Phase 0–2 in repo)
> 日期：2026-03-26

## 背景与问题

当前代码中，激励约束语义已经在公式层面有分类（pool budget / deposit ceiling / per-user reward ceiling），但命名在实现层仍混用 `cap` 与 `ceiling`，且不同机制来源不同：

- Merit Self：前端从 `message` 文本解析 `selfCapUsd`（本质是 deposit ceiling）
- Brevis：后端直接下发 `perUserRewardCapUsd`（本质是 reward ceiling）
- UI：统一通过 `capNote` / `capWarning` 展示

这导致两个问题：

1. 术语不够一致，阅读成本高
2. 新增 cap 机制时容易复制粘贴、语义漂移

## 目标

1. 统一概念命名：在“领域层”优先使用 `ceiling` 语义
2. 保持 API 兼容：不修改后端字段契约
3. 保持 UI 稳定：`capNote` / `capWarning` 暂不重命名，避免不必要波动
4. 为后续扩展提供统一模型，降低耦合

## 非目标

- 不改动后端返回字段（例如 `perUserRewardCapUsd`）
- 不改变当前模拟计算结果和 UI 文案行为
- 不在本次引入跨页面大规模重构

## 命名决策

### 1) 分层命名策略

- **API 层（保持原样）**
  - 继续使用：`perUserRewardCapUsd` 等既有字段
- **领域层（新增统一语义）**
  - 使用：`depositCeilingUsd`, `rewardCeilingUsd` 等名称
- **UI 展示层（暂时保留）**
  - 继续使用：`capNote`, `capWarning`

### 2) 为什么不“一刀切全部改 ceiling”

- `capNote/capWarning` 已广泛用于展示层，强改收益低、回归风险高
- `cap` 可作为 UI 通用展示词；`ceiling` 更适合领域语义表达
- API 字段受后端约束，不应在本次重命名中破坏契约稳定性

## 统一模型（提案）

新增轻量领域模型（interface + helpers，不使用 class）：

```ts
export interface IncentiveCeilingEffect {
  kind: 'deposit_ceiling' | 'reward_ceiling' | 'pool_budget' | 'apr_ceiling';
  scope: 'per_user' | 'pool';
  window: 'round_cycle' | 'campaign_lifetime' | 'unknown';
  noteParts: string[];
  warning: boolean;
  metrics?: {
    depositCeilingUsd?: number;
    rewardCeilingUsd?: number;
    eligibleDepositUsd?: number;
    daysToHitCeiling?: number | null;
    remainingDays?: number | null;
  };
}
```

说明：

- 该结构只在前端领域计算中使用
- 最终仍映射为现有 UI 所需字段：`capNote` / `capWarning`

## 分阶段执行计划

### Phase 0: 对齐文档（低风险）

1. 更新 `docs/rate-calculation-formulas.md`
   - 补充“命名分层规则（API/领域/UI）”
   - 明确 `selfCapUsd` 对应 `depositCeilingUsd` 语义
2. 更新 `AGENTS.md`
   - 增加短规则：领域层优先 `ceiling` 术语，API 契约字段保留原名

交付标准：

- 文档中出现明确的命名规则和示例映射表

### Phase 1: 建立领域适配层（不改行为）

1. 在 `src/lib/` 新增统一 helper（建议：`incentiveCeilings.ts`）
2. 实现适配函数：
   - Merit Self -> `IncentiveCeilingEffect` (`deposit_ceiling`)
   - Brevis cap -> `IncentiveCeilingEffect` (`reward_ceiling`)
   - Merkl pool budget/APR cap -> `IncentiveCeilingEffect`（先最小覆盖已有展示分支）
3. 在 `useRateSimulation` 中改为调用统一 helper，然后映射回：
   - `capNote = effect.noteParts.join(' · ')`
   - `capWarning = effect.warning`

交付标准：

- `useRateSimulation` 业务行为与当前一致
- 仅重构组织方式，不改变用户可见计算结果

### Phase 2: 测试与回归加固

1. 单测新增
   - `src/lib/incentiveCeilings.test.ts`
   - 覆盖 Merit/Brevis/Merkl 三类 ceiling effect 生成
2. 现有测试回归
   - `src/lib/meritForecast.test.ts`
   - `src/lib/brevisForecast.test.ts`
   - `src/hooks/useRateSimulation.test.ts`
3. 文案快照/断言
   - 确认 `capNote` 字符串保持兼容（尤其 `Eligible supply capped at …`, `Reward capped at …/user`, `~Nd earn`）

交付标准：

- 无行为回归
- 新 helper 分支覆盖率达到可维护水平

### Phase 3: 渐进清理（可选）

1. 在内部变量中逐步替换为 `*Ceiling*` 术语（保留对外字段）
2. 增加 lint 规则/代码审查约定（可选）
   - 新增逻辑尽量通过统一 helper 输出 `capNote/capWarning`

交付标准：

- 新代码不再新增语义混乱命名

## 映射表（必须遵守）

| 层级 | 当前字段/概念 | 统一语义名 | 处理策略 |
|---|---|---|---|
| API | `perUserRewardCapUsd` | `rewardCeilingUsd` | 保留 API 原字段，adapter 映射 |
| Merit 解析 | `selfCapUsd` | `depositCeilingUsd` | 可在领域层别名映射，原变量可暂保留 |
| UI | `capNote` | `ceilingNote`(概念) | 字段名暂不改，避免大面积波动 |
| UI | `capWarning` | `ceilingWarning`(概念) | 字段名暂不改，避免大面积波动 |

## 风险与规避

### 风险 1：过度重命名导致回归

- 规避：坚持“API 不动、UI 字段不动、先加 adapter”

### 风险 2：Self 与 Brevis 语义被错误合并

- 规避：`kind` 必须区分 `deposit_ceiling` 与 `reward_ceiling`

### 风险 3：文案变化引发 UX 偏差

- 规避：Phase 1 明确“不改文案行为”，仅重构生成路径

## 回滚策略

如果 Phase 1 出现回归：

1. 回退 `useRateSimulation` 对新 helper 的接入
2. 保留文档与测试补充（不影响运行）
3. 拆小改动后重新接入（先 Merit，再 Brevis，再 Merkl）

## 审查清单（给执行 agent）

- [x] 未修改后端契约字段名
- [x] `capNote/capWarning` 对外接口未破坏
- [x] Self 和 Brevis 的 ceiling kind 明确区分
- [x] 现有测试全部通过
- [x] 新增测试覆盖统一 helper
- [x] 文档已同步（`rate-calculation-formulas.md` + `AGENTS.md`）

## 建议执行顺序

1. 先提一个 docs-only PR（Phase 0）
2. 再提 refactor PR（Phase 1 + Phase 2）
3. 可选再做 clean-up PR（Phase 3）

这样审查成本最低，也便于快速回滚。
