# Technical Architecture

> 单一真相源：项目技术架构概览。详细约定见 `docs/conventions/`，设计系统见 `docs/design/`。

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| UI | React 19 + TypeScript 5 | 函数式组件 + hooks |
| Build | Vite (rolldown-vite) 8 + SWC | `advancedChunks` 分组 vendor chunk + 600 KB warning limit；首屏路径由 build 守卫插件强制 |
| State | TanStack React Query 5 | 预取 + instant hydration + 动态 staleTime |
| Validation | Zod | 前端与脚本共享 schema |
| Test | Vitest + Testing Library + Playwright | co-located 单测 + E2E |
| i18n | i18next | 4 locale（en, fr, pt-BR, tr） |
| CI | GitHub Actions | 12 workflows，Husky pre-commit/pre-push hooks |
| Scripts | Node 22 `--experimental-strip-types` | 无 tsx 依赖，直接运行 .ts |

## Directory Structure

```
src/
├── components/       # UI 组件
│   ├── dashboard/    # 核心市场数据 UI（70+ 文件）
│   ├── ui/           # shadcn/radix 基础组件（21 文件）
│   ├── primitives/   # TokenIcon 等
│   ├── landing/      # 本地化落地页
│   └── seo/          # SEO head
├── hooks/            # React hooks
│   ├── useAaveMarkets.ts
│   ├── useSideDataMeta.ts
│   ├── useRateSimulation.ts       # 核心模拟（1937 行）
│   ├── usePortfolioSimulation.ts
│   └── reserves-table/            # 8 个聚合 hook + co-located 单测
├── lib/              # 纯函数/业务逻辑（91 文件）
│   ├── apiSchemas.ts              # re-export shared + 前端专用 schema
│   ├── apiBase.ts
│   ├── cache.ts                   # 版本化 localStorage 缓存
│   ├── interestRateCalculator.ts  # Aave 两斜率利率模型
│   ├── merklForecast.ts / meritForecast.ts
│   ├── scenarioSize.ts / formatters.ts / sorters.ts
│   └── portfolioCalculator.ts
├── types/            # TypeScript 类型
│   ├── aave.ts                    # ReserveWithSpread, MarketsResponse
│   ├── portfolio.ts               # Portfolio 类型
│   └── field-canary.test.ts       # 字段名穷举 canary
├── shared/           # 前端↔脚本共享模块
│   └── market-contract/           # /markets Zod schema 权威定义
├── config/           # queryStaleTimes 等配置常量
├── test/             # 架构守卫 + 回归测试
├── integrations/     # Supabase client
├── providers/        # Error Boundary 等 Provider 组件
├── i18n/ + locales/  # i18next 初始化 + 翻译文件
├── ui-config/        # reservePatches 显示覆盖
└── pages/            # 6 个路由页面

scripts/
├── sync-*.mjs        # 上游同步脚本
├── check-*.mjs       # 上游漂移校验
├── generate-*.mjs    # icon manifest 生成
├── lib/              # 共享工具（14 文件）
│   ├── market-fetch.ts            # 脚本端 schema 校验桥接
│   ├── default-api-bases.mjs     # API base URL 常量
│   ├── fetch-utils.mjs           # 通用 fetch 工具
│   └── write-generated-file-if-changed.mjs
└── data/             # 静态数据（pending-chain-icon-bases.json）

e2e/                  # Playwright E2E（reserves、simulation、mobile、API 字段）
public/               # 静态资源（icons/、openapi.json、sitemap.xml）
docs/                 # 约定 + 设计 + 方案
```

## Data Flow

```
API (GET /markets + GET /meta/side-data)
    │
    ▼
Zod Schema (src/shared/market-contract/schemas.ts)
    │  MarketsResponseSchema.safeParse(raw)
    │  SideDataMetaResponseSchema.parse(raw)
    ▼
TypeScript Types (src/types/aave.ts)
    │
    ▼
Cache (src/lib/cache.ts)
    │  版本化 localStorage，版本不匹配 → 自动清除
    ▼
React Query (useAaveMarkets / useSideDataMeta)
    │  initialData: cachedEntry?.data — instant hydration
    │  staleTime: 从后端 snapshot.staleTimeMs 动态推导
    ▼
UI Components (ReservesTable → DesktopReserveRow / MobileReserveCard)
    │
    ▼
Simulation (useRateSimulation → interestRateCalculator + *Forecast)
    │
    ▼
Display (formatters.ts + scenarioSize.ts)
```

## Wallet Position Data Flow（三路合并）

