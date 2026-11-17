# AAV-1315 — 钱包仓位 partial 降级在 UI 无提示

> Status: implemented 2026-11-16（commit `b88a055e`）· Issue: [AAV-1315](https://linear.app/aaveapy/issue/AAV-1315) · Type: UI 可观测性（数据层已就绪）

## 背景与根因

AAV-1310 / AAV-1314 / AAV-1387 把「读不到」从静默假 $0 变成了 `failedSources`，但链路的最后一格没接：

- `useUserPositionsSdk` 在 `allFailedSources.length > 0` 时返回 `status: 'partial'`，并把 `failedSources` 放进 `result.data`；
- `walletLoadState` 只有 `idle | loading | success-empty | success | error`，partial 落到 `'success'`；
- `Index.tsx` 把 partial 与 success 走同一分支（照常导入仓位），`PortfolioPanel` 只渲染 `loading / success-empty / error` 三种状态。

于是「部分链 / 部分 spoke 失败、其余仓位读到了」在 UI 上与「钱包真只有这些仓位」完全不可区分。`src/components/**` 里 `failedSources` 命中数为 0。

后果的严重性：用户看到的是导入成功的 toast + 偏少的仓位，没有任何信号提示他再等等 / 换网络重试。

## 设计

最小闭环，不动状态机语义（不新增 `WalletLoadState` 枚举值）：

1. `useUserPositionsSdk` 返回值新增 `failedSources: string[]`（就是已去重、已合并的 `allFailedSources`，与 `result.data.failedSources` 同源）。`mergeFailedSources` 每次渲染都返回新数组，而 `PortfolioPanel` 是 `memo` 组件 ⇒ 用 `useMemo` 按 `join('\u0000')` 的 key 稳定引用：失败集不变时数组同一性不变，空集共用模块级 `EMPTY_FAILED_SOURCES`。
2. 透传链：`Index.tsx` → `ReservesTable`（`walletLoadState` 已有的同一条链路）→ `PortfolioPanel`，新 prop `failedSources?: string[]`（默认 `[]`，保持既有的可选 prop 约定）。
3. `PortfolioPanel` 在既有钱包状态行内追加：`walletLoadState === 'success' && failedSources.length > 0` 时显示琥珀色警示
   - 文案：`Incomplete sync — N source(s) unavailable`（单复数分档）；
   - `title`：`Unavailable sources: <逗号分隔>`，把具体源（如 `onchain-v3-chain-42220`）放在原生 tooltip；
   - 图标 `AlertTriangle`（仓库既有 icon）、颜色 `ds-text-amber-600`（仓库 design token `src/index.css`，不是裸 Tailwind `text-amber-*`）；
   - `role="status"`（出现时对屏幕阅读器播报一次；`title` 在触屏不可达属已知限制，见 Out of scope）；
   - `data-testid="wallet-partial-notice"` 供测试与运行时核验。
4. 不新增行、不加按钮：复用状态行（`success` 时该行本来是空 div），移动端不引入 `hover:`，沿用 `ds-text-11` 与既有间距 token。

**判据为什么是 `walletLoadState === 'success'`**：partial 在枚举里就是 `'success'`；`error` 要求 `allPositions.length === 0`，两条分支互斥，所以不会出现「红 + 琥珀」叠加。`success-empty` 的失败集必为空（否则它是 `error`），条件天然为假。

> **后续变更（AAV-1393）**：上面的 `title` 列源与 `Incomplete sync — N source(s) unavailable` 计数已不再面向用户——内部标签（`sdk-*` / `onchain-*` / `gap-*` / `spoke-*`）只留在 `data-failed-sources` 与 console，提示固定为 `Wallet data incomplete`；且只有 `sdk-*-fallback` 时不再提示（fallback 已补齐数据）。以 `docs/specs/aav-1393-wallet-sync-notice-copy.md` 为准。

**契约不变量**：`DegradedResult` 状态机零变更；`walletLoadState` 取值零变更；toast 文案零变更（自动导入仍照常导入）；`failedSources` 的构造仍只在 `mergeFailedSources` 里做一次去重。

## 接口契约

- `useUserPositionsSdk` 返回
  - `failedSources: string[]`：已合并去重的失败源标签；`idle` / 全成功时为 `[]`。
  - 其余字段（`walletLoadState` / `result` / `v3SdkFailed` / `v4SdkFailed` / `isLoading`）不变。
- `PortfolioPanelProps.failedSources?: string[]`（`ReservesTableProps.failedSources?: string[]` 同形）
  - 缺省/空数组：不渲染降级提示。
  - 非空且 `walletLoadState === 'success'`：渲染一条 `wallet-partial-notice`。
  - 非空但 `walletLoadState` 为 `loading` / `error` / `idle` / `success-empty`：不渲染（error 有自己的红字，loading 有自己的 Syncing）。
- 文案
  - `failedSources.length === 1`：`Incomplete sync — 1 source unavailable`
  - `>= 2`：`Incomplete sync — N sources unavailable`
  - `title`：`Unavailable sources: ${failedSources.join(', ')}`

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
| --- | --- | --- | --- |
| `src/hooks/useUserPositionsSdk.ts` | 返回值新增 `failedSources` | Low | 纯新增字段，无消费方被破坏 |
| `src/hooks/useUserPositionsSdk.test.tsx` | 新增 partial / 全成功有仓位 / 全成功空仓 / idle / 引用稳定性用例（H1–H5） | Low | 现有 mock 需加一层 overrides（见 T1） |
| `src/pages/Index.tsx` | 解构并透传 `failedSources` | Low | 与 `walletLoadState` 同一条链路 |
| `src/components/dashboard/ReservesTable.tsx` | 新增可选 prop 并透传 | Low | 纯转发 |
| `src/components/dashboard/PortfolioPanel.tsx` | 状态行追加琥珀降级提示 | Low | 只在 `success` + 非空失败集时新增一个 span |
| `src/components/dashboard/PortfolioPanel.walletSync.test.tsx` | 新增 7 条状态行用例（P1–P7，覆盖 M1–M9） | Low | 纯测试，复用既有渲染 helper |
| `src/components/dashboard/ReservesTable.test.tsx` | 新增 1 条 `PortfolioPanel` 透传用例（M12；子组件打桩） | Low | 只加 mock 与一条渲染用例，既有用例不进 portfolio 模式 |
| `docs/specs/aav-1315-wallet-partial-ui-notice.md`, `docs/DOCS-INDEX.md`, `docs/issue-roadmap.md` | spec 登记与状态 | Low | 文档 |

**风险判定依据**：

1. 是否影响现有功能？— 只新增一个条件渲染的 span；`success` 行的空 div 本来就存在。
2. 下游消费者？— `PortfolioPanel` 的另一个宿主 `ReservesTable` 同链路透传；其余调用方（测试）走默认 `[]`。
3. 最坏后果？— 提示误显示（失败集非空但数据其实完整）：文案只说「有源不可用」，不承诺缺多少仓位，可接受；漏显示则退回今天的行为。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
| --- | --- | --- | --- | --- | --- |
| M1 | 全源成功（`failedSources = []`，`success`） | 无提示 | High | `PortfolioPanel.walletSync.test.tsx` · P1 | 条件要求非空 |
| M2 | 部分链失败 + 有仓位（`success` + 2 源） | 琥珀提示 + 计数 2，仓位不受影响 | High | P2 | 条件只看 `success` + 非空 |
| M3 | 单源失败 | 单数文案 `1 source unavailable` | Medium | P3 | 单复数分支 |
| M4 | 全源失败、0 仓位（`error`） | 只显示既有 `Wallet sync failed`，无琥珀提示 | High | P4 | `error` ≠ `success` |
| M5 | idle / 未连接 | 整行不渲染 | Medium | P5 | 既有 `!== 'idle'` 守卫 |
| M6 | `loading` + 残留失败集 | 只显示 `Syncing…` | Medium | P6 | 条件限定 `success` |
| M7 | `success-empty` + 空失败集 | 只显示 `Wallet has no positions` | Medium | P7 | 条件要求非空 |
| M8 | `title` 列出具体源 | `Unavailable sources: a, b` | Medium | P2/P3 断言 `title` | 逗号 join |
| M9 | 多源顺序稳定 | 计数与 `failedSources.length` 一致（去重在 hook 侧完成） | Medium | P2 + `positionMerge.test.ts` 既有去重用例 | 组件不自行去重，避免两处逻辑 |
| M10 | hook 暴露 `failedSources` | partial 返回非空数组、全成功返回 `[]`、跨渲染引用稳定 | High | `useUserPositionsSdk.test.tsx` · H1/H2/H4/H5 | 与 `result.data.failedSources` 同源；`useMemo` 稳定引用 |
| M11 | 移动端 / 平板 / 桌面 | 状态行不破版；无 `hover:`；沿用 `ds-text-11` 与 `ds-text-amber-600` | Medium | 运行时浏览器核对（390 / 834 / 1440 三视口，console 0 error） | 复用既有行与 token |
| M12 | 透传链（Index → ReservesTable → PortfolioPanel） | `failedSources` 不被中间层丢弃 | High | `ReservesTable.test.tsx` 透传用例（删掉 `failedSources={failedSources}` 即红）+ `typecheck` | 与 `walletLoadState` 同链路，props 同形 |

## Runtime evidence（2026-11-16）

**组件级真浏览器渲染**（Vite dev `:8080` + Playwright，**390 / 834 / 1440** 三视口；临时 harness 页面渲染真实 `PortfolioPanel` 与真实 `index.css`，验证后删除、未提交）：

| 场景 | 结果 |
| --- | --- |
| `success` + `[onchain-v3-chain-42220, sdk-v4]`（390 / 834 / 1440） | 每档**恰好 1 条**提示；文本 `Incomplete sync — 2 sources unavailable`；`title` = `Unavailable sources: onchain-v3-chain-42220, sdk-v4`；`role="status"`；class `inline-flex items-center gap-1.5 ds-text-amber-600`；提示 box 232.75×13.75，状态行宽 352 / 802 / 1408；三档均无横向溢出；**console error 与 pageerror 全 0 条** |
| `success` + `failedSources = []`（三档） | 0 条提示（negative control） |
| `error` + 非空失败集（三档） | 0 条琥珀提示，同时 `Wallet sync failed` 在（证明不叠加） |

**为什么没有走真实钱包路径**：本机 dev 环境里 `VITE_API_BASE_URL` 指向 `localhost:3001`（需本地后端），改用 Playwright 把 `/markets` 转发到 staging 后应用可用，但 Aave SDK 对该 watch 地址返回空数据（`success-empty`，控制台无 SDK 错误），onchain fallback 因 `v3SdkFailed === false` 不触发 ⇒ 浏览器里拿不到 partial。人为让 SDK 失败可触发 fallback，但 `SdkErrorBoundary` 会把整块市场 UI 替换成 `SDK data loading error`（既有行为，非本票引入），因此真实钱包路径无法在本环境复现 partial。

**M12 的透传证据**：三跳都是可选 prop，中间层丢弃 `failedSources` 时 `typecheck` **不会**报错（review 指出）。补 `ReservesTable.test.tsx` 用例：把 `PortfolioPanel` 打桩，portfolio 模式下断言它收到 `walletLoadState="success"` 与 `failedSources="onchain-v3-chain-42220,sdk-v4"`。mutation 验证：删掉 `ReservesTable.tsx` 里的 `failedSources={failedSources}` ⇒ 该用例红、同文件其余 5 条绿。

**引用稳定性 mutation**：把 hook 里的 `useMemo` 换回直接返回 `mergeFailedSources(...)` ⇒ H5 红、其余 39 条钩子用例绿。

**静态门**：`npm run typecheck` rc=0；全量 vitest **4393 passed / 14 skipped / 6 todo**（195 files + 3 skipped）；`npm run lint` 0 error / 74 warning（基线一致）；`npm run build` rc=0（CSP 检查绿）；`knip` rc=0；`dup:check` **2.78%**。

## Review 处置（双轴，2026-11-16）

**Standards 轴**：

| Finding | 处置 |
| --- | --- |
| 裸 `text-amber-600 dark:text-amber-400` 不是仓库 token | **真修**：改 `ds-text-amber-600`（`src/index.css:445`，与 `src/lib/deficit.ts` 等 7 处一致）；代价是失去 dark 档提亮，amber-600 在深色卡片上对比度 ~5.4:1 仍过 AA |
| spec 写「新增 6 条用例」但实为 7 条 | **真修**：见本文各处计数（P1–P7 / H1–H5） |
| M12 的 evidence 不成立（可选 prop 丢弃不报错） | **真修**：补 `ReservesTable.test.tsx` 透传用例 + mutation 记录 |
| `frontend-regression-checklist` 要求 390/834/1440 + console 记录 | **真修**：harness 扩到三视口并采集 console/pageerror（全 0） |
| `title` 在触屏不可达、无 `role`/`aria-live` | **部分修**：加 `role="status"`（播报一次）；完整源列表 UI 仍按票面 Out of scope，`title` 仅作桌面补充 |
| Data Clumps：`walletLoadState` + `failedSources` 成对穿 4 层 | **接受**：票面要求复用既有 `walletLoadState` 透传链；合并成对象会让 `Index` 每渲染新建对象，反而加剧 memo 失效（已用引用稳定化单独处理） |
| 两处真相：hook 字段与 `result.data.failedSources` | **接受**：同源同值，H1 同时断言两者；这是「UI 不必 narrow union」与「数据层契约不变」的双重保证 |
| Middle Man：`ReservesTable` 只转发 | **接受**：既有链路的形态；新增的透传用例已把这一跳变成可验证契约 |
| Primitive Obsession：`string[]` 标签 | **接受**：源标签在生产里就是字符串，引入品牌类型收益不足 |

**Spec 轴**：

| Finding | 处置 |
| --- | --- |
| M12 无验证证据 | **真修**：同上 |
| 「全成功 + 有仓位」未覆盖 | **真修**：H4（gap 返回 1 条仓位 + `failedSources: []` ⇒ `success` + `[]`） |
| roadmap 未改 | **真修**：docs commit 更新 `docs/issue-roadmap.md`（第十三轮 inventory + 本票行） |
| P5 未断言整行不渲染 | **真修**：P5 补 `Syncing…` / `Wallet has no positions` / `Wallet sync failed` 三条都缺席 |
| `failedSources` 每次渲染新数组，打穿 memo | **真修**：hook 侧 `useMemo` 按 join key 稳定引用（H5 + mutation） |
| M11/M12 evidence 措辞夸大 | **真修**：矩阵改为三视口 + 组件级 harness + 透传用例，并在此明确 harness 只量提示 box 与状态行宽度 |

## Tickets（tracer-bullet 依赖边）

- **T1**（red → green）：hook 返回值新增 `failedSources`（M10）。
- **T2**（red → green）：`PortfolioPanel` 状态行渲染降级提示（M1–M9）。
- **T3**：`Index` / `ReservesTable` 透传 + 静态门 + 运行时浏览器核对 + 双轴 review + docs/Linear/commit（M11/M12）。

依赖边：T1 → T2 → T3。

## Out of scope

- 改 `DegradedResult` 语义或给 `WalletLoadState` 新增 `partial`。
- 逐条失败源的完整列表 UI（本票只用 `title`）。
- 接线 `retry`（`DegradedResult` 已有，不在本票）。
- 自动导入 toast 文案（`Imported N positions`）——导入行为与文案保持现状；降级提示在面板上可见即闭环。
