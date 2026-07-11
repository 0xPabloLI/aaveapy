# Learned Lessons: Portfolio & UI

Historical lessons from working on Portfolio simulation, table layout, and UI components. Extracted from AGENTS.md to keep it concise. Read when modifying Portfolio mode, table layout, or UI primitives.

## Portfolio Delta Input
- **Controlled ↔ Uncontrolled 迁移风险**: `useNumberInput`（uncontrolled, initialValue）→ `useDebouncedInput`（controlled, value prop）迁移会引入双向同步反馈循环。迁移前必须分析双向数据流。
- **Delta 空语义 ≠ 空字符串**: Portfolio 中 clear delta 的正确语义是"使 delta=0"，即设 `amount = walletValue`，而非设 `amount = ''`。空字符串经 parseNumberInput→0 后与 walletValue 做差反而产生非零 delta。
- **Toggle sign 有 delta 时必须重算 amount**: `effectiveUsd = walletValue + deltaSign × delta` 中，toggle sign 翻转 deltaSign 后 effectiveUsd 变化，amount（=effectiveUsd）必须同步重算。当 absDeltaUsd ≥ 0.005 时 patch {deltaSign, amount}；delta 为零时只 patch deltaSign。旧设计"toggle sign 只翻符号不重算 amount"已被推翻——sign 变了 effectiveUsd 就变了，amount 不跟着重算会导致 UI 显示不一致。
- **Debounce 对 delta 输入有害**: 用户逐字输入 delta 时 300ms debounce 会在输入中途 commit 不完整值。对即时计算的派生字段传 `debounceMs: 0`。
- **if/else 两分支结果一致是死代码**: review 时注意简化，减少认知负担。
- **同一业务动作只允许一条语义路径**: 当同一操作有多种触发方式（按钮/键盘删除/粘贴/程序调用），底层语义必须统一到同一个函数。不要让多条路径各自实现——否则语义断裂会产生"A路径正确、B路径错误"的隐蔽 bug。典型反例：`handleClearDelta`（X 按钮）和 `handleDeltaCommit`（输入提交）曾经各自实现清空语义，键盘删除走 `handleDeltaCommit` 的 early return 丢掉了"归零"语义。修复：`handleDeltaCommit` 对空值委托给 `handleClearDelta`，两条路径归一。
- **输入提交函数必须显式定义空值语义**: 对任何数值输入框，明确回答"用户清空 = 什么？"。空值是有意义的输入，不是"没有输入"。不要用 early return 隐式丢弃——要么显式归零、要么显式回退、要么显式报错。TDD 必须覆盖"清空输入框"这条路径。

## Cap warning 文案统一 (AAV-785/AAV-851)
- **`formatProtocolCapText` 是 Reserve Table 和 Portfolio 的共享入口**：两处使用同一函数生成 protocol cap warning 文案，未来改文案只改一处。函数接受 `availableFormatted: string`（预格式化），因为 Reserve Table 用 `formatScenarioSize`（支持 USD/Token 模式），Portfolio 用 `formatUsd`（纯 USD）。
- **`currentExceeded` 语义变更**：旧 SimulationSubRow 用 `"exceeds cap by $X"` 描述超出量（`exceededByUsd`），新文案统一为 `"Current {Supply|Borrow} limited to $X available"` 描述可用量（`availableRoomUsd`）。数值从 exceededBy 变成了 availableRoom，语义和数值都不同——这是有意的设计决策，"limited to X available" 信息量更大。
- **测试 describe 嵌套要注意**：Vitest 允许 describe 内嵌套 describe，但如果嵌套位置错误会导致 it 块归属到错误的 describe。新增 describe 块时要确保放在正确的外层 describe 之外。
- **Position cap note 文案 `"incentive on first $X only"` 有歧义**：`"only"` 紧跟金额，容易被读成整个短语的尾修饰而非修饰 incentive。改为 `"Incentive limited to first $X"` 更 native——`"limited to"` 是金融 UI 标准表述，语义无歧义。
- **Position cap note 不传 campaignName**：campaignName 参数只在 Merit 传了硬编码字符串（`"Merit double yield"`/`"Merit"`），Merkl 只在 IncentiveTooltip 传了 `opportunity.name`，Brevis 从未传入——三处不一致。Note 已出现在 source header 下方，用户知道是哪个 source。移除 campaignName 后文案统一为 `"Incentive limited to first $X"`，更简洁。IncentiveTooltip 的 `campaignName` 字段也从未被消费（`.campaignName` 无匹配），一并清理。