```
reserves (from /markets API)
    │
    ├─→ computeGapChainIds(reserves, sdkCoverage) → { v3Gap, v4Gap }
    │
    ├─→ [SDK path] V3 SDK hooks + V4 SDK hooks
    │       │
    │       ├─ SDK success → sdkPositions (source: 'sdk')
    │       │
    │       └─ SDK failure (isInfrastructureFailure) → existing full fallback
    │               ├─ V3 fallback: all chains → source: 'onchain-v3'
    │               └─ V4 fallback: all chains → source: 'onchain-v4'
    │
    └─→ [Gap path] enabled = SDK succeeded AND gapChainIds non-empty
            ├─ V3 gap: only gap chains → source: 'gap-v3'
            └─ V4 gap: only gap chains → source: 'gap-v4'

    mergeAndDedupPositions(sdkPositions, fallbackPositions, gapPositions)
        → dedup by reserveId::side, SDK priority highest
    mergeFailedSources(sdkFailed, fallbackFailed, gapFailed)
```

- **SDK path**: Aave GraphQL SDK 查用户仓位，覆盖 address-book 中已注册链
- **Onchain fallback**: SDK 基础设施失败时触发，查询**全部**链的链上合约（ADR-0003 reactive 模式）
- **Gap fallback**: SDK 成功但覆盖不全时触发，仅查询**差集链**的链上合约（ADR-0006）
- **三路合并**: `mergeAndDedupPositions` 按 `reserveId::side` 去重，SDK > gap > onchain 优先级

## Shared Schema Architecture

```
src/shared/market-contract/schemas.ts   ← 权威 Zod schema（单一真相源）
    ├── src/lib/apiSchemas.ts            ← 前端 re-export + 附加专用 schema
    │       └── useAaveMarkets.ts        ← safeParse + cache fallback
    └── scripts/lib/market-fetch.ts      ← 脚本直接 import，严格校验
```

- 共享模块类型**内联定义**，不用 `@/` alias（Node `--experimental-strip-types` 不解析）
- `.mjs` 入口通过 `await import('./lib/foo.ts')` 动态引入 `.ts` 桥接
- `.passthrough()` 允许未知字段透传，向前兼容

## Error Handling: Frontend vs Scripts

| 场景 | 前端 | 脚本 |
|------|------|------|
| Schema 校验失败 | `safeParse` → cache fallback → 有 cache 就用 | `safeParse` → 直接 throw |
| 网络失败 | try/catch → 返回缓存数据 | 直接 throw（带 status + url） |
| Deficit 无价格 | `sanitizeDeficitWithoutPrice()` | N/A |
| 组件渲染错误 | `SdkErrorBoundary` → 友好提示 + 重试按钮 | N/A |

> 前端优先可用性（优雅降级），脚本优先正确性（严格校验）。两者不应合并。

### SdkErrorBoundary

`src/providers/SdkErrorBoundary.tsx` 包裹路由内容（`App.tsx`），捕获 SDK 数据加载等渲染异常，展示友好提示并提供重试按钮。详见 AAV-116。

## Simulation Architecture

```
useRateSimulation
    ├── interestRateCalculator.ts    # Aave 两斜率模型（V3/V4 统一）
    ├── merklForecast.ts            # MAX/FIX/DUTCH forecast (Merkl + Brevis unified)
    ├── meritForecast.ts            # Merit forecast (TVL dilution + position cap overlay)
    ├── incentiveCaps.ts              # cap 效应模型
    ├── hubAggregation.ts           # V4 Hub 跨 spoke 聚合
    ├── scenarioSize.ts             # USD 换算
    └── formatters.ts               # APR→APY + 格式化
```

- USD 计算全部前端推导（`nativeToUsd`），后端 `*Usd` 字段已移除（`BannedReserveUsdFields` 编译期拦截）
- `reserveId` 是 canonical key，禁止 composite-key fallback

## Build & CI

- **Vite plugins**: React SWC、`generateOpenApiPlugin()`、`deployShaMetaPlugin()`、`selectiveModulePreloadPlugin()`（首屏/内容分阶段 modulepreload 白名单）、`assertFirstPaintChunksPlugin()`（entry 静态闭包触达重型 chunk 时 fail build）、`componentTagger()`
- **Chunk 策略**: `rollupOptions.output.advancedChunks` 正则分组（rolldown 原生 API，替代 manualChunks 模拟）；钱包/SDK 代码（vendor-blockchain/vendor-aave）只允许经 `WalletProviders`/`AaveProviders` lazy 边界到达，约束由 `assertFirstPaintChunksPlugin` 与 `src/test/architecture-guard.test.ts` 双层守卫
- **Validation gate**: `npm run lint && npm test && npm run build && npx tsc --noEmit`
- **Hardcode sync**: cron job 双轮 sync + verify，漂移自动创 issue/PR
- **Architecture guard**: `src/test/architecture-guard.test.ts` 禁止 disableTooltip、重复 className、ring→Tooltip 导入

## Key References

| Topic | Document |
|-------|----------|
| 数据加载详情 | `docs/frontend-data-loading-matrix.md` |
| 利率计算 | `docs/rate-calculation.md` |
| 脚本/schema 约定 | `docs/conventions/scripts-and-schema-lessons.md` |
| 设计系统 | `docs/design/DESIGN.md` + `DESIGN-SYSTEM-REFERENCE.md` |
| API 合约 | `docs/conventions/api-contract-checklist.md` |
| Fallback 链 | `docs/fallback-reference.md` |
