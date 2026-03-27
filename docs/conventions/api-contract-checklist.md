# API Contract Checklist

> 当后端 API 做 breaking change 时，确保前端/脚本全部同步。
> 可直接复制到其他项目使用。

---

## 自动防护（已落实）

以下机制会在 API 格式不匹配时**自动失败**，无需人工逐文件检查：

| 防线 | 触发时机 | 检测原理 |
|------|---------|---------|
| **运行时 schema 验证** | 每次页面加载 | `useAaveMarkets.ts` 用 `MarketsResponseSchema.safeParse()` 验证 API 响应，schema 过时 = 页面报错 |
| **Live API 测试** | `main` push / `workflow_dispatch` | `apiSchemas.live.test.ts` 请求 staging 并用 Zod schema 验证；CI 优先走 Railway 直连，若仍需处理 Cloudflare staging 拦截，见 [ci-live-schema-cloudflare.md](./ci-live-schema-cloudflare.md) |
| **Mock 测试** | 每次 CI build | `apiSchemas.test.ts` 验证 mock payload 格式正确性 |
| **sync-token-icons --check** | hardcode-drift-check 定时 CI | 脚本解析 API 响应，字段名不对 = 报错 |

**核心原则**：`apiSchemas.ts` 中的 Zod schema 是唯一真相源（single source of truth），运行时和测试都引用它。Schema 过时 → 运行时验证失败 + CI 红 → 不可能漏。

## 手动检查步骤（仅在主动变更 API 时需要）

```bash
# 1. 查看真实 API 返回的 top-level keys
curl -s https://api.aaveapy.com/api/markets | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(list(d.keys()))"

# 2. 更新 schema → 所有消费方自动跟随
# 修改 src/lib/apiSchemas.ts 中的 MarketsResponseSchema

# 3. 运行测试验证全链路
npx vitest run src/lib/apiSchemas.live.test.ts  # 真实 API
npx vitest run src/lib/apiSchemas.test.ts       # mock 格式
node scripts/sync-token-icons.mjs --check       # 脚本解析

# 4. 全局搜索旧字段名（例如从 .reserves 改名时）
grep -rn 'payload\.reserves\|\.reserves\b' src/ scripts/ --include='*.ts' --include='*.tsx' --include='*.mjs'
```

## 涉及文件清单

后端 `/api/markets` 响应格式变更时，需同步修改以下位置：

| # | 文件 | 用途 | 自动检测？ |
|---|------|------|-----------|
| 1 | `src/lib/apiSchemas.ts` | Zod schema（唯一真相源） | ✅ live test |
| 2 | `src/types/aave.ts` | TypeScript 接口定义 | ✅ 编译检查 |
| 3 | `src/hooks/useAaveMarkets.ts` | 运行时 safeParse | ✅ 运行时 |
| 4 | `src/lib/apiSchemas.test.ts` | Mock 测试 | ✅ CI test |
| 5 | `src/lib/apiSchemas.live.test.ts` | Live API 测试 | ✅ CI test |
| 6 | `scripts/sync-token-icons.mjs` | CI 脚本 | ✅ --check |
| 7 | `src/pages/Index.tsx` | 页面消费 | ✅ TypeScript |
| 8 | `src/lib/cache.ts` | 缓存读写 | ✅ 类型透传 |
| 9 | `src/lib/marketsList.ts` | 工具函数 | ✅ TypeScript |
| 10 | `src/components/dev/RateInputsVsMarketCheck.tsx` | 调试面板 | ✅ TypeScript |

## 历史教训

### 2026-03-27: `GET /api/markets` 收益率字段（HTTP 对外语义）

**结论（最重要）**

- `GET /api/markets` 里所有与「收益率」相关的数字，**对外仍是百分数**：例如 `2.07` 表示 **2.07%**，不是 `0.0207`。
- 本次多为**后端内部**把快照里的收益率统一为年化比例，在**响应序列化时统一 ×100** 再输出。
- 若前端已按百分数展示（直接拼 `%`、不再乘除 100），**一般无需改逻辑**。

**仍应按「百分数」理解的字段（与文档一致）**

| 区域 | 字段 |
|------|------|
| Reserve | `reserves[].supplyApy`、`borrowApy` |
| Incentives | `reserves[].supplyIncentives[]`、`borrowIncentives[]` |
| Merit | `reserves[].meritSupplys[]`、`meritBorrows[]` 中的 `apr`、`selfApr`（若有） |
| Merkl | `reserves[].merkl*[]`（各 Merkl 数组）中 `breakdowns[]` 的 `campaignApr`、`aprCap`（若有；`null` 仍为 `null`） |
| Brevis | `reserves[].brevisSupplys`、`brevisBorrows` 中的 `campaignApr` |

**前端自检**

1. **不要二次换算**：不要对以上字段再 `*100` 或 `/100`（除非存在单独的「小数比例」状态层，且明确与 API 脱钩）。
2. **回归核对**：Merkl 的 `campaignApr` / `aprCap`、Brevis 的 `campaignApr` 是否与产品预期一致（后端对 Merkl `campaign.apr` 已固定按上游百分数换算；cap 来自 `distributionSettings.apr` 比例再 ×100 输出）。

### 2026-03-16: `data` → `reserves` 迁移遗漏

- **问题**：后端将 `{ data: [...], lastUpdated }` 改为 `{ snapshot: { lastUpdated }, reserves: [...] }`
- **已更新**：`useAaveMarkets.ts`、`types/aave.ts`、`Index.tsx` 等运行时代码
- **遗漏**：`apiSchemas.ts`（Zod schema 仍用 `.data`）、`sync-token-icons.mjs`（仍解析 `payload.data`）
- **影响**：
  - Schema 测试假绿（用旧格式 mock 验证旧 schema，永远 pass）
  - CI hardcode-drift-check 永远失败（API 200 但解析为空 → fallback → 474 假缺失 → issue）
- **修复后新增防线**：运行时 safeParse + live API test + schema 作为唯一真相源