## Wallet 显示 Option E + UI 规范统一
- **Option E: 输入框显示完整 effective value（非 delta）**：用户直接输入完整的目标仓位值（如 wallet=$1,000, 输入 $1,500 = +$500 delta）。移除了 ± sign toggle 按钮——sign 由 effective vs wallet 的大小关系自动推导（effective > wallet → +1, effective < wallet → -1）。**教训：sign 不应是独立的用户选择，而是 effective value 的自然推导结果——让用户思考"我要多少仓位"而非"我要加/减多少"。**
- **Arrow `→` 常驻显示**：当 `hasWallet` 时，箭头 `→` 始终显示在 wallet compact 值后面，颜色跟随 effective vs wallet 关系（emerald=above / red=below / muted=equal）。不只在 `isModified` 时显示——即使没有 delta，箭头也传达"这里是你的仓位，右边是你输入的值"的语义。**教训：常驻元素比条件显示元素更减少认知负担——用户不需要记忆"什么时候有箭头"。**
- **`cursor-auto` 是 tooltip-only 元素的正确 cursor**：DESIGN-SYSTEM-REFERENCE §6 明确规定——自动展示 tooltip 用 `cursor-auto`（+轻微悬停反馈），点击展示用 `cursor-pointer`。MetricValue 和 WarningMarker 的 `cursor-help`→`cursor-pointer`→`cursor-auto` 的三次修正过程说明：**查设计系统文档先于凭直觉改**。`cursor-help` 渲染为 `?` 光标不在设计体系内；`cursor-pointer` 暗示可点击但实际无 click action。
- **WarningMarker 移除 Supply/Borrow 前缀**：`formatProtocolCapText` 返回的文本已包含 "Supply limited to..." / "Borrow limited to..."，WarningMarker 中额外的 "Supply"/"Borrow" label span 是重复信息。incentive_cap/incentive_offset 的 header 从 "Supply · {source}" 简化为 `{source}`（capitalize）。**教训：当文本已包含 side label 时，不要在 UI 层重复显示——冗余信息增加认知负担。**
- **表格边框层次**：group separator 的 `border-l border-border/20` → `/40` → `/60`，使 Input→Native→Incentive→Total→Earn 各模块之间的视觉分隔在 light 和 dark mode 下都清晰可见。Dark mode `--border: hsl(220 10% 22%)` (L22) over bg L6: `/60` 给出 effective L15.6 (Δ9.6)；light mode `--border: hsl(23 5% 82%)` (L82) over bg L100: `/60` 给出 L89.2 (Δ10.8)。Row separator 保持 `/30` (Δ~5)，形成 2× hierarchy。**教训：边框透明度选择应基于 HSL lightness 计算的有效对比度，而非"看起来差不多"——dark mode 和 light mode 需要同一透明度同时满足两种背景。**
- **`clampFn` 参数消除 cap input flicker**：`useDebouncedInput` 新增 `clampFn?: (formattedValue: string) => string` 参数，在 `handleChange` 和 `doCommit` 中格式化后、显示前实时 clamp。旧方案：`setDisplayValue(unclamped)` → store 更新为 clamped → `useEffect` 同步 `displayValue` 为 clamped，中间有 1 帧 flicker。新方案：`clampFn` 在 display 前执行，display 和 store 始终同步。**教训：当 commit 后的 store 值可能与 display 值不同（如 clamping）时，必须在 `setDisplayValue` 之前应用 transform——不能依赖 `useEffect` 事后同步。**
- **`HelpCircle` vs `Info` 图标语义**：`HelpCircle`（带 `?`）用于 FAQ/帮助导航链接（Header、DefiYieldTracker），`Info`（带 `i`）用于信息提示 tooltip（AprApyToggle、InkAprCalculator、WatchAddressInput）。两者不可混用——WatchAddressInput 的信息提示原先用 `HelpCircle`，已统一为 `Info`。**教训：图标选择应匹配语义——`HelpCircle` = 导航到帮助页面，`Info` = 原地信息提示。**

