# AAV-1317 — portfolio fill helper 按 reserveId 行域定位 + 同符号配对解除

**Status**: Delivered 2026-11-16 (`dev`) · **Ticket**: AAV-1317（Medium，ready-for-agent） · **Family**: AAV-1308 / AAV-1316 / AAV-1318（e2e discovery·runner 假绿家族）

## 现象与定性

`e2e/test-reserves.ts` 的 `fillSupplyAmount` / `fillBorrowAmountDesktop` 用
`getByRole('textbox', { name: /… amount for <SYMBOL>/i }).first()` 定位输入框。Portfolio 模式下同一
symbol 可同时存在于多条 reserve（2026-11-15 staging 实测：441 条 reserve 里 **59 个 symbol** 跨 reserve
重复），`.first()` 会填进表格里第一条同符号行。

**定性：潜伏的假绿，不是正在失败的用例。** 同日 staging `/markets`：441 reserves、49 个 merkl group、
**0 个 `crossAssetPairing`** ⇒ live 配对路径自建库以来从未产生过场景；唯一真正执行的是 AAV-1316 的
stub 变体（WETH×USDC，同市场不同符号）。一旦 Merkl 真的下发同符号配对（或未来任何 spec 在 portfolio
里加两条同符号 reserve），错误行的填充会让 min(1,2) 断言在错误的数据上通过或失败。

## 修复内容

1. **行域 fill helper**（`e2e/test-reserves.ts`）：`fillSupplyAmount` / `fillBorrowAmountDesktop` /
   `fillBorrowAmountMobile` 全部收进共享实现 `fillPortfolioAmount(page, reserveId, side, symbol, amount)`：
   - 行锚点 `[data-reserve-id="${reserveId}"]`（与 `readIncentiveAfter` 同一锚点；桌面 = `tr`，移动端 = 卡片根 `div`）；
   - **移动端 tab 切换**：卡片只挂载当前 tab 的 `CompactInput`（`MobilePortfolioCard.tsx` 单 `CompactInput` 随
     `activeTab` 渲染），helper 在 tab 存在且未选中时先点对应 side 的 tab——桌面行无 tab，该步自动跳过；
   - accessible-name 匹配放宽为 `Supply|Borrow (?:amount|effective) for <SYM>`（wallet-backed 行显示
     `effective`），symbol 走 `escapeRegExp`（`USDC.e` 等符号含正则元字符）。
   - 签名变更（新增必填 `reserveId`）由编译期强制，11 处调用点（cross-asset helpers 5 + offset spec 5，
     另 `fillBorrowAmountMobile` 签名不变）同 commit 更新。
2. **Add 流程收紧**（`addReserveToPortfolio`）：同符号多候选且 market label 无命中时由「`.first()` 静默点击」
   改为 `return false`（调用方已有具名断言）。静默加错 reserve 是与 fill 同族的残留缺陷。
3. **Discovery 同符号排除解除**（`e2e/reserveDiscovery.ts`）：`paired.tokenSymbol === r.tokenSymbol` 的
   `continue` 删除——fill 行域化后同符号配对可以正确服务。**自配对排除保留**（`pairedReserveId ===
   sourceReserveId`），理由重写：runner 的模型是「source 一个仓位 + paired 一个仓位」，同一 reserve 同一侧
   只有一个输入框，paired 的 500 会覆盖 source 的 1000，min() 阶梯断言随即失真——这是 runner 结构约束，
   不是符号查找问题（票面原要求两条都解除，grill 判定自配对解除需先改 runner，超出本票，用户拍板保留）。
4. **行归属自证断言**（cross-asset runner）：`fillSourcePosition('1000')` 后断言 source 行输入值 = `1,000`；
   每次 `fillPairedPosition(x)` 后断言 paired 行 = 格式化值 **且 source 行仍 = `1,000`**。显示值按 app 的
   `formatNumberInput` 口径（千分位）比对。该断言让「填错行」在错误发生的行上、以行 ID 命名地失败。
5. **同符号 stub 变体**（AAV-1317）：`e2e/crossAssetPairingStub.ts` 新增 `AAV1317_SAME_SYMBOL_INJECTION`
   （**Celo WETH → Base WETH**，`discountFactor 0.5`），desktop/mobile 各一个用例 + 一个 Add 探针用例。

## Stub 场景筛选标准与 provenance

同符号 source 必须过**全部真实 discovery 门控**（builder 零场景即 throw）：

