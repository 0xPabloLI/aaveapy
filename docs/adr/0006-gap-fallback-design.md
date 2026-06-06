# Gap Fallback: SDK Coverage Gap 补链设计

SDK 成功返回但覆盖不全（address-book 含链而 SDK 不含）时，触发 gap fallback 补齐差集链仓位。与现有 onchain fallback（SDK 失败时全量替代）互补，组成三路合并架构。

## Context

`buildV3MarketInputs` 中 `if (!pool) continue` 对 `V3_POOL_ADDRESSES` 未覆盖的链静默跳过，SDK 不报错也不 fallback，用户在该链上的仓位无感知丢失（AAV-451）。现有 onchain fallback 仅在 SDK 整体失败时触发，无法覆盖"SDK 成功但覆盖不全"的中间态。

## Decision Records

### Q1: 实现层级

**选 B: 编排层差集**（不侵入 SDK 逻辑，利用 reserves 数据做差集）

否决方案：
- A: SDK 层 patch → 侵入第三方包，升级风险高
- C: 后端补链 → 后端无补链逻辑，需协调多团队

### Q2: 策略确认

**选 B: 编排层差集**（纯前端运行时，不依赖后端变更）

后端 `/markets` 已返回所有链的 reserves，据此可计算 SDK 未覆盖的链集合。

### Q3: 触发时机

**选: SDK 成功后补充**

- SDK 成功返回 → 计算差集链 → 差集非空则触发 gap fallback
- SDK 失败（`isInfrastructureFailure`）→ 走现有全量 onchain fallback
- 两者互斥，不会同时触发

### Q4: V3/V4 差集粒度

**选: V3/V4 独立差集**

与 ADR-0003 独立降级策略一致，V3 和 V4 的 fallback 路径不同：
- V3 gap: 从 `v3AssetsByMarket` 中筛选只含 gap 链的条目
- V4 gap: 只遍历 `gapChainIds.v4Gap` 中的链

### Q5: 状态管理

**选: 独立 useQuery**

三路数据（SDK / existing fallback / gap fallback）独立管理，触发条件不同不耦合：
- SDK: `useV3UserSupplies` / `useV4UserSupplies` 等
- Existing fallback: `useQuery` triggered by `isInfrastructureFailure`
- Gap fallback: `useGapFallbackQuery` triggered by `sdkSucceeded && gapChainIds non-empty`

### Q6: 合并策略

**选: 三路合并 + reserveId 去重**

`mergeAndDedupPositions(sdkPositions, fallbackPositions, gapPositions)`:
- 三路 concat 后按 `reserveId::side` 去重
- 去重时 SDK 优先级最高（SDK 数据最权威）
- 失败源独立收集: `mergeFailedSources(sdkFailed, fallbackFailed, gapFailed)`

## Gap Fallback vs 现有 Onchain Fallback

| 维度 | 现有 Fallback | Gap Fallback |
|---|---|---|
| 触发条件 | SDK 失败（`isInfrastructureFailure`） | SDK 成功但覆盖不全 |
| 查询范围 | 全部链 | 仅差集链 |
| V3 构建 | 完整 `v3AssetsByMarket` | 从中筛选 gap 链条目 |
| V4 构建 | `Object.keys(V4_SPOKE_ADDRESSES)` | 仅 `gapChainIds.v4Gap` |
| 数据源标记 | `'onchain-v3'` / `'onchain-v4'` | `'gap-v3'` / `'gap-v4'` |

## Data Flow

```
reserves (from /markets API)
    │
    ├─→ computeGapChainIds(reserves, sdkCoverage) → { v3Gap, v4Gap }
    │
    ├─→ [SDK path] V3 SDK hooks + V4 SDK hooks
    │       ├─ SDK success → sdkPositions (source: 'sdk')
    │       └─ SDK failure → trigger existing fallback useQuery
    │               ├─ V3 fallback: all chains → source: 'onchain-v3'
    │               └─ V4 fallback: all chains → source: 'onchain-v4'
    │
    └─→ [Gap path] enabled = SDK succeeded AND gapChainIds non-empty
            ├─ V3 gap: only gap chains → source: 'gap-v3'
            └─ V4 gap: only gap chains → source: 'gap-v4'

    mergeAndDedupPositions(sdk, fallback, gap) → dedup by reserveId::side
    mergeFailedSources(sdkFailed, fallbackFailed, gapFailed)
```

## Consequences

- SDK 未覆盖的链不再静默丢失用户仓位
- 正常路径（SDK 全覆盖）无额外 RPC 消耗
- Gap fallback 与现有 fallback 互斥，不会重复查询
- 后续可收拢：提取共享 `fetchFallbackPositions(config, { chainFilter? })`，消除 gap 与 existing fallback 的逻辑重复（当前 gap 版有 chainFilter 语义差异，暂独立）

## References

- ADR-0003: Onchain Fallback Reactive Architecture
- ADR-0004: SDK Failure Classification / RPC Rotation / Timeout
- CONTEXT.md: "Onchain Fallback" / "SDK Degradation Boundary"
- AAV-451: 原始 issue