## Unified Table 列宽分配 + 侧分隔线 + Legacy 清除
- **`table-layout: auto` 多列共享剩余空间**：Token、Supply Input、Borrow Input 三列都不设 width，由 auto 布局按内容 max-content 比例分配剩余空间。Token 内容窄拿到较小份额，Input 列拿到大头。之前用 `width: 1px` trick 限制 Token 列不抢空间，但实际效果是 Token 列被过度压缩。去掉 1px 后三列自然分配更合理。**教训：auto 布局已经足够智能，不需要用 1px trick 强制干预——让浏览器按内容比例分配是最自然的方案。**
- **三级边框层次：GROUP_SEP (/60) > SIDE_SEP (/40) > row (/30)**：模块间分隔（Input→Native→Incentive→Total→Earn）用 `/60`，同一模块内 Supply→Borrow 分隔用 `/40`，行间分隔用 `/30`。旧版只有 GROUP_SEP 没有 SIDE_SEP，Supply 和 Borrow 之间完全靠背景色（emerald/cyan tint）区分，dark mode 下几乎不可见。**教训：语义色 tint 太淡不足以作为分隔手段——必须有显式边框；三级层次确保模块 > 侧 > 行的视觉优先级。**
- **Banded cluster 全列统一**：所有 per-side 列（Input, Native, Incentive, Total, $/day）都携带语义 band tint（emerald=Supply, cyan=Borrow）。只有 Net $/day（跨侧聚合）用中性 `HEADER_BASE`。旧版只有 APR 段（Native/Incentive/Total）有 band，Input 和 $/day 没有——视觉断裂让用户困惑"为什么只有这一段有颜色"。**教训：语义色 tint 应在全行一致应用，不能只选某几列——否则用户会误解为"有颜色的列"和"没颜色的列"是不同类别的数据。**
- **Wallet display 精度分场景**：wallet 显示标签（输入框外，只读）用 2 位小数（USD 模式）或 4 位小数（Token 模式），与 `formatUsd` 一致。输入框内的值仍用 `formatConvertedAmount`（8 位有效数字），因为用户在 USD↔Token 切换时不应丢失精度。**教训：只读展示用标准金融精度（2 位小数），可编辑值用高精度（8 位有效数字）——两者语义不同，不能用同一个 formatter。**
- **`?unified=0` opt-out 移除——unified 是唯一布局**：legacy `PortfolioTokenRow` + `PortfolioTokenRowPrototype` + `PortfolioSummaryCard` + `PortfolioResultsTable` 全部文件及测试从代码库删除。`unifiedMode` flag 删除，`?unified=0` URL 参数被完全忽略（SPA 仍能打开但统一渲染 unified table）。**教训：feature flag 从 opt-out 转"唯一模式"时，必须删除所有 flag 引用 + 删除 dead code 文件 + 更新/删除测试 flag 的测试用例——不能留 flag 在代码里"以防万一"。**

## Net $/day 符号 bug + Token 列间距
- **`borrowResult.usdPerDay` 已带符号（负数=成本），Net = supply + borrow（不是 supply - borrow）**：`computePositionUsdPerDay('borrow', ...)` 返回 `-nativeDaily + incentiveDaily`，已经是带符号的值。Per-row Net $/day 计算 `s - b`（其中 `b` 为负数）等于 `s + |b|`，导致只有 Borrow 时 Net 永远为正。正确公式是 `s + b`（代数加法），与 `aggregatePortfolioSummary` 中 `netUsdPerDay = supplyUsdPerDay + borrowUsdPerDay` 一致。**教训：当两个操作数中有一个已带符号时，求和用 `+`（代数加法），不用 `-`（减法）——`a - (-b) = a + b` 是基本数学但容易在"Net = supply - borrow"的语义直觉下写错。**
- **Token 列 `pr-0.5`（2px）比 `pr-1`（4px）更紧凑**：Token 列内容（icon + symbol）与 Input 列之间的 GROUP_SEP 边框线在 `pr-1` 时有 4px 空白，视觉上像边界线断裂。`pr-0.5`（2px）收窄间距，让边界线紧贴 Token 内容。**教训：表格中无底色列与有底色列之间的边界线，间距越小视觉越连续——空白间距会让人感觉边界线"断开"。**

