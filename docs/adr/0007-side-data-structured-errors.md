# Side Data: 从 `partial: boolean` 改为结构化 `errors`

将 `sideData.partial` (boolean) 替换为 `sideData.errors` (结构化错误映射)，让前端和运维能精确知道哪个子源失败及原因。

## Context

`/meta/side-data` 聚合 4 个独立子源：categories、fdv、forecast、campaignAccess。任一子源可能独立失败（超时、限流、解析错误等），当前仅用 `partial: boolean` 标记"有子源失败"，无法区分具体哪个子源和失败原因。前端未消费 `partial`（全代码库无 `.partial` 属性访问），该字段是纯声明层死代码。

运维排查时无法从 `partial: true` 判断是 CoinGecko 限流导致 fdv 缺失，还是 Merkl API 挂了导致 forecast 缺失。用户提示也只能泛泛说"部分数据不可用"。

## Decision Records

### Q1: `errors` 值类型

**选: 纯 `string`**

否决方案：
- 结构化对象 `{ message, code?, retryable? }` — 当前前端不程序化消费错误码，过度设计；未来需要可重试逻辑时再扩展

### Q2: `errors` 键范围

**选: 严格限定 4 个子源键**

`errors` 的键只能是 `categories | fdv | forecast | campaignAccess`，与 sideData 顶层字段对齐。用 Zod `z.object({ categories: z.string().optional(), ... })` 而非 `z.record()`。

理由：新增子源本身就是跨前后端 breaking change，应显式同步。`.passthrough()` 兜底未知字段不丢失。

### Q3: 前端消费策略

**选: 方案 C — 仅更新类型/schema，不展示 UI**

否决方案：
- A: warning banner — 多子源同时失败时 banner 堆叠体验差，需设计交互规范
- B: debug 面板 — 当前项目无此基础设施，成本高

UI 展示作为后续独立 issue。

### Q4: `errors` 为空 vs 不存在

**选: 等价 — 均表示无错误**

后端实现：有错误才设 `errors`，无错误时不返回该字段。前端判断：`!data.errors` 或 `Object.keys(data.errors ?? {}).length === 0`。

### Q5: 部署顺序与迁移

**选: 无需过渡期**

两边 schema 均有 `.passthrough()` 保护：
- 前端先部署：后端仍发 `partial` → passthrough 兜底忽略；`errors` 不存在 → 判无错误
- 后端先部署：前端旧 schema passthrough 兜底，`errors` 透传但不被类型识别

## Type Definition

```typescript
// Before
partial?: boolean;

// After
errors?: {
  categories?: string;
  fdv?: string;
  forecast?: string;
  campaignAccess?: string;
};
```

## Zod Schema

```typescript
// Before
partial: z.boolean().optional(),

// After
errors: z.object({
  categories: z.string().optional(),
  fdv: z.string().optional(),
  forecast: z.string().optional(),
  campaignAccess: z.string().optional(),
}).optional(),
```

## Consequences

- 运维可从 `errors` 精确定位失败子源和原因
- 前端类型安全：`errors` 键受限，拼写错误在编译期捕获
- 部署安全：`.passthrough()` 兜底，两端可独立部署
- `partial` 字段彻底移除，消除死代码
- 前端不展示 UI，`errors` 纯作为数据契约预留

## References

- `src/hooks/useSideDataMeta.ts` — 类型定义
- `src/lib/apiSchemas.ts` — Zod schema
- CONTEXT.md: "Side Data Sub-Source" / "Side Data Errors"
- AAV-450: 原始 issue
