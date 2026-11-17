# AAV-1352 — e2e discovery：拉取失败必须与「数据缺口」区分，且不得静默报绿

> Status: implemented 2026-11-15 · Issue: [AAV-1352](https://linear.app/aaveapy/issue/AAV-1352) · Type: e2e test infrastructure
> Scope: `e2e/` 的数据获取与门禁层。不改分支保护（票面 out of scope），不改本机出口/代理配置（环境问题，非缺陷）。

## 背景与根因

`e2e/test-reserves.ts` 的 `fetchStagingReserves()` 有三种失败形态，返回值完全相同：

```ts
const resp = await fetch(`${STAGING_API}/markets`);
if (!resp.ok) return [];        // ① 非 2xx
const data = await resp.json();
reservesCache = data.reserves ?? [];
return reservesCache;           // ② 200 + 正常数据
} catch { return []; }          // ③ 网络/解析失败
```

调用方拿到的都是 `DiscoveryReserve[]`，于是 `null`/空集被统一解释成「staging 上没有合格 reserve」，
`test.skip(!testReserve, 'No reserve …')` 把整个 spec 报绿。票面实测同一次运行里同一 describe 的
两条测试一跑一跳——`fullyParallel` 让不同 worker 各自拉取，谁成功谁就真跑。

六个消费者，全部受影响：

| 消费者 | 入口 | 现有跳过形态 |
| --- | --- | --- |
| `portfolio-incentive-calculation.spec.ts` | `findIncentiveReserve()` | 10 处 `test.skip(!testReserve, …)` |
| `portfolio-results-inline-delta.spec.ts` | 同上 | `beforeEach` 跳过 |
| `portfolio-decimal-input.spec.ts` | `findAnyActiveReserve()` | `beforeEach` 跳过 |
| `portfolio-mobile-spacing.spec.ts` | 同上 | `beforeEach` 跳过 |
| `portfolio-cross-reserve-offset.spec.ts` | `fetchStagingReserves()` + `discoverOffsetScenarios` | `hasScenarios === false` ⇒ 一条占位测试 skip |
| `portfolio-cross-asset-pairing.helpers.ts` | `fetchStagingReserves()` + `discoverCrossAssetPairingScenarios` | 同上（live 变体） |

**必须保住的约束**：cross-asset-pairing 有 AAV-1316 的 stub 变体（committed fixture + `page.route`，
不依赖 staging 数据）。把失败做成**模块级抛错**会连带打红这套变体——所以「响亮失败」只能落在
**live 测试范围**（`beforeEach` / 占位测试），不能落在模块加载。注意 stub 只是**不依赖** staging：
supplier 模块加载时仍会做一次有界 fetch（≤ 2×30s），staging 不可达时它多等一会儿，但不会失败。

## 决策

| 选项 | 结论 |
| --- | --- |
| 拉取失败默认行为 | **真红**（live 测试内抛错）。默认状态下「无法验证」≠「通过」，与 AAV-1294 / AAV-1330 / AAV-1349 同族口径。 |
| 是否给逃生口 | **给**，且只认 `E2E_ALLOW_STAGING_UNREACHABLE=1`（`1` / `true`，大小写与首尾空白不敏感）。形制照抄 AAV-1349 的 `E2E_SKIP`：默认关闭，`0` / 空串 / `yes` 一律无效。豁免时说的仍是「不可达」，不是「没有数据」。 |
| 是否做 job summary 聚合 | **不做**。理由文案已进 Playwright 输出；自定义 reporter 是新破坏面（reporter 自身出错会拖垮所有 run），收益低于成本。留作后续独立票。 |
| 重试与超时 | **2 次尝试 × 30s/次**（总上限约 60s）。票面 141s 的「成功」被判为失败是有意的：它早已超过多数断言超时，等下去只会把超时伪装成数据问题。 |
| 失败是否缓存 | **缓存**（成功与失败都缓存，每进程一次）。理由：`fullyParallel` 下同一 worker 会加载多个 spec 文件，失败不缓存会让每个文件各等一轮 60s。 |
| `fetchForecastAvailableCampaignIds` | gating 语义保持现状（失败返回 `null` 且**不**改变 gating，见其文档注释），但补两件事：调用加 `AbortSignal.timeout(30s)`（原实现无超时，side-data 挂起会让模块加载永久卡住），失败分别打印 HTTP 状态与错误原因（原 `catch {}` 完全静默）。 |

## 设计

### 新模块：`e2e/stagingReservesFetch.ts`（零 playwright 依赖）

不 import `@playwright/test`，因此可被 vitest 直接单测（与 `e2e/reserveDiscovery.ts` 同形）。

```ts
export type FetchMeta = { attempts: number; elapsedMs: number };

export type ReservesFetchOutcome =
  | ({ status: 'ok'; reserves: DiscoveryReserve[] } & FetchMeta)
  | ({ status: 'unreachable'; detail: string; url: string } & FetchMeta);

export type ReserveDiscovery<T> =
  | { status: 'found'; value: T }
  | { status: 'data-gap' }
  | { status: 'unreachable'; detail: string; url: string; attempts: number; elapsedMs: number };

export type ReserveGate =
  | { action: 'run' }
  | { action: 'skip'; reason: string }
  | { action: 'fail'; reason: string };
```

导出函数：

- `classifyReservesPayload(json)` → `DiscoveryReserve[]`；`reserves` 缺失/非数组/根不是对象 ⇒ 抛错
  （schema 漂移按「不可达」处理，因为它同样意味着「本层无法验证」）。**`reserves: []` 是合法的
  `ok`**，交给下游判为数据缺口。
- `fetchReservesOutcome({ url, fetchImpl, timeoutMs, attempts, retryDelayMs, now, sleep, log })`
  → 每次尝试 `AbortSignal.timeout(timeoutMs)`；非 2xx / 网络异常 / 超时 / 坏 JSON 均重试；
  返回带 `attempts` / `elapsedMs` 的结果，`log` 打印每次失败原因与最终耗时。
- `createReservesFetcher(opts)` → `{ get() }`，进程内缓存（成功与失败都缓存）。
- `toDiscovery(outcome, derive)` → 把 fetch 结果映射成场景级发现结果：
  `ok` + 非空 ⇒ `found`；`ok` + 空 ⇒ `data-gap`；`unreachable` ⇒ 透传。
- `decideReserveGate(discovery, { dataGapReason, allowUnreachable })` → `run` / `skip` / `fail`。
  - `data-gap` ⇒ `skip`，文案带「`/markets` 已正常返回，这是数据缺口而非拉取失败」。
  - `unreachable` + 未豁免 ⇒ `fail`，文案带 `detail` / 尝试次数 / 耗时 / URL / 修复提示 / 豁免变量名。
  - `unreachable` + 已豁免 ⇒ `skip`，文案明确写出「被 `E2E_ALLOW_STAGING_UNREACHABLE=1` 显式豁免」。
- `isUnreachableAllowed(env)` → 只认 `1` / `true`。

### 接线：`e2e/test-reserves.ts`

- `fetchStagingReserves()`：返回 `ReservesFetchOutcome`（不再把失败伪装成 `[]`）。
- `findIncentiveReserve()` / `findAnyActiveReserve()`：返回 `ReserveDiscovery<TestReserve>`。
- `enforceReserveGate(gate)`：`fail` ⇒ `throw new Error(reason)`；`skip` ⇒ `test.skip(true, reason)`；
  `run` ⇒ 什么都不做。Playwright 的 `beforeEach` 里抛错 = 该测试真失败（不是 `test.fail()` 那种
  「预期失败算通过」）。
- 成功路径打印一行 `[e2e] staging /markets: N reserves in Xms (M attempt(s))`——把票面第 2 条的
  「把耗时打出来」落到每次运行。

### 消费者形态

reserve 型（4 个 spec）：把 `test.skip(!testReserve, '…')` 换成

```ts
test.beforeEach(() => { enforceReserveGate(reserveGate); });
```

场景型（offset / cross-asset live）：`hasScenarios === false` 的占位测试改为

```ts
test('staging discovery did not yield scenarios', () => { enforceReserveGate(scenarioGate); });
```

cross-asset 的 stub describe 一行不动。

## Modified Files Impact

| 文件 | 修改内容 | 风险 | 评估 |
| --- | --- | --- | --- |
| `e2e/stagingReservesFetch.ts`（新增） | fetch outcome 联合类型 / 重试 / 缓存 / `toDiscovery` / `decideReserveGate` / `gateEffect` / `isUnreachableAllowed` | 高 | 纯新增、无 playwright 依赖；被 `test-reserves` 与 4 个 spec 直接 import。逻辑全部有单测；失败方向固定为 fail/block，不会退化成 pass。 |
| `e2e/test-reserves.ts` | `fetchStagingReserves()` 返回 union（原 `DiscoveryReserve[]`）；两个 `find*` 返回 `ReserveDiscovery<T>`（原 `T | null`）；新增 `reserveGateFor` / `foundValue` / `enforceReserveGate` / `enforceEmptyListGate` / 三个 gap 常量 | 高 | 公共接口，6 个消费者。类型破坏是**刻意**的：旧签名正是假绿的载体。`e2e/` 不在 tsconfig 覆盖内（AAV-1319），故本票显式跑 tsc。 |
| 4 个 reserve 型 spec | `test.skip(!testReserve, …)` → `enforceReserveGate(reserveGate)`；门禁接线收敛成 3 行（`foundValue` + `reserveGateFor`） | 中 | 行为差异只在「不可达」分支：由 skip 变 fail。数据缺口与正常路径不变。 |
| `portfolio-cross-reserve-offset.spec.ts` | 场景发现走 `toDiscovery`；占位测试改 `enforceEmptyListGate` | 中 | 占位测试多一条自检：门禁说 `run` 但列表为空时抛错，防止将来新增 scenario 类型出现「空跑通过」。 |
| `portfolio-cross-asset-pairing.helpers.ts` + 两个平台 spec | 同上；`liveScenarioGate` 导出 | 中 | stub describe 一行未动，staging 不可达时仍执行（实测通过）。 |
| `src/test/stagingReservesFetch.test.ts`（新增） | F/G 系列 37 例 | 低 | 随 `npm test` 生效，不新增 script、不改 hook。 |
| `docs/conventions/e2e-testing-boundary.md` | 新增「Discovery fetch failure is NOT a data gap」契约段 | 低 | 把约定写进唯一权威处，避免下一个 spec 重新发明 skip。 |

## Scenario & Risk Verification Matrix

| ID | 场景 | 期望 | 证据 |
| --- | --- | --- | --- |
| F1 | 200 + `{reserves:[…]}` | `ok`，条数保留，`attempts=1` | 单测 |
| F2 | 200 + `{reserves:[]}` | `ok` + 空（**不是** `unreachable`） | 单测 |
| F3 | 200 + `{}` / `{reserves:'x'}` / 根为 null | `unreachable`（schema 漂移按不可验证处理） | 单测 |
| F4 | HTTP 500 | `unreachable`，`attempts=2`（确实重试） | 单测 |
| F5 | fetch reject | `unreachable`，detail 带错误信息 | 单测 |
| F6 | 第 1 次 reject、第 2 次 200 | `ok`，`attempts=2` | 单测 |
| F7 | 超时（不 resolve，直到 signal abort） | `unreachable`，detail 标注 timeout | 单测 |
| F8 | 200 + 坏 JSON | `unreachable` | 单测 |
| F9 | 成功后再次 `get()` | 不再调用 fetch（缓存命中） | 单测（计数 stub） |
| F10 | 失败后再次 `get()` | 不再重试（失败也缓存） | 单测（计数 stub） |
| F11 | 成功路径 | `log` 打出条数/耗时/尝试次数 | 单测（log stub） |
| F12 | 注入假时钟 | `elapsedMs` 取自注入的 `now`（字段真的接线，不只是有类型） | 单测 |
| G1 | `found` | `run` | 单测 |
| G2 | `data-gap` | `skip`，文案含「数据缺口而非拉取失败」 | 单测 |
| G3 | `unreachable` + 未豁免 | `fail`，文案含 detail/尝试次数/耗时/URL/修复提示 | 单测 |
| G4 | `unreachable` + 豁免 | `skip`，文案含 `E2E_ALLOW_STAGING_UNREACHABLE=1` | 单测 |
| G5 | 豁免变量 `0`/``/`yes`/`1 `/`TRUE` | 前三种不豁免；`1 `/`TRUE` 豁免 | 单测 |
| G6 | `toDiscovery` 三种映射（非空/空/不可达） | `found` / `data-gap` / 透传 meta | 单测 |
| G6d | `derive` 抛错（元素级 schema 漂移） | `unreachable`（不是逃逸出模块加载，把 stub 变体一起打掉） | 单测 |
| G7 | `gateEffect`：fail→throw / skip→带原因 / run→no-op | 适配器把「失败」做成抛错，不是 `test.fail()` 或静默 | 单测 |
| G8 | 端到端链路：fetch 抛错⇒fail；200+空⇒skip；200+非空⇒run | 三层组合起来仍保持本票的核心区分 | 单测 |
| C1 | incentive / results-inline-delta / decimal-input / mobile-spacing：staging 不可达 | **红**（`Error: staging /markets unreachable …`），不再 skip | e2e 实跑（`VITE_API_BASE_URL=http://127.0.0.1:9/api` 注入不可达出口） |
| C2 | 同上：staging 可达但无合格 reserve | skip，文案区别于 C1 | e2e 实跑（现有 staging 数据） |
| C3 | offset spec：不可达 / 空场景 | 占位测试红 / 占位测试 skip | e2e 实跑（不可达注入 + 正常数据） |
| C4 | cross-asset live：不可达 | live 占位测试红 | e2e 实跑（不可达注入） |
| C5 | **cross-asset stub：不可达** | **仍然执行并通过**（hermetic，不碰 staging） | e2e 实跑（不可达注入） |
| C6 | 正常网络 | 行为与今日一致（发现的 reserve/scenario 相同，只有文案变化） | e2e 实跑（见「验证证据」） |
| N1 | `npm test`（vitest） | 新模块无 playwright 依赖，单测可跑；全量不回归 | `npm test` |
| N2 | `e2e/` 不在 tsconfig/lint 覆盖内（AAV-1319） | 改动文件显式跑 `tsc --noEmit` | 显式 tsc |
| N3 | 架构守卫 | 不新增非法依赖方向 | `npm test`（architecture-guard） |

## 验证计划

1. TDD：先写 `src/test/stagingReservesFetch.test.ts`（F/G 行），确认模块不存在时红 ⇒ 实现 ⇒ 绿。
2. 类型门：`npm run typecheck`（两个 project）——注意**裸 `tsc --noEmit` 在本仓是假绿灯**（根 tsconfig 是
   solution-style `files: []`，AGENTS.md 已记）；`e2e/` 不在覆盖内，故对改动文件显式跑一次带 flags 的
   `tsc --noEmit`（命令见下）。
3. e2e 实跑三态（不可达用既有的 `VITE_API_BASE_URL` 指向黑洞端口，不新增注入变量）。
4. 双轴 review（Standards + Spec），覆盖矩阵每一行；review 提出的 18 条 finding 逐条处置（见下「review 闭环」）。

## 验证证据（2026-11-15，本机）

**TDD 红**：`npx vitest run src/test/stagingReservesFetch.test.ts` → `Cannot find module
'../../e2e/stagingReservesFetch'`（模块尚未创建）。

**单测绿**：同一命令 → `37 passed`（首版 29 例，review 后补 F12/G6d/G7/G8 共 8 例）。

**全量单测**：`npm test` → `Test Files 191 passed | 3 skipped (194)` / `Tests 4291 passed | 14 skipped |
6 todo (4311)`；scripts 段 `# tests 259 / # pass 259 / # fail 0`。

**类型门**：`npm run typecheck` → rc 0；对 10 个改动 e2e 文件显式跑
`npx tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler
--lib ES2023,DOM,DOM.Iterable --jsx react-jsx --allowImportingTsExtensions --isolatedModules --types node …`
→ 无输出（0 error），并用 `--listFiles` 确认这三个文件真的进了检查集合（防「检查了 0 个文件」的假绿）。

**lint**：`npm run lint` → `0 errors`（74 条既有 warning）。

**e2e 正常网络**（`E2E_PORT=4173`、本地 staging dev server、`--workers=1`）：

| 运行 | 结果 |
| --- | --- |
| 4 个 reserve 型 spec（双 project） | `23 passed / 17 skipped / 0 failed`（2.5m）；日志首行 `[e2e] staging /markets: 441 reserves in 3974ms (1 attempt)` |
| offset + cross-asset + mobile-spacing（双 project） | `5 passed / 5 skipped`（1.2m）：offset 命中 1 条 self-loop（desktop+mobile 各 1 pass）、cross-asset live 占位按**数据缺口** skip、stub 双平台 pass |

**e2e 不可达**（`VITE_API_BASE_URL=http://127.0.0.1:9/api`，5 个文件双 project）：

```
24 failed
14 skipped        ← 平台互斥 skip
2 passed (45.9s)  ← 两条都是 cross-asset stub（hermetic，不受影响）
```

失败信息逐字为：

```
Error: staging /markets unreachable (fetch failed) after 2 attempts in 254ms
[http://127.0.0.1:9/api/markets]. Live e2e discovery cannot verify anything, so this test FAILS
instead of skipping. Fix egress/proxy for this host, or set E2E_ALLOW_STAGING_UNREACHABLE=1 to record
an explicit skip.
```

**e2e 显式豁免**（同一次注入 + `E2E_ALLOW_STAGING_UNREACHABLE=1`）→ `38 skipped / 2 passed / 0 failed`（37.4s）。
skip 注解原文（`--reporter=json` 抓取）：

```
staging /markets unreachable (fetch failed) after 2 attempts in 254ms [http://127.0.0.1:9/api/markets]
— skipped because E2E_ALLOW_STAGING_UNREACHABLE is set (this run carries no live-data evidence)
```

**review 闭环**：双轴 review 提出 18 条（阻塞 1 / 高 3 / 中 6 / 低 8）。处置：阻塞项＝补本节证据；
H1＝门禁接线收敛成 `reserveGateFor`/`foundValue`/`enforceEmptyListGate`（env 只在 helper 里读一次，6 处
`allowUnreachable: stagingUnreachableAllowed()` 重复消失）；H2＝新增 `gateEffect` 纯函数 + G7/G8 组合链测试；
M1/M3/M5/M6、L1–L4 全部真改；L5（既有的按平台互斥 skip）与「其他 spec 仍是页面没数据就 skip」按边界留观，
记入 Out of scope。

## Out of scope

- 把 `e2e-desktop` / `e2e-mobile` 加进分支必填检查（需单独拍板，与 AAV-1349 同一 out of scope）。
- 本机出口/代理配置修复。
- job summary 聚合 reporter（见决策表）。
- `src/test/reserveDiscovery.test.ts` 的既有纯函数逻辑（不动）。
- **同类假绿的其他 spec**（本次 review 顺带列出，均未改）：`e2e/verify-target-total-apr.spec.ts:44`、
  `e2e/scenario-input-modes.desktop.spec.ts:89`、`e2e/fdv-continuous-input.spec.ts:30` 仍是「页面没数据就
  skip」，staging 不可达时会同样报绿。本票只覆盖 staging discovery 这一条链，其余留待单独开票。
- **既有的按平台互斥 skip**（`test.skip(project.name.includes('mobile'), …)`）仍在 4 个 reserve spec 里；
  AGENTS.md 把它列为反模式，但收敛它要按 project 拆分文件，与本票无关。