## Portfolio Table 列等宽 + Total 行 band + Toggle 按钮尺寸
- **`table-layout: auto` 下 `50%` colgroup 是建议而非强制**：auto 模式按内容 max-content 分配宽度，`<col width="50%">` 只是浏览器优先参考。当两侧内容差异大时（一侧有 wallet display + 长数字，另一侧为空），等宽可能不完全成立。如果需要严格等宽保证，应改用 `table-layout: fixed`。当前实测两侧等宽，在注释中标注了 "auto layout hint"。
- **Total 行（tfoot）不需要 banded cluster 背景**：设计规范明确"Total 行只保留文字色（SUPPLY_COLOR/BORROW_COLOR），不加 SUPPLY_BAND/BORROW_BAND 背景"。Body 行保留 band 背景（与 header 呼应），Total 行用中性背景（`bg-muted/30`）+ 文字色区分。**教训：Summary/Total 行的视觉处理应与数据行不同——用文字色而非背景色传达语义，减少视觉噪声。**
- **$/T toggle 按钮必须与 input 行高一致**：`h-5`(20px) + `flex items-center justify-center` + `leading-none` 确保文字在固定高度内居中。移动端 `h-11 w-11`(44px) 满足触控目标要求。`px-0.5 → px-1` 增加水平 padding 使按钮不至于太窄。**教训：小按钮的 padding 选择需要同时考虑文字宽度和视觉权重——`px-0.5`(2px) 在只有单字符时太窄，`px-1`(4px) 更平衡。**
- **`postinstall` 不应在修改其他脚本时误删**：修改 `dev:staging` 时 `postinstall` 行被连带删除，review 发现后恢复。**教训：修改 package.json 时只改目标行，不动相邻行——diff 审查时逐行确认。**
- **文件顶部注释必须与代码同步**：`COL_WIDTHS` 从 `undefined` 改为 `'50%'` 后，文件头部的 "Input cols have no width → they absorb all remaining space" 注释与代码矛盾。**教训：修改常量值时必须同步更新所有引用该常量语义的注释。**
- **Input 列 `align-top` 导致内容不垂直居中**：Input `<td>` 上曾有 `align-top`（CSS `vertical-align: top`），使内容贴着单元格顶部，而其他列（Native/Incentive/Total/Earn）默认 `vertical-align: middle` 垂直居中。移除 `align-top` 后所有列对齐一致。**教训：表格单元格的 `vertical-align` 是设计系统级属性，不应按列单独设置——如果某列需要顶部对齐，应该所有列都统一顶部对齐，而非混用。**
- **"Token" → "Reserve" 命名更准确**：表格每行 = 一个 Aave Reserve（某链某资产的借贷池），不是 Token（一个 Token 可跨多链有多个 Reserve）。"Reserve" 是 Aave 协议精确术语。同时 Header text-left→text-center 与其他列统一。**教训：UI 标签应使用领域精确术语，不要用泛化的近似词——"Token" 是 ERC-20 概念，"Reserve" 是 Aave 协议概念，两者不同。**
- **Reserve 列 `pr-2` → `pr-3` 补偿减号按钮视觉不对称**：左侧有 minus 按钮（`gap-1`=4px），`pl-2`(8px)+gap(4px)=12px 左侧总空间，右侧 `pr-2`(8px) 显得局促。`pr-3`(12px) 使两侧视觉平衡。**教训：当列内有额外 UI 元素（按钮、icon）占用空间时，padding 需要考虑这些元素的实际视觉占用，不能只看 CSS padding 值。**
- **Input Supply header `<th>` GROUP_SEP 遗漏**：§4.4 rule 1 要求 GROUP_SEP 必须出现在每个模块的首列，但 Input 模块的 Supply `<th>` 漏了 `border-l border-border/60`，而 Native/Incentive/Total/Earn 都有。**教训：修改边框规则后必须逐模块、逐行（header row 1/2、body、tfoot）对照清单验证，"看一眼觉得对"不够——需要 Playwright 逐 td 检查 computed style。**
