# AAV-827 Frontend Handoff: AMOUNT 变体 Campaign APR 显示

## 依赖
**BLOCKED** — 需要后端先完成以下工作：
1. AMOUNT 变体 `campaignApr` 返回正确的 USD APR（而非 token 利率）
2. 增加 `campaignAprUnavailable` 标记
3. `campaignAprUnavailableReason` 字段

## 前端需要做的事

### 1. `getMerklBreakdownApr` 增加不可用判断

文件：`src/lib/merklForecast.ts`

```typescript
// 当 campaignAprUnavailable = true 时，不显示 APR
// 返回 0 或特殊值，让上层组件知道这是"不可用"而非"零收益"
```

### 2. Incentive 行显示降级

文件：`src/components/dashboard/` 相关组件

- 检查 `campaignAprUnavailable` → 显示 em dash (—)
- Tooltip: "无法计算 USD APR（reward token 无价格）"

### 3. 类型定义更新

文件：`src/types/aave.ts`

```typescript
// MerklCampaignBreakdown 增加字段
campaignAprUnavailable?: boolean;
campaignAprUnavailableReason?: string;
```

文件：`src/shared/market-contract/schemas.ts`

```typescript
// API schema 增加可选字段
campaignAprUnavailable: z.boolean().optional();
```

## 约束
1. **不显示 0%** — 用户会误解为"无收益"
2. **em dash + tooltip 是当前方案** — 未来可能需要显示 token 利率原始值

## 文档已更新
- `docs/rate-calculation.md` Part 2 — 新增 "FIX Mode Variables by Distribution Variant" 章节
  - 完整变量表（API vs Frontend 计算）
  - 单位一致性验证（VALUE / AMOUNT_PER_VALUE / AMOUNT_PER_AMOUNT）
  - AMOUNT 变体的 USD APR 问题说明