| 门 | Celo WETH 实测 | 结论 |
| --- | --- | --- |
| `ltv > 0` | 78 | ✓（Monad/Ink USDC 等 ltv=0 的候选被 AAV-1380 缺口排除） |
| supply room ≥ $5k | cap 2100 − supplied 644 WETH × $1805 ≈ $2.6M | ✓ |
| campaign 类型 | `DUTCH_AUCTION`，apr 2.648，非 whitelist | ✓（不在 AMOUNT_VARIANT / FORECAST_REQUIRING 清单；**TARGET_TOTAL_APR 候选被否**——其渲染值取决于 nativeAPY/target 比较，不适合做阶梯断言） |
| 同符号孪生 `ltv > 0` | fixture 既有的 Base WETH（ltv 80） | ✓ |
| 窗口 | 真实窗口 2026-11-12→12-10，注入覆盖为 2026-01-01→2035-01-01 | ✓ 时间安全 |

**Fixture 是登记在案的 composite**：Base WETH / Base USDC 两条保持 AAV-1316 的 2026-10-11 捕获（今日重捕
不可行——Base WETH 的 merklSupplys 分组已消失，AAV-1316 注入目标会不存在）；Celo WETH 为 2026-11-15T16:23Z
staging 捕获、逐字追加。`snapshot.lastUpdated` 继续描述 Base 侧原始捕获。字段形态零改动，SS4 断言 payload
仍过 app 的 `MarketsResponseSchema`。

**行序确定性**：portfolio 表按插入序渲染（`sortEntriesByHidden` 仅把 hidden/wallet 沉底，测试场景无钱包），
source 先加 ⇒ source 行必是第一行 ⇒ 旧符号定位的 `.first()` **必然**把 paired 的钱填进 source 行，红是
确定性的（非碰运气）。

## Red → Green 证据（同符号 stub desktop）

**Red**（旧 fill 实现 + 新 stub 用例 + 新行归属断言，commit 前）：

```
✘ cross-asset same-symbol stub: WETH [Celo] supply paired with WETH [Base] supply (×0.5)
  Error: Row 8453:…:0x4200…06 supply input must hold 500
  Locator: locator('[data-reserve-id="8453:…:0x4200…06"]').first()
           .getByRole('textbox', { name: /Supply (?:amount|effective) for WETH/i }).first()
  24 × locator resolved to <input value="" … aria-label="supply amount for WETH" …>
     - unexpected value ""
✘ same-symbol Add flow: no market-label match fails explicitly (AAV-1317)
  expect(received).toBe(expected) — added === true（.first() 回退点了错误的候选）
✓ cross-asset stub: WETH [Base] supply paired with USDC supply (×0.5)   ← 既有用例不受新断言影响
```

**Green**（行域 helper + Add 收紧落地后）：desktop `3 passed / 1 skipped`（7.5s / 7.3s / 3.2s），mobile
`3 passed / 1 skipped`；offset spec live self-loop 双平台 `2 passed / 2 skipped`（7.5s / 11.0s，真实执行
桌面 borrow 与移动端 tab 路径）；四个其余 portfolio spec `23 passed / 17 skipped / 0 failed`（skip 全为
平台路由）。全量 vitest **4316 passed / 14 skipped / 6 todo / 0 failed**；typecheck rc=0；lint 0 error；
build rc=0（CSP 门绿）。

## Scenario & Risk Verification Matrix

