# 硬编码与外部依赖清单（前端）

更新时间：2026-03-13  
适用仓库：`aaveapy`（前端）

## 1. 本仓库实际消费的 interface 映射资源

| 资源主题 | 上游来源 | 本地文件 | 实际使用入口 |
|---|---|---|---|
| reserve patch（地址级 symbol/name/logo 修正） | `aave/interface/src/ui-config/reservePatches.ts` | `src/ui-config/reservePatches.ts` | `fetchIconSymbolAndName()` |
| 市场名映射 | `aave/interface/src/ui-config/marketsConfig.tsx` | `src/lib/aaveLinks.ts` (`MARKET_NAME_MAP`) | `buildAaveReserveUrl()` |
| 链图标映射 | `aave/interface/src/ui-config/networksConfig.ts` | `src/lib/chainIconMap.ts` | `getChainIconSrc()` |
| token icon 候选集合 | reservePatches + SYMBOL_MAP + 运行时 `/markets` | `scripts/lib/token-icon-symbols.mjs` | `sync-token-icons.mjs` 计算 required symbols |

关键点：
- token icons 不再靠手工 `EXTRA_SYMBOLS`。
- required symbols 每次由“当前代码映射 + 当前运行时市场数据”实时推导。

## 2. 自动化链路（GitHub Actions）

当前真实工作流：
- `.github/workflows/hardcode-sync.yml`

触发：
- `schedule`: `20 4 * * *`（每日 04:20 UTC）
- `workflow_dispatch`
- `repository_dispatch`（`types: [upstream-change]`）

执行步骤（核心）：
1. `npm run hardcode:sync`
2. `npm run hardcode:verify`
3. 失败后再做一轮 sync + verify
4. verify 通过则自动建 PR；持续失败则建 issue 并 fail job

## 3. 同步与校验脚本分工

| 目标 | 同步脚本 | 校验脚本 |
|---|---|---|
| reserve patches | `scripts/sync-reserve-patches-upstream.mjs` | `scripts/check-reserve-patches-upstream.mjs` |
| market name map | `scripts/sync-market-name-map-upstream.mjs` | `scripts/check-market-name-map-upstream.mjs` |
| chain icon map | `scripts/sync-chain-icon-map-upstream.mjs` | `scripts/check-chain-icon-map-upstream.mjs` |
| token icons | `scripts/sync-token-icons.mjs` | `scripts/sync-token-icons.mjs --check` + `scripts/check-hardcode-icons.mjs` |

`hardcode:verify` 当前命令链：
- `check:hardcode-icons`
- `check:reserve-patches-upstream`
- `check:market-name-map-upstream`
- `check:chain-icons-upstream`
- `sync-token-icons -- --check`

## 4. Token Icon Backup 策略（当前实现）

### 4.1 required symbols 怎么来
每次运行 `sync-token-icons` 时，按以下来源合并：
1. `reservePatches` 的 `underlyingAssetMap.iconSymbol`
2. `SYMBOL_MAP` 映射值
3. 运行时 `/markets` 返回 token（按与前端一致规则映射后得到 icon key）

### 4.2 下载策略（backup-first）
对缺失的 required symbol：
1. 先用 CoinGecko symbol 精确匹配下载
2. 若 CoinGecko 查不到，回退到地址级 `logoURI`（tokenlist 或 reservePatches）下载
3. 最终落盘到 `public/icons/tokens/`（扩展名按响应自动判断，如 `.png/.svg`）

这保证了：
- 本地静态 backup 目标不丢
- `wrapped`/RWA 等 symbol 不标准的资产也可通过地址级 logo 补齐

### 4.3 `--check` 语义
- 只要存在“缺失但可同步”的图标（CoinGecko 或 logoURI 可拿到），`--check` 就会 fail。
- 所有可同步项都补齐后，`--check` 才通过。

## 5. 外部依赖分层

### 5.1 运行时数据 API
`sync-coingecko-platform-map.mjs` / `check-coingecko-platform-map-upstream.mjs` 拉取 `/markets` 时：优先读**进程环境变量** `LIVE_TEST_API_BASE_CI`，其次 `VITE_API_BASE_URL`，再回退 `https://api.aaveapy.com/api`。

在 GitHub Actions 里，该名字与 **Repository variable**（`Settings` → `Secrets and variables` → `Actions` → `Variables`，键名 `LIVE_TEST_API_BASE_CI`）一致：workflow 用 `vars.LIVE_TEST_API_BASE_CI` 写入 job 的 `env.LIVE_TEST_API_BASE_CI`，脚本即可读到。未配置变量时，`hardcode-drift-check` / `hardcode-sync` 与 `ci.yml` 的 live-schema 一样回退到 `https://staging-api.aaveapy.com/api`。详见 `docs/conventions/ci-live-schema-cloudflare.md`。

`VITE_API_BASE_URL`（默认 `https://api.aaveapy.com/api`）：
- `/markets`
- `/markets/stats`
- `/markets/list`
- `/coingecko-categories`
- `/coingecko-fdv`

### 5.2 CoinGecko
- 运行时兜底：`https://api.coingecko.com/api/v3/search`（`useCoingeckoTokenImage`）
- 离线落盘：`sync-token-icons.mjs` 同一搜索接口

### 5.3 上游源码抓取（脚本）
- `https://raw.githubusercontent.com/aave/interface/main/src/ui-config/reservePatches.ts`
- `https://raw.githubusercontent.com/aave/interface/main/src/ui-config/marketsConfig.tsx`
- `https://raw.githubusercontent.com/aave/interface/main/src/ui-config/networksConfig.ts`

### 5.4 外链（非数据依赖）
- `app.aave.com`、`app.merkl.xyz`、`apps.aavechan.com`、`incentra.brevis.network`
- Ink 组件内 CoinGecko/CoinMarketCap/社媒链接

## 6. 有意保留的业务 hardcode（非上游镜像）

| 项目 | 文件 | 说明 |
|---|---|---|
| 以太坊市场分组名 | `src/types/aave.ts` (`ETHEREUM_MARKET_NAMES`) | UI 展示策略 |
| 默认分类词表 | `src/types/aave.ts` (`STABLECOINS`/`ETH_RELATED`/`BTC_RELATED`/`PENDLE_TOKENS`) | 业务默认值（可被 API 覆盖） |
| TYDRO 点值 | `src/lib/tydro.ts` (`TYDRO_POINT_TO_USD_RATE`) | 业务参数 |
| Ink 参考点 | `src/components/dashboard/InkAprCalculator.tsx` (`REFERENCE_POINTS`) | 产品参数 |

## 7. 本地巡检命令

```bash
npm run hardcode:sync
npm run hardcode:verify
npm run sync-token-icons -- --check
```

## 8. 当前状态结论

- 映射同步：reserve patches / market map / chain map 均已对齐校验。
- token icon：已采用 backup-first 策略，支持 CoinGecko + logoURI 回退。
- workflow：以 `hardcode-sync.yml` 为单一自动化入口。