### Section 1: Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `e2e/test-reserves.ts` | fill 三 helper 收进行域共享实现（签名 +reserveId）；`addReserveToPortfolio` 无标签命中改 `return false` | High | 多 spec 消费的公共 helper。编译期强制所有调用点同 commit 更新（typecheck:e2e 覆盖 `e2e/**`，AAV-1319 门）；4 个消费 spec + offset spec 全部实跑回归；最坏后果 = e2e 定位失败（响亮红），不影响生产代码 |
| `e2e/reserveDiscovery.ts` | 删同符号 `continue`；自配对注释重写（行为不变） | Medium | 单测 P11 翻转 + P10 保留锚定；live 路径 0 场景 ⇒ 无即时运行时行为变化；`usableForSimulatedPosition(paired)` 门保持不动 |
| `e2e/portfolio-cross-asset-pairing.helpers.ts` | 第二 stub 构建 + `installStubRoutes(page, payload?)` 参数化（默认仍 AAV-1316 payload）+ runner 行归属断言 | Medium | 既有 stub 用例原样通过（断言兼容不同符号场景）；payload 参数有默认值，旧调用不破坏 |
| `e2e/fixtures/markets-cross-asset-pairing-base.json` | 追加 Celo WETH（composite，见 provenance） | Medium | builder 对门控失败响应亮 throw；SS1–SS4 锚定 composite 契约（恰 2 条 WETH、 Monad/USDC 不在、窗口未覆盖、schema 通过） |
| `e2e/crossAssetPairingStub.ts` | `AAV1317_SAME_SYMBOL_INJECTION` 常量 + 筛选标准注释 | Low | 纯新增导出；SS parity 单测 |
| `e2e/portfolio-cross-asset-pairing.{desktop,mobile}.spec.ts` | 各 +2 用例（同符号 stub、Add 探针）；`installStubRoutes` 显式传 payload | Low | 平台绑定方式不变（文件级 testIgnore） |
| `e2e/portfolio-cross-reserve-offset.spec.ts` | 5 处调用点补 reserveId | Low | live self-loop 双平台实跑通过 |
| `src/test/reserveDiscovery.test.ts` | P11 翻转（同符号 ⇒ 产出场景 + label 断言）；P10 标题更新 | Low | vitest 全绿 |
| `src/test/crossAssetPairingStub.test.ts` | SS1–SS4 | Low | vitest 全绿 |

### Section 2: Behavioral Scenarios

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| B1 | 同符号、不同 market 的配对 | discovery 产出场景，字段完整（source/paired 同 symbol、label 各自 market） | 中 | automated test（P11 翻转） | — |
| B2 | 自配对（pairedReserveId === sourceReserveId） | 仍被排除（runner 单仓位模型，paired fill 会覆盖 source 仓位） | 中 | automated test（P10 保留 + 注释重写） | 解除需先改 runner，超出本票（用户拍板保留） |
| B3 | `fillSupplyAmount` 桌面填目标行 | 值落在 reserveId 对应行，同符号另一行不受影响 | 中 | runtime（同符号 stub desktop：paired 行 = 500 且 source 行仍 1,000；旧实现红） | 行归属断言常驻 runner |
| B4 | `fillSupplyAmount` 移动端（含 tab 切换） | 切到对应 side tab 后填目标卡片行 | 中 | runtime（同符号 stub mobile 3 passed） | helper 内 tab 切换 + 既有 `readIncentiveAfter` 同锚点 |
| B5 | `fillBorrowAmountDesktop/Mobile` 行域 | borrow 填目标行 | 中 | runtime（offset live self-loop desktop 7.5s / mobile 11.0s 通过） | — |
| B6 | Add：同符号多候选且无 label 命中 | 显式 `false`（调用方具名断言失败），绝不 `.first()` | 中 | runtime（Add 探针 desktop+mobile；旧实现红） | — |
| B7 | Add：单候选且 label 不匹配 | 仍直接添加（count === 1 路径保持） | 低 | runtime（既有 stub 用例的 paired 添加走 count=1 路径，3 passed） | — |
| B8 | 既有 WETH×USDC stub | 行为不变 + 行归属断言通过 | 低 | runtime（desktop 7.3s / mobile passed） | — |
| B9 | composite fixture 形态 | 通过 app 的 `MarketsResponseSchema`；恰 2 条 WETH；注入后 base 不被改写 | 中 | automated test（SS2/SS3/SS4 + SY2 不变） | — |
| B10 | 注入场景不过真实门控 | builder throw（拒绝产出会 skip 的 stub） | 低 | automated test（SY4/SY4b 既有负例；SS 系列正例） | — |
| B11 | 四个其余 portfolio spec + offset spec | 无新增 skip、无失败 | 低 | runtime（23 passed/17 skipped；2 passed/2 skipped） | — |
| B12 | live 同符号场景的运行时证据 | **仍然缺失**（staging 0 个 crossAssetPairing）— stub 是替代证据 | 信息 | 记录为已知边界 | 同族先例 AAV-1316；Merkl 真下发时 live 用例自动接管 |

## Out of scope

- 自配对的 runner 支持（同 reserve 双侧独立仓位模型）——需先重新设计 runner 的仓位写入语义。
- `setupPortfolioWithReserve` 的同符号 `.first()` 输入框定位：单储备 setup 场景无歧义，未收紧。
- offset runner 的行归属值断言（live 梯级可能触发合法的 cap clamp，严格值比对会制造假红）——cross-asset
  runner 的断言已覆盖 helper 的行域行为。
- B12 的 live 路径证据：取决于 Merkl 是否真实下发 crossAssetPairing。
