# 设计系统与交互规范（可复用参考）

本文档是本仓库里**唯一主打跨项目迁移**的设计文档：汇总设计习惯与通用 UI/交互规范，**适用于本仓库，也可直接复制到其他前端项目**作为设计参考。项目特定内容见附录；产品行为边界仍以 `frontend-interaction-guardrails.md` 为准。

写作目标：像一份可直接复制到新项目的 `DESIGN.md` 模板，保留通用规则，避免业务绑定。阅读者应能把文中的 token、颜色、字体和组件约定替换成自己的设计系统后直接使用。

### 文档修改政策（强制）

1. **已有规则不可被覆盖或静默改写**。任何新增章节、新组件规范或新场景适配，如果与本文档中已经确认并生效的现有规则存在冲突（包括但不限于：token 用法变更、布局优先级翻转、颜色语义替换、截断/换行策略修改），**必须停止当前修改并向设计者/用户确认**，不得擅自取舍。
2. **只能叠加、不能替换**。新需求若与旧规则方向不同，正确的做法是新增一条"例外"或"细分场景"条目，并把旧规则保留为默认行为；或者在文档中标注"待确认：与 §X 冲突"，等待用户裁决后再落笔。
3. **冲突示例**：若旧规则要求"表格内容优先换行"，而新场景要求"密集列优先截断"，不能直接把旧规则改成"优先截断"；应写成"默认优先换行；在 table-fixed 窄列且含尾部图标等特定条件下，允许对单行文本使用尾部省略（见 §X.Y）"。
4. **Token、颜色、字体命名一旦确定，仅允许追加新值，不允许重新分配既有名称的语义**（如把已约定给 `emerald-500` 的语义改给 `emerald-600`）。如需调整，走显式废弃 + 迁移说明。

---

## 1. 视觉与主题

- **浅色**：温暖雾白基底 + 主色 + 品牌点缀；避免冷白。
- **暗色**：深炭黑背景 + 高对比，保持与浅色相同的圆角与层级体系。
- **间距基准**：4px 基准（0.5rem = 8px, 1rem = 16px），使用设计 token（如 `--ds-space-*`）保证一致。

### 语义色（通用）

| 用途   | Light 示例     | Dark 示例      |
|--------|----------------|---------------|
| 背景   | 雾白/暖灰      | 深炭黑        |
| 正文   | 深灰/黑        | 浅灰/白       |
| 卡片   | 略浅于背景     | 略浅于背景    |
| 边框   | 中性灰         | 深灰          |

### 品牌色与数据色（可按项目替换）

- 主色 / 强调色：用于 CTA、选中态。
- 数据/状态色：成功（绿）、警告（琥珀）、错误（红）、信息（蓝）、冻结/暂停（天蓝/sky-500）— 仅用于对应语义，不用于普通数据展示。

---

## 2. 色彩语义原则（告警色专用）

**语义色仅用于其对应含义**，避免用语义色做装饰。

| 颜色     | 用途           | 示例                     |
|----------|----------------|--------------------------|
| 琥珀/橙  | 仅警告         | 超限、风险提示、过高利用率 |
| 红       | 仅错误/危险    | 失败、不可用             |
| 绿/翠绿  | 正常/成功/正向 | 安全区间、成功操作       |

**普通数据展示**用中性色：`text-foreground`、`text-muted-foreground`。数值、市场大小等非状态信息不用琥珀/红/绿，以便用户一眼识别“出现琥珀 = 警告”。

**辅助元素与文字同色**：进度环、状态图标等紧挨数值时，用 `currentColor` 或与相邻文字一致；仅在有明确语义（警告/错误/成功）时改用语义色。

### 2.1 颜色档位规范（告警色分级）

为了平衡视觉清晰度与风险预警的精确性，告警色采用**两档与三档并存**的策略：

| 分级策略 | 适用指标 | 档位定义 | 颜色 |
| :--- | :--- | :--- | :--- |
| **两档** | Utilization、Liquidity | Safe / Warning | `brand-cyan` / `amber-600` |
| **三档** | Supply Cap、Borrow Cap、Deficit | Safe / Warning / Critical | `brand-color` / `amber-600` / `amber-500` |

**亮度梯度原则**：越严重越亮越醒目——`amber-500`（亮黄橙）比 `amber-600`（深棕橙）更亮，因此 Critical 用 `amber-500`，Warning 用 `amber-600`。

**两档指标**（连续型/相对型）：
- **Utilization**: ≤ optimal (Safe) / > optimal (Warning)
- **Liquidity**: ≥ $10K (Safe) / < $10K (Warning)
- 统一使用 `amber-600` 作为警告色，避免颜色过载

**三档指标**（容量型/硬性限制）：
- **Supply/Borrow Cap**: < 80% / 80-95% / ≥ 95%
- **Deficit Share**: < 8% / 8%-20% / ≥ 20%
- 在接近容量上限时（≥ 95%）使用 `amber-500` 强化告警（更亮更醒目）

**统一原则**：所有 Warning 级别（无论是两档还是三档的第二档）统一使用 `amber-600`，Critical 级别统一使用 `amber-500`，确保用户形成"琥珀色越亮 = 越严重"的心智模型。

### 2.1.1 Amber 色号 Token 定义

| Token | RGB 值 | Hex | 语义 | 文本工具类 | 背景工具类 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `--ds-amber-100-rgb` | 254 243 199 | `#fef3c7` | 极浅黄底 | — | — |
| `--ds-amber-300-rgb` | 252 211 77 | `#fcd34d` | 暗色模式警示文字 | — | — |
| `--ds-amber-500-rgb` | 245 158 11 | `#f59e0b` | **Critical** 临界告警 | `ds-text-amber-500` | `ds-bg-amber-500-10` |
| `--ds-amber-600-rgb` | 217 119 6 | `#d97706` | **Warning** 主力告警色 | `ds-text-amber-600` | — |
| `--ds-amber-700-rgb` | 180 83 9 | `#b45309` | 模拟器警告行文字 | `ds-text-amber-700` | — |
| `--ds-amber-900-rgb` | 120 53 15 | `#78350f` | 深琥珀（禁用提示） | `ds-text-amber-900` | — |
| `--ds-paused-rgb` | 245 158 11 | `#f59e0b` | **Paused** 资产暂停 | `ds-text-paused` | `ds-bg-paused` |

> `--ds-paused-rgb` 与 `--ds-amber-500-rgb` **视觉同色**，但语义独立：
> - `amber-500` → 数据指标临界告警（Cap ≥ 95%、Deficit critical）
> - `paused` → 协议状态标记（`isPaused` 资产暂停）
>
> 两者从 token 层分离，确保未来如需独立调整 Paused 色时只需改一处变量。

### 2.1.2 语义化背景 & 边界工具类

| 类名 | 用途 | 效果 |
| :--- | :--- | :--- |
| `ds-bg-warning-row` | 模拟器 / 表格的 Warning 行背景 | 浅黄底（`amber-50/50`），暗色模式深琥珀（`amber-950/20`） |
| `ds-bg-critical-row` | Critical 告警条 / Paused 禁用条背景 | 浅黄底（`amber-50/80`），暗色模式深琥珀（`amber-950/30`） |
| `ds-border-paused-50` | Paused 状态边框 | `--ds-paused-rgb` @ 50% 透明 |
| `ds-border-warning-60` | Warning 状态边框 | `--ds-amber-500-rgb` @ 60% 透明 |

### 2.1.3 暗色模式覆盖规则

| 类名 | 亮色模式 | 暗色模式 |
| :--- | :--- | :--- |
| `ds-text-amber-700` | `--ds-amber-700-rgb` (#b45309) | `--ds-amber-300-rgb` (#fcd34d) |
| `ds-text-amber-900` | `--ds-amber-900-rgb` (#78350f) | `--ds-amber-100-rgb` (#fef3c7) |

### 2.1.4 Amber 色使用场景总表

| 场景 | 语义 | 文字色 | 背景色 | 边界色 |
| :--- | :--- | :--- | :--- | :--- |
| 利用率 > optimal | **Warning** | `ds-text-amber-600` | — | — |
| 流动性 < $10K | **Warning** | `ds-text-amber-600` | — | — |
| Cap 80-95% | **Warning** | `ds-text-amber-600` | — | — |
| Cap ≥ 95% | **Critical** | `ds-text-amber-500` | — | — |
| Deficit 8-20% | **Warning** | `ds-text-amber-600` | — | — |
| Deficit ≥ 20% | **Critical** | `ds-text-amber-500` | — | — |
| 模拟器 Warning 行 | **Warning** | `ds-text-amber-700` | `ds-bg-warning-row` | — |
| 模拟器 Cap 超限条 | **Critical** | `text-amber-500` | `ds-bg-critical-row` | `border-[rgb(var(--ds-amber-500-rgb)/0.6)]` |
| 资产 `isPaused` | **Paused** | `ds-text-paused` | `ds-bg-paused` / `ds-bg-critical-row` | `border-[rgb(var(--ds-paused-rgb)/0.6)]` |
| 资产 `isFrozen` | **Frozen** | `sky-500` | `ds-bg-sky-500-8` | — |

---

## 3. 排版与间距

- **字体**：Sans 用于正文与 UI，Mono 用于代码/数值；可选用同一字族的不同 weight。
- **字号尺度**：统一使用设计 token（`ds-text-9` ~ `ds-text-24`），避免随意 `text-sm`/`text-base` 混用。其中 `ds-text-9` (9px) 用于极小标签（如热门币提示徽章）、`ds-text-10` (10px) 用于紧凑标签，`ds-text-11` (11px) ~ `ds-text-13` (13px) 为常用小字。**禁止**在组件源码中使用 `text-[Npx]` 任意值硬编码字号——所有字号必须通过 `ds-text-N` token 引用。
- **⚠️ 反模式：`!ds-text-N`（禁止）**：`!ds-text-N` 会同时生成 `font-size: Npx !important` **和** `line-height: calc(Npx * 1.25) !important`，后者会覆盖业务元素（如 `<Input>` 的 `leading-4`/`leading-7`）上精心设定的行高。如果需要覆盖第三方 Input 组件的字号，使用 CSS 任意属性语法 `![font-size:var(--ds-text-N)]`，它只覆盖 `font-size`，不引入 `line-height`。已有回归测试守卫此反模式：`src/test/font-size-token-regression.test.ts`。
- **数值**：一律 `tabular-nums` 保证对齐。
- **数值溢出：硬切，不省略（强制）**：已通过 `formatReserveSizeUsd` / `formatReserveSizeToken` 缩写为 K/M/B 格式的金额/数量值（如 `$123.45M`、`1.08B`），移动端空间不足时必须使用 `overflow-hidden whitespace-nowrap`（硬切），**禁止**使用 `truncate` / `text-overflow: ellipsis`（尾部省略号）。省略号 `…` 在金融数值上会造成歧义（`$123.4…` 是 `$123.40M` 还是 `$123.45M` 无法分辨），硬切优于省略号。文本标签（market name、hub name 等）不受此条约束，可继续使用 `truncate`。
- **文字与边框**：**强制** — 所有带边框的容器（卡片、表格单元格、警告条、按钮）内，文字与边框之间至少保留 8px（`--ds-space-2`）内边距，不得贴边。
- **文字与箭头/图标**：**强制** — 文字与紧邻的箭头、chevron、展开/收起图标之间必须留有呼吸空间，使用 `gap-[var(--ds-space-1)]`（4px）或 `gap-[var(--ds-space-1-5)]`（6px）。等效的 Tailwind 简写 `gap-1` / `gap-1.5` 亦可。禁止文字与箭头紧贴（如 `gap-0` 或无 gap 的 flex）。此规则适用于：下拉按钮（如 Size ⌄）、下拉菜单选项、排序选项、展开指示器、导航箭头等所有文字+图标的组合。
- **Token symbol 优先单行 + 放不下时换行（强制）**：所有端（桌面 + 移动）的 token symbol 必须**优先单行完整显示**；只有在真实可用宽度不足时，才**允许换行到下一行**继续显示完整 symbol（CSS：`break-words` + `min-w-0`，由 flex 父级配合 `flex w-full min-w-0`）。**禁止**对 short symbol 做提前缩写（如 `USDT` → `U...`），**禁止**使用 `truncate` / 尾部省略号、`break-all`、逐字符换行或中间截断。这是\"优先单行、放不下时换行（never truncate）\"的统一规则，覆盖之前\"放不下时尾部省略\"的旧约定。

### 数据列层级（Supply / Borrow APY、Size、Util）

与 `docs/design/frontend-interaction-guardrails.md` 中「同色内部少档位」原则一致：

| 层级 | 桌面 Reserves 表 | 移动端储备卡 | 字色 / 说明 |
|------|------------------|-------------|-------------|
| 主值（合计 APY） | `ds-text-14` + `font-bold` | hero `ds-text-24` + `font-bold` | Supply `emerald-500`，Borrow `brand-cyan` |
| **Size**（供给/借出规模） | `ds-text-13` + `font-medium` | 顶行金额 `ds-text-13` + `font-medium` | **满饱和** 同主色（与 APY 主值同色阶，不是 `-70`） |
| 次级（Native + incentive） | `ds-text-11`；native 可选 `font-medium` | 同左 | 小一号 + `*-70` + pill；**刻意**弱于 Size，不要复用 Size 样式 |
| Spread | `ds-text-14` + **`font-bold`** | 展开条内 `font-medium` | 紫色语义；桌面与 Supply/Borrow **主数字同档粗体** |
| Util 迷你条 + 圆点 | 与 Util % 并排 | 同左 | 分区：青/琥珀各一档淡填充；标记点 = **实心圆点**（可略大半径），**不**用描边、不外圈柔光 |

### 可迁移的设计习惯（本项目偏好，可复制到其他项目）

1. **同色少档位**：同一语义色避免堆多种透明度/色阶；Util、APY 次级按 guardrails 即可。
2. **数据点不靠描边**：小圆点、标记点用更实填充或略大半径；**不**把 `stroke` 外轮廓当默认习惯。
3. **Spread 与主列同强**：桌面 Spread 列用 **`font-bold`**，与 Supply/Borrow APY 主值同级。
4. **次级 ≠ Size**：Native/Incentive 是 **分解行**（`ds-text-11` + `*-70`）；Size 是 **主数据**（`ds-text-13` + 满饱和 + `font-medium`）—层级不同，**不是**同一套字体规格。
5. **移动/桌面 token 对齐**：移动端 Size、tab、cap sheet 与桌面共用 `emerald-500` / `brand-cyan`，避免无端深一档（如 `emerald-600`）。

### 控件高度 Token 参考

所有控件高度（按钮、输入框、分段控制器、tooltip）必须通过 CSS 自定义属性引用，禁止硬编码 `h-8`/`h-9`/`h-11` 等 Tailwind 固定高度。

| Token | 值 | Tailwind 写法 | 适用场景 |
|-------|-----|-------------|---------|
| `--ds-chip-h` | 1.75rem (28px) | `h-[var(--ds-chip-h)]` | 筛选芯片、热门币标签、分段控制器 chip 模式、批量面板 token 输入 |
| `--ds-control-h` | 2rem (32px) | `h-[var(--ds-control-h)]` | 桌面输入框、分段控制器默认模式、图标按钮（32px）、toast 按钮 |
| `--ds-button-sm-h` | 2.25rem (36px) | `h-[var(--ds-button-sm-h)]` | `<Button size="sm">`、表格表头行、主题切换按钮、分页按钮 |
| `--ds-button-h` | 2.5rem (40px) | `h-[var(--ds-button-h)]` | `<Button>` 默认尺寸 |
| `--ds-button-lg-h` | 2.75rem (44px) | `h-[var(--ds-button-lg-h)]` | `<Button size="lg">`、下拉刷新指示器、滑块手柄 |
| `--ds-ring-tooltip-max-w` | 220px | `max-w-[var(--ds-ring-tooltip-max-w)]` | 利用率/借出上限环形图的 TooltipContent |

**禁止**在组件源码中硬编码 `h-8`/`h-9`/`h-11`。回归测试：`src/test/control-height-token-regression.test.ts`。巡检脚本：`bash scripts/check-hardcoded-tokens.sh --strict`。

---

## 4. 布局原则

- **移动优先**，触控目标 ≥ 44×44px。
- **多列面板**（如 Supply / Spread / Borrow）：等宽列、统一压缩，不单独给某一列固定或更大宽度。
- **表格**：表头与占位符（如 `-`）使用相同列宽与对齐，避免表头与内容错位。**所有表格内容统一遵循\"优先保持单行，仅在确实放不下时换行\"**——既不\"优先换行\"也不\"省略\"，token symbol、市场名、价格、APY 等都按这条规则处理。换行通过 `break-words` + `min-w-0` 实现，**禁止**使用 `truncate` / 尾部省略号或 `break-all`。
- **相邻列最小可见 gap（强制，跨场景通用）**：任何\"多列\"布局——不仅是 `<table>`，也包括 grid、多列卡片、并排面板——**相邻列之间必须保留固定的最小可见间距**，让相邻列的文字、数字、尾部图标不会在窄视口下读起来像粘成一团或互相覆盖。最小值建议 **≥ `--ds-space-2` (8 px)**；当某一列以尾部图标（外链 `↗`、菜单触发器、chevron 等）结束、邻列以紧凑数字/价格开头时，**总间距 ≥ 10 px**（典型实现：`pr-[var(--ds-space-2)]` + `pl-[var(--ds-space-1-5)]`，或者用一个统一的列间 `column-gap`/`gap` 变量）。该最小值在 header / body / skeleton 必须**保持一致**；只增不减——不允许在某一行类型把它降到下限以下。落到具体表格的执行细则见 §4.1。
- **叠层 sticky 表头 + 页面滚动**：若顶栏与 `<thead>` 均 `position: sticky` 且 `top` 意在相对**视口**叠放，**禁止**用包住整张表（含 `thead`）的 `overflow-x-auto` / `overflow: hidden` 等制造**独立 scrollport**，否则 `thead` 的 `top` 会相对该盒计算，与视口 sticky 错位（缝中大段空白、tbody 从缝露出）。**桌面展开 simulation 时**，主数据行各 `td` 须再叠一层 sticky（`--reserves-expanded-main-row-top`），避免长 simulation 滚动时 Token/市场行消失。本项目细则见 **[frontend-interaction-guardrails.md](frontend-interaction-guardrails.md)** § *Desktop reserves table: sticky stack and scrollport (normative)* 与 *DOM contract / CSS variables*。
- **对称**：成对出现的区块（如 Supply / Borrow）在布局与视觉权重上保持对称。

### 4.1 相邻单元格的自适应留白（跨列呼吸空间）

密集数据表里的"图标/箭头看起来压到下一列"有两种根因，**必须先分清**才能修对地方：

#### A. Padding 配对失衡（列宽够，只是间距小）

当列宽足够、只是相邻 padding 太紧时，强制规则：

1. **尾部图标属于它所在的列**。`AssetActionMenu`、外链 `↗`、溢出菜单触发器、展开 chevron 等渲染在单元格末尾的元素，视觉上会探进下一列；解决方案是在**它所在列**增加 `pr`，而不是在邻列掩盖。
2. **成对 padding（pairwise padding）**：当一列以尾部图标结束、下一列以数字/价格/芯片开头时，两侧必须同时贡献留白——典型配对是 `pr-[var(--ds-space-2)]` + `pl-[var(--ds-space-1-5)]`，给出 ≥10 px 可见间距。**不要**把所有负担压到单侧（既会压扁图标，也会扰动整张表的列宽预算）。
3. **表头可以比行体更紧**：表头列没有尾部图标，`pr`/`pl` 可以比行体小一档；但当两列都带排序箭头 `↓` 时，相邻列之间至少保留一档 `pr-[var(--ds-space-1)]`，否则两个箭头会读起来像同一个符号。
4. **Header / Body / Skeleton 必须同步修改**。只改表头（或只改行体）一定会回归——静态截图看似对齐，一旦真实数据/图标渲染出来就破形。
5. **优先"两端各让一点"，少做单边大跳**。在固定 `table-fixed` + 百分比列宽的栅格里，单侧把 `px-0.5` 直接跳到 `px-3` 会把邻列挤偏；相邻两列各上升一档通常更稳。

#### B. 内容溢出 cell 边界（列宽不够，padding 永远盖不住）

当"问题只在窄视口复现、宽视口正常"时几乎一定是这类——**单元格里的 `inline-flex` 贴合内容宽度**，一旦内容总宽 > cell 实际宽度（`table-fixed` + 百分比列宽），整坨内容会直接溢出到邻列，此时加多少 `pr` 都没用，因为 padding 只是 cell 内部预留，约束不了 `inline-flex` 向外扩。

必修四件套（缺一回归）：

1. **Cell 兜底**：`<TableCell className="... overflow-hidden">`，阻止内部任何残余溢出穿到邻列。
2. **容器吃满宽度**：把 `inline-flex` 换成 `flex w-full min-w-0`（外层 `items-center justify-center`，仍可居中），这样 flex 容器宽度 = cell 内容区宽度，不会贴合内容再外扩。
3. **文本可收缩并允许换行**：唯一允许收缩的元素（通常是 token symbol / 标题文案）加 `break-words min-w-0`——**优先单行展示，真放不下时换行到下一行继续显示完整文本**（符合 §3「Token symbol 优先单行 + 放不下时换行」与 §4「表格统一优先单行、放不下时换行」）。**禁止**使用 `truncate` / 尾部省略号（会丢失信息），也**禁止** `break-all`（会逐字符换行，破坏可读性）。如果发现 `break-words` 在某些纯连续字符的 symbol 上视觉换行不生效，先靠 cell `overflow-hidden` 兜底，再讨论是否引入 `[overflow-wrap:anywhere]` 这类按字符断行的兼容手段——**不要**直接退化到 `truncate` 或 `break-all`。
4. **固定尺寸元素都 `shrink-0`**：icon 外层、徽章/雪花 `<span>`、`AssetActionMenu`（通过 `triggerClassName="shrink-0"`）等必须保留原尺寸的元素必须标记 `shrink-0`，否则它们会被 flex 压扁或消失，窄视口看起来"图标不见了"。

#### 诊断顺序（4 步定位）

0. **先量当前 gap 是否合规**（前置体检，最便宜的一步）：把相邻两列实际的 `pr-* + pl-*` 加起来——普通列必须 ≥ 8 px（`--ds-space-2`），含尾部图标的列必须 ≥ 10 px。如果连下限都没达到，**先把 gap 调到合规再说**，多数"看起来粘成一团 / 图标贴上数字"的问题在这一步就解决了。建议把列间 gap 抽成 CSS 变量（如 `--ds-reserves-col-gap-header` / `--ds-reserves-col-gap-body`）+ 一组 `ds-*-cell-{th,td}{,-edge-l,-edge-r}` utility class 集中管理，避免散落 `pl-*` / `pr-*` 难以维护。
1. **看是不是只在窄视口复现**：是 → 走 B 路径（内容溢出）；否 → 走 A 路径（padding 配对）。
2. **找尾部图标属于哪一列**：多数时候是"上一列"的尾部节点（例如 Price 列里看到的 `↗` 其实是 Token cell 的 `AssetActionMenu`）。
3. **A 路径**：检查该列的 `pr` 与下一列的 `pl` 之和是否 ≥ 10 px，并同步 header / body / skeleton。**B 路径**：把容器从 `inline-flex` 改成 `flex w-full min-w-0`，给文本 `break-words min-w-0`（不是 `truncate`），其他元素 `shrink-0`，并给 cell 加 `overflow-hidden` 兜底。

这三种根因（gap < 下限、padding 配对失衡、内容溢出）能覆盖几乎所有"箭头/外链/chevron 撞到价格"问题，先按 0 → 1 → 2 → 3 顺序排除。

#### 测试防回归

jsdom / `renderToString` 的单测**不会**真的跑布局，无法直接断言"元素没溢出"，但可以**结构性**锁定上述不变量（`overflow-hidden`、`flex w-full min-w-0`、`truncate`、`shrink-0`）不被后续重构误删。真正的像素级回归仍需 Playwright e2e 在目标视口截图或用 `getBoundingClientRect` 断言相邻元素间距。参考 `src/components/dashboard/DesktopReserveRow.test.tsx` 里的 *"keeps Token cell content from overflowing into the Price column at narrow widths"* 用例模板。

### 4.2 密集数据表的分层响应式压缩（4 层 + 安全网，跨场景通用）

> 当一张多列、信息密度高的表格（reserves、订单、行情、leaderboard 等）需要在不同 viewport 下保持可读时，**列宽的百分比缩放只是 4 层压缩中的最外层**。光靠 `table-fixed` + 百分比列宽并不足够——padding 是 px 常量、内容是不可压缩的图标 + 数字，节奏不同步会导致：宽视口下显得空荡（gap 占列宽比例过小）、窄视口下 padding 反而吃掉过大比例（最差时 10%+），并把内容挤到溢出。
>
> **正确的做法是分 4 层主动压缩 + 1 张安全网兜底**——这是密集表设计的可迁移最佳实践。

#### 四层压缩（按介入顺序，从被动到主动）

| 层 | 何时介入 | 压什么 | 具体手段 |
|---|---|---|---|
| **L1. 列宽响应式** | 永远（基础） | 整列宽度 | `table-fixed` + `<colgroup>` 百分比 / CSS Grid `1fr`-`minmax()` |
| **L2. padding 自身响应式** | viewport 变化时 | 列内左右留白（含**外缘 padding**，见下文）| 把 padding 抽成 CSS 变量，在断点（推荐 `<1024 / 1024-1440 / ≥1440`）或 `clamp()` 中重写；**禁止**写成 px 常量 |
| **L3. 内容压缩** | padding 已到下限、列宽继续缩 | 单元格内的元素本身 | 文本 `break-words min-w-0`、图标 `shrink-0`、cell `overflow-hidden` 兜底（详见 §4.1 路径 B）|
| **L4. 断点切视图 / 隐藏次要列** | 极窄场景（< 768 px 等） | 整张表的形态 | 桌面表 ↔ 移动卡 切换；或 `hidden md:table-cell` 隐藏 Spread/Util 之类次要列 |

#### L2 内的两个子量：列间 gap vs 外缘 padding（必须分开管）

L2 不只一个值——密集表至少有 **两套** padding 要分别响应式：

| 子量 | 作用位置 | 视觉职责 | 推荐取值 |
|---|---|---|---|
| **列间 gap**（`gap/2` 在每个 interior 边）| 列 N 与列 N+1 之间 | 防止内容糊成一团 | 普通列 ≥ 8 px、含尾部图标 ≥ 10 px（见安全网） |
| **外缘 padding**（first column 的左 / last column 的右）| 表格容器边 ↔ 第一/最后一列内容之间 | 让表格内容不贴容器边、跟卡片 border 之间有"层次感" | **外缘 padding ≈ 列间 gap × 1.5–2**（外缘比内缘更宽） |

为什么外缘必须比内缘宽？因为视觉层级上外缘是"卡片 / 容器内边距"的一部分，需要和**容器外的负空间**（卡片 border、页面背景）形成层次；列间 gap 只在"列 ↔ 列"两个**对等**元素之间分隔。两者职责不同，给同样的值（如都用 `--ds-space-2 = 8 px`）就会让表格"贴壳"——第一列的 icon 看起来跟卡片左边贴上、最后一列的数字看起来跟卡片右边贴上。

> **本仓库实现**：`--ds-reserves-edge-pad` 三档断点驱动 12 / 16 / 20 px，对比 `--ds-reserves-col-gap-body` 同档 10 / 12 / 14 px，外缘约为内缘的 1.5×（narrow）→ 1.4×（wide）。

#### 安全网：相邻列最小可见 gap

横跨所有 4 层的硬下限，**任何断点档位、任何视口宽度、任何 viewport 大小都不允许跌破**：

- **普通列对**：≥ `--ds-space-2` (**8 px**)
- **含尾部图标的列对**（外链 `↗`、菜单触发器、chevron 等）：≥ **10 px**

L2 的所有断点档位都必须先满足这个下限再决定具体值；L1 的列宽百分比也不能让某列在最窄视口下被压到内容根本放不下。

#### 为什么必须分层（而不是只用一种）

只用某一种都会出问题：

- **只 L1**：列宽缩，padding 是常量 → 窄视口里 padding 占列宽比例急剧膨胀（13% 的 Token 列在 768 px 时 padding 占 10%+），内容被挤溢出；宽视口里 gap 又显得空荡。
- **只 L2**：padding 缩到位，但内容（图标 + 文本）本身不可压缩，撞墙后还是溢出。
- **只 L3**：每行都换行 / `truncate`，宽视口下也强行压缩，浪费空间。
- **只 L4**：断点跳变粗暴，断点之间的视口段照样错位。

四层叠在一起、+ 安全网兜底，才能在 **768 → 2560** 这种巨大的视口跨度下保持"看起来都合理"。

#### 实现建议（项目无关）

1. **抽 CSS 变量作为单一事实来源**：列间 gap、padding、列宽阈值都做成 `--ds-table-*-gap` / `--ds-table-*-pad` 这类语义变量，不要散写在每个 cell 上。
2. **L2 优先用 `@media` 断点**而非 `clamp()`：除非容器宽度严格跟 viewport 同步，否则 `clamp(min, vw, max)` 跟 viewport 不跟 container，遇到 sidebar 或多 panel 布局会失真。Container queries 在更通用但兼容性 / 复杂度更高，按项目情况选。
3. **每个断点档都过一次安全网**：写完 `@media (min-width: X)` 之后心算一下 `gap < 8 px` / `gap < 10 px` 没有；窄屏 base 值通常是被它强制定下来的。
4. **结构性测试锁住 L3 的不变量**（`overflow-hidden` / `min-w-0` / `shrink-0` / 不准 `truncate` / 不准散写 `pl-/pr-` 数字 padding）；像素级回归交给 e2e。

#### 反模式（看到立即停手）

- 把 padding 写成 px 常量（"10 px 一刀切"）——失去 L2，宽窄视口都会别扭。
- 在某个 cell 用 `pl-[var(--ds-space-3)]` 这类 ad-hoc 数字 padding 去"局部修一下"——破坏了集中式 CSS 变量，下一个人改不动。
- 用 `truncate` / `break-all` 解决溢出——丢信息或破可读，**永远先走 L3 的 `break-words` + 容器 `overflow-hidden` 兜底**。
- 让 header / body / skeleton 三处的 padding 各跑各的——必然在某一行出现"列对不齐"或"第 2 行 gap 比第 1 行大"的视觉裂缝。
- **把外缘 padding 等同于列间 gap 的一半**（即外缘 = `gap/2`，跟 interior cell 的某一侧一样）——表格内容会"贴壳"，第一列的 icon 看起来跟卡片左 border 贴上。外缘必须有自己的变量，至少是列间 gap 的 1.5×。

#### 在本仓库中的落地

L1 / L2 / L3 / L4 + 安全网在 reserves table 的具体执行细则见 [`frontend-interaction-guardrails.md`](frontend-interaction-guardrails.md) 的 *Cell padding (horizontal)* / *Cross-column minimum visible gap* / *Token cell overflow-containment invariants* 三节，以及 `src/index.css` 里 `--ds-reserves-col-gap-{header,body}` 与 `--ds-reserves-edge-pad` 的三档断点定义。

### 4.3 密集表对齐策略（按列内容性质分配 left / center / right，跨场景通用）

> 你只统一了 padding gap，但表格看起来"列间距时大时小、个别列像被挤扁"——这往往不是 padding 的问题，而是**对齐策略错配**。CSS 上每对相邻列的 padding gap 是常量，但**眼睛看到的视觉间距 = padding gap + 列 N 内容右边到 cell 右边的余量 + 列 N+1 内容左边到 cell 左边的余量**。当所有列都 `text-center`，内容窄的列两侧留出大量"居中余量"，内容宽到撑满的列几乎没有余量——视觉间距自然忽宽忽窄。
>
> **解法是按内容性质分配对齐方向**，让"row 间内容起点对齐"或"row 间数字按位对齐"成为视觉锚点。这是密集数据表设计的工业标准，跟分层响应式压缩（§4.2）一起构成密集表设计的两大支柱。

#### 三类对齐（按内容判定）

| 内容性质 | 对齐 | 视觉锚点 | 典型例子 |
|---|---|---|---|
| **identifier / 文本主导**（symbol、名称、标签）| **left** | row 间起点对齐——眼睛从左到右扫读时所有 row 第一字符在同一 x 坐标 | Token symbol、Order ID、User name |
| **数字主导 / tabular-nums**（价格、百分比、APY、size）| **right** | row 间末位对齐——小数点 / 千分位 / 数量级在同一 x 坐标，扫读时立刻察觉数量级差异 | Price `$1.00` vs `$1,234.56`、APY `2.90%`、Spread |
| **chip / 视觉容器 / 图形 + 数字组合**（badge、市场标识、图表）| **center** | 内容自带视觉边界，居中最稳；左右余量小因为 chip 通常贴近列宽 | Market chip、进度环 + 数字、bar chart + 数字 |

#### 为什么不能"全部居中省事"

- **居中余量随内容变化** → 同一列不同 row 的内容宽度不同（"ETH" vs "PT-USDe-7MAY2026"），居中后两侧余量也不同；row 间起点 / 终点都不对齐，扫读时眼睛要左右移动。
- **相邻列视觉间距失控** → 内容窄的列对（如 Token + Price 短数字）居中后两边各留 20+ px，邻列视觉间距 ≈ padding + 40 px；内容宽的列对（如 Market chip 撑满）几乎没居中余量，邻列视觉间距 ≈ padding。同一张表里能差出 2-3 倍。
- **数字按位对齐丢失** → 财务表读 `$1.00` vs `$1,234.56` 居中时小数点不对齐，眼睛要重新定位每一位的"位"，扫读速度大幅下降。

#### Sort arrow 位置规则（与对齐方向耦合）

| header 对齐 | sort arrow 位置 | 原因 |
|---|---|---|
| **left** | 文字 **右** 侧（`<span>Label</span> ↓`） | label 起点已贴 cell 左边；arrow 在右不会越过下一列 |
| **right** | 文字 **左** 侧（`↓ <span>Label</span>`） | label 终点已贴 cell 右边；arrow 在右会撞 cell padding / 邻列；放左侧不会跨越列边界 |
| **center** | 文字 **右** 侧（默认） | 居中对齐没有"贴边"压力，约定俗成 arrow 在 label 之后 |

如果违反这个规则——比如 right-aligned 列的 arrow 在文字右侧——arrow 会顶到 cell 右 padding，要么挤压 padding 让 visual gap 跌破最小可见值（§4 安全网），要么需要硬扩 padding 让出位置。两个都是症状不是治标。

#### 反模式

- **数字列居中** → 小数点不对齐，扫读丢失"位感"。
- **文本列居中**（特别是 first column）→ row 间起点不对齐，扫读眼跳。
- **chip 列右对齐 / 左对齐** → chip 撞 cell 边或浮在中间，破坏 chip 自身的视觉边界感。
- **right-align 数字列时 sort arrow 仍在文字右** → arrow 越过列边界，要么挤压 padding，要么需要额外硬编码间距。
- **改对齐时只改 cell `text-*`、不改内部 flex `justify-*`** → 文字虽对齐，但内部 flex 容器（如 `flex flex-col items-center`）让换行 / 多行内容仍在中间，跟主行对不齐。改 `text-right` 时记得把同一 cell 内层的 `items-center` 改成 `items-end`、`justify-center` 改成 `justify-end`。

#### 实现建议（项目无关）

1. **先列出所有列、按"内容主导是什么"分类**——不要凭直觉，凭"用户扫读时眼睛锚什么"。
2. **header 跟着 body 一起改**——header 的 `<th>` 对齐方向必须与 body 一致，否则 sort arrow 跨列、column label 跟数据列对不上。
3. **内部 flex 跟着 cell `text-*` 一起改**——`text-right` 不会自动让 flex column 的子元素 `items-end`。多行内容的 cell 特别注意。
4. **结构性测试锁住对齐**——单测 `<td>` 的 className 必须包含 `text-left` / `text-right` / `text-center`，并加反向断言禁止"silent revert 到 text-center"。
5. **对齐变化要同步 skeleton**——loading 状态的占位条对齐方式必须与真实内容一致，否则 loading-to-loaded 闪烁。

#### 在本仓库中的落地

reserves desktop table 的 8 列对齐分配：

列顺序遵循 **DeFi/lending 协议表惯例**（Asset → Network/Market 紧贴 — 参考 Aave UI / Compound / Spark / Morpho — Market 紧贴 Asset 帮助用户先建立"在哪条链上交易这个 token"的心智）：

| 列 | 对齐 | 内容 |
|---|---|---|
| Token | **left** | identifier (symbol + icon) |
| Market | center | chain chip |
| Price | **right** | tabular number |
| Size | **right** | 数字 + 进度环（无 cap 行用 12×12 ring placeholder 占位）|
| Utilization | **right** | 数字 stack + bar chart prefix |
| Supply | **right** | APY 主数字 + incentive chip |
| Spread | **right** | tabular number |
| Borrow | **right** | APY 主数字 + incentive chip |

> **占位规则（mandatory）**：当一列在不同行有 / 没有装饰元素（如 Size 列的 progress ring、Util 列的 bar chart）时，必须给"没有装饰"的行加同尺寸透明占位（如 `<span aria-hidden className="inline-block w-3 h-3" />`），确保数字垂直栅格在跨行时严格对齐。这不是审美选项，是数字表的栅格契约——一旦有行没有占位，整列数字会出现"有环↔无环"的抖动错位。

执行细则（cell 的 `text-*` + 内部 flex `justify-*` / `items-*` + sort arrow 位置）见 [`frontend-interaction-guardrails.md`](frontend-interaction-guardrails.md) 的 *Column alignment contract* 一节。结构性测试见 `src/components/dashboard/DesktopReserveRow.test.tsx` 的 *"aligns numeric columns ... to the right"* 用例。

---

## 5. 开关与选择控件（Toggle / Segmented / Chips）

### 5.1 分段控制器（Segmented Control）

用于 2–3 个互斥选项（如 APR/APY、USD/Token）。

| 区域     | Tailwind 示例 |
|----------|----------------|
| 容器     | `inline-grid box-border h-[var(--ds-control-h)] gap-0.5 bg-muted/60 rounded-full p-[3px] shadow-inner shadow-black/[0.02]` |
| 选中项   | `h-full min-w-[56px] px-3 rounded-full font-semibold bg-card text-foreground shadow-[0_1px_4px_rgb(var(--ds-shadow-rgb)/0.16),0_1px_2px_rgb(var(--ds-shadow-rgb)/0.10)]` |
| 未选中   | `h-full min-w-[56px] px-3 rounded-full font-medium text-muted-foreground hover:text-foreground` |

**视觉特征**：
- 默认容器高度为 32px（`h-[var(--ds-control-h)]` = `--ds-control-h`: 2rem，`box-border` 固定外框尺寸），用于和桌面场景输入 `h-[var(--ds-control-h)]` 对齐。
- `size="chip"` 容器高度为 28px（`--ds-chip-h`，`box-border` 固定外框尺寸），用于和 `ds-chip` 对齐。
- 横向与纵向都使用等宽 / 等高网格分段，滑块宽高跟随当前分段，避免 USD/Token 这类不同字数选项来回跳。
- 当分段控制器与筛选芯片（§5.2）同行排列时（如 Chain/Hub toggle、APR/APY toggle），使用 `size="chip"`（28px = `--ds-chip-h`）以保持行高一致；仅当与 `h-[var(--ds-control-h)]` 输入框对齐时（如桌面场景条 USD/Token）使用默认 32px。

**形态规则（横向 vs 纵向）**：
- **横向（默认）**：容器与活动段均为 `rounded-full` 药丸形，按钮带 `min-w-[56px]`（chip：`42px`），保证短文案对称。
- **纵向**：容器使用 `rounded-2xl`、活动段使用 `rounded-xl`（与卡片圆角体系一致，§4.1）；按钮 `min-w-0`，宽度由父容器决定。**禁止**纵向沿用 `rounded-full`——长椭圆叠两段椭圆会产生视觉割裂。
- **纵向高度对齐**：必须用 `className="self-stretch"` 让 toggle 与同行右侧主控件等高（如两个 input 行），不要写死 `h-*`。
- **指示器与按钮等圆角**：`indicator` 与按钮共享同一圆角值，确保焦点环、悬停态在视觉上完美贴合。

完整规范与禁止事项见 [`docs/design/segmented-toggle.md`](./segmented-toggle.md)。

### 5.2 筛选芯片（Filter Chips）

用于分类、市场、hub 等筛选维度（如 All / Stables / ETH、Ethereum / Arbitrum、Core / Prime）。**所有筛选芯片统一样式，不区分单多选**。

| 状态   | Tailwind class |
|--------|----------------|
| 选中   | `bg-card text-foreground shadow-sm border border-[rgb(var(--ds-brand-magenta-rgb))]` |
| 未选中 | `bg-card/50 text-muted-foreground border border-border/40 hover:text-foreground hover:bg-card/80` |
| 通用   | `ds-text-11 font-medium transition-colors rounded-md` |

**视觉特征**：
- 选中态：`bg-card` 实色背景 + 品牌色边框 + `shadow-sm`，文字用 `text-foreground`（中性前景色，不是品牌色文字）
- 未选中态：半透明 `bg-card/50` 背景 + 中性 `border-border/40` 边框
- 特殊状态：部分市场芯片（如 Ethereum 含子市场时部分选中）可用虚线边框 `border-dashed border-[brand]` 表示"部分选中"

**代码复用**：同页内多处出现同规格芯片时，提取共享 `chipBase` 类，各实例通过 `cn(chipBase, variantSpecific)` 组合。参考 `DesktopReserveRow.tsx` 的 Market/Hub pill 实现。

### 5.3 ~~多选芯片~~ → 已合并入 5.2

~~多选时可用品牌色边框区分"已选"~~ — 已统一。所有筛选芯片（Token Categories、Markets chain/hub chips、Hub chips、"All" 按钮）使用 §5.2 的统一样式。

### 5.4 图标切换按钮（如主题）

圆形、仅图标：`rounded-full`，用 tooltip 说明状态；hover 使用 `bg-muted/60` → `bg-muted/80`。

### 5.4.1 展开/收起状态图标一致性

当按钮用于控制展开/收起输入或面板时，应保持图标切换的一致性：
- **收起状态**：显示功能相关图标（如 `Search`、`Save`）
- **展开状态**：显示 `X` 图标表示“取消/关闭”
- 选中态样式统一：展开时使用 `bg-muted text-foreground`，与搜索按钮行为保持一致

### 5.5 选中态必须明显

切换/选中状态要有**明确视觉区分**（边框色、背景、描边等），不能只靠轻微透明度或背景变化。

### 5.6 原生勾选框（`<input type="checkbox">`）

用于少量内联选项（Merkl 白名单、激励 Tooltip、场景条等），**不**单独引入 shadcn Checkbox 时，统一使用共享类名常量 `DS_NATIVE_CHECKBOX_CLASS`（`src/lib/dsNativeCheckbox.ts`）：

| 规则 | 说明 |
|------|------|
| 尺寸 | `h-3.5 w-3.5`（14×14px 框体） |
| 形状与边框 | `rounded border border-border bg-background` |
| 与文字行 | `label` 使用 `flex items-start gap-[var(--ds-space-1-5)]`，勾选框加 `mt-0.5` 与首行文字基线对齐（常量已含 `mt-0.5`） |
| 焦点 | `focus-visible:ring-2 focus-visible:ring-ring`（键盘可见焦点） |
| 触控 | 小框可接受；**整段 `label` 可点**，满足可点区域 |

选中态：深色模式下通过全局 CSS 规则 `.dark input[type="checkbox"]:checked { accent-color: hsl(var(--ring)); }` 将勾选填充色设为 `--ring`（金色），保证高对比可见性；亮色模式沿用浏览器默认。**共享场景条（`ScenarioControls`）** 等对表内 Supply/Borrow 语义色不重复：可在常量后追加 `accent-muted-foreground`，与表头/单元格的 emerald、cyan 分工。

### 5.7 本仓库实现参考

| 用途 | 参考文件 |
|------|----------|
| APR/APY 分段 | `AprApyToggle.tsx` → 使用 `SegmentedToggle` |
| Token / Markets / Hub 筛选芯片 | `FilterBar.tsx` |
| Reserves 表内 Market / Hub pill | `DesktopReserveRow.tsx`（同上 §5.2 未选中态规范） |
| USD/Token 等模式分段 | `ScenarioControls.tsx` → 使用 `SegmentedToggle` |
| **可复用分段组件** | **`src/components/ui/segmented-toggle.tsx`** |

#### SegmentedToggle 组件

已提取为统一组件，支持横向/纵向、自定义激活文字颜色等：

```tsx
import { SegmentedToggle } from '@/components/ui/segmented-toggle';

// 横向（默认）
<SegmentedToggle
  options={[
    { value: 'apr', label: 'APR' },
    { value: 'apy', label: 'APY' },
  ]}
  value={currentValue}
  onChange={(val) => setValue(val)}
/>

// 纵向
<SegmentedToggle
  options={[...]}
  value={currentValue}
  onChange={(val) => setValue(val)}
  orientation="vertical"
/>
```

### 5.8 Pill 与可点击性

- **统一规则**：产品内凡是 **pill** 形态，都定义为可点击交互元素。
- **语义要求**：pill 必须使用交互语义（`button`/`a`）、可见 hover/focus、明确点击反馈与可访问名称。
- **只读数据**：禁止使用 pill 视觉；改用普通文本或非-pill标签样式，避免与交互控件冲突。
| 主题图标切换 | `ThemeToggle.tsx` |
| 原生勾选框（Merkl 白名单、场景 net 口径等） | `dsNativeCheckbox.ts` → `IncentiveTooltip.tsx`、`MerklForecastPanel.tsx`、`ScenarioControls.tsx` |

迁移与验收：所有筛选芯片（Token Categories、Markets chain/hub chips、Hub chips）统一使用 §5.2 样式；`ScenarioControls` 的 USD/Token 使用分段控件（非单按钮）；**新增原生勾选框必须复用 `DS_NATIVE_CHECKBOX_CLASS`**。

### 5.9 分隔线（Divider）

用于 chip 行内相邻元素或逻辑分组之间的视觉分隔。统一使用竖向小竖线。

| 场景 | Tailwind class | 说明 |
|------|----------------|------|
| **内联分隔**（chip 内部元素之间）| `w-px h-3.5 bg-current opacity-20 shrink-0` | 颜色跟随父元素 `currentColor`，与 chip 文字同色系 |
| **分组分隔**（展开子项列表与后续组之间）| `w-px h-3.5 bg-current opacity-20 shrink-0` | 与内联分隔同款，保持行内视觉节奏一致 |

**规范要点**：
- 分组分隔仅出现在**展开内容结束、下一组 chip 开始**的位置，不在每个 chip 后都加。
- 高度 `h-3.5`（14px）与 chip 内部分隔线一致，不单独调大或调小。
- 透明度 20% 不可随意增减：过重会与 chip 边框抢视觉权重；过轻则不起分隔作用。
- 若后续新增其他可展开分组（如 Arbitrum 多 market），同样使用此竖线，保持一致。

---

## 6. 光标与 Tooltip 交互

### 6.1 两种 Tooltip 类型

| 类型           | 触发方式     | 光标        | 延迟   | 悬停反馈     |
|----------------|--------------|-------------|--------|--------------|
| 自动展示       | 悬停         | `cursor-auto` | 约 200ms | 轻微（scale/opacity/bg） |
| 点击展示       | 点击/触摸    | `cursor-pointer` | 无   | 明显（ring + 更深背景）   |

- **自动展示**：用 `cursor-auto`，加轻微悬停反馈（如 `hover:opacity-80`、`hover:scale-[1.12]`、`hover:bg-muted/70`），让用户知道可悬停查看。
- **点击展示**：用 `cursor-pointer`，悬停反馈更强（如 `hover:ring-2`、`hover:bg-accent/20`）。
- **禁止**：自动展示的 tooltip 不要用 `cursor-pointer`（会误导为需点击）；不要用 `cursor-help`（不在设计体系内）。

### 6.2 混合模式（移动端点击、桌面端悬停）

```tsx
className="cursor-pointer md:cursor-auto"
// 移动端 onClick 打开；桌面端 onMouseEnter/Leave 控制
```

### 6.3 Tooltip 内容

只展示**补充信息**，不重复父级已展示的内容。

**最后一行摘要数值强制加粗**：当 tooltip / bottom sheet 最后一行包含百分比或比例等摘要数值（如 `% of cap`、`% of total`、利用率值等），统一使用 `font-bold`。此约定已在 CapProgressRing、BorrowCapProgressRing、DeficitLiquidityRing、SupplyCapSheetContent、BorrowCapSheetContent、DeficitSheetContent 等所有同类组件中生效。

**非数值状态描述不在此列**：仅文字描述（如「Below optimal」）无需加粗，使用 `text-muted-foreground` 中性色即可。

#### 6.3.1 多行段落行高

**多行阅读段落使用 `leading-relaxed`，不得沿用单行数据行的默认 `ds-text-*` 行高。**

- `--ds-leading-11: 1.25` 为单行数据行（如 Supply/Borrow Sheet 的 label-value 行）设计。多行阅读段落行距过紧，视觉重量感不足。
- tooltip / bottom sheet 内多行描述段落统一：`ds-text-12 text-muted-foreground leading-relaxed`（行高 1.625，12px 字体 → 19.5px）。
- 例外：极短辅助说明（≤2 行、次要）可使用 `leading-snug`（1.375）。
- 已生效：`AprApyToggle.tsx`、`FrozenStatusBadge.tsx`（FrozenStatusContent）。

**多段说明文**（场景条 Net、类 FDV 信息泡）：与 `DesktopTooltip`/`MobileTooltip` 正文区 rhythm 对齐（`px-4 py-3` 量级、`ds-text-12`、可选顶部分割线）。**Radix 多段密度、壳层 `space-y-*`、参考实现**见 [frontend-interaction-guardrails.md](./frontend-interaction-guardrails.md) § A · Tooltip/Overlay（`AprApyToggle.tsx`、`InkAprCalculator.tsx`）。避免默认 Radix Tooltip 的紧间距堆段。

`InkAprCalculator` 的 `Incentive APR formula` 弹窗内文顺序固定为：**INK 价格行在上，公式块在下**；公式行复用共享 `FormulaBlock` 样式，避免同类说明弹窗出现不同公式容器风格。

### 6.4 Tooltip 定位与视口

- 限制在视口内：使用 `max-h` + 内部 `overflow-y-auto`，避免溢出视口底部。
- 优先使用 flip（空间不足时在上方显示），再考虑裁剪。
- 固定定位的浮层不依赖页面滚动才能使用。

### 6.5 光标速查

| 场景               | 光标 |
|--------------------|------|
| 自动展示 tooltip   | `cursor-auto` |
| 按钮、链接、点击展示 | `cursor-pointer` |
| 禁用且无交互       | `cursor-not-allowed` |
| 禁用但有说明 tooltip | `cursor-auto`（tooltip 仍可用） |
| 可编辑文本         | `cursor-text` |
| 可拖拽             | `cursor-grab` / `cursor-grabbing` |

### 6.6 Tooltip 箭头（callout arrow）规范

**完整规范见 [`tooltip-arrow.md`](./tooltip-arrow.md)**（视觉规范 + SVG 双 path 实现 + Radix `data-side` 自动 flip + 与 `IncentiveTooltip` 自定义箭头的并排对比）。

要点摘录：
- **统一 SVG 双 path 模式**：fill path 闭合（`Z`）+ stroke path 不闭合（不画底边），消除 arrow ↔ body 接合处的"双线 seam"。**禁止**回到 CSS 旋转 div + 边框模拟箭头的做法（先天有 sub-pixel 渲染 artifact）。
- **跟随 Radix flip**：`TooltipContent` 上加 `group/tt`、`TooltipCalloutArrow` 内 4 个方向 SVG 由 `group-data-[side=...]/tt:block` 选中。当 viewport 空间不足触发 collision flip（如 right → left），箭头自动跟随 body 翻到对侧并改变指向，**调用方无需任何改动**。
- **颜色 token**：`fill="hsl(var(--card))"` + `stroke="hsl(var(--border) / 0.6)"`，与 body 完全同色；不允许硬编码颜色。

---

## 7. 悬停与动效

### 7.1 强度层级

| 强度   | 效果示例 | 适用场景           |
|--------|----------|--------------------|
| 轻微   | `hover:opacity-90`, `hover:scale-[1.02]` | 文字链接、被动指示 |
| 轻     | `hover:bg-muted/40`, `hover:scale-105`   | 自动展示 tooltip 触发 |
| 中     | `hover:bg-muted/60`, `hover:scale-110`   | 图标按钮、小控件 |
| 强     | `hover:ring-2`, `hover:bg-accent/25`, `active:scale-95` | 主按钮、点击展示触发 |

### 7.2 时长

| 时长           | 用途           |
|----------------|----------------|
| `duration-100` | 微交互（active） |
| `duration-150` | 悬停、小元素   |
| `duration-200` | 常规交互       |
| `duration-300` | 较大动效、弹层 |

缓动建议：`[0.25, 0.1, 0.25, 1]`。列表入场可 stagger：`delay: 0.2 + i * 0.08`。

### 7.3 尊重减少动效

```tsx
className="transition-all motion-reduce:transition-none"
```

---

## 8. 禁用与加载状态

### 8.1 禁用

- 仅视觉禁用且需说明：`text-muted-foreground cursor-auto` + tooltip。
- 完全不可点击：`opacity-50 cursor-not-allowed pointer-events-none`。

### 8.1.1 分层禁用状态模式（数据表 / 卡片专用，跨场景可迁移最佳实践）

> 当一张带有**语义色**（emerald=Supply、cyan=Borrow、amber=Warning 等）的数据表或卡片面板因外部状态（frozen / paused / disabled）而整体不可操作时，**不要一刀切全部变灰**。正确的做法是**分层处理**——不同元素类型用不同的禁用信号，让用户在「不可操作」的前提下仍然能快速识别数据的原始分类与空间定位。

#### 分层策略

| 元素层 | 处理方式 | 效果 | 原理 |
|--------|----------|------|------|
| **数值（Current 列）** | 保留原语义色 + 整体容器 `opacity-60` | emerald/cyan 色彩可辨，但明显「暗了一档」 | 用户仍需区分「这是 Supply 侧还是 Borrow 侧的数据」；色相保留不干扰空间定位 |
| **文字标签 / 标题** | 保留原语义色（`accentClass`） | emerald/cyan/purple 保持不变 | frozen/paused 行保持完全不透明，标签不褪色 |
| **进度条 / 环形图** | 原色（无 grayscale / opacity 降级） | 颜色和形状完整保留 | 保持进度条可见性，让用户仍能看到容量状态 |
| **After / Delta 列** | 值设为 null → 显示 `-` | 不展示任何模拟结果 | 禁用状态下没有「after」变化，显示模拟值会误导用户以为操作仍在生效 |
| **背景行** | `bg-card` 不透明底 + `background-image` tint 叠加 | 整行有淡琥珀/淡天蓝底色，完全不透明 | `ds-bg-paused` / `ds-bg-sky-500-8` 使用 `background-image: linear-gradient(...)` 不覆盖 `bg-card` 底色 |

#### 为什么不用一刀切 `opacity-50` 全灰？

| 一刀切做法 | 问题 |
|---|---|
| 整个容器 `opacity-50` | Supply/Borrow 两列都是灰色的，用户分不清 emerald 和 cyan 区域，扫读时失去空间锚点 |
| 所有文字 + 数值统一 `text-muted-foreground` | 数值的颜色是数据分类信号（绿色=流入、青色=流出），全部去色后用户需要重新逐字阅读才能区分 |
| 进度条保留原色 | 禁用状态下 cap 已无关，鲜艳的进度条会与「不可操作」的状态信号冲突 |

#### 分层禁用的信号层级

用户一眼扫过时，按优先级接收以下信号：

1. **底色**（amber/sky 淡底）→ 「这个资产被 paused/frozen 了」
2. **整体 opacity-60** → 「这张表当前不可操作」
3. **数值颜色保留** → 「这是 Supply 侧（绿色）的数据」
4. **文字变灰** → 「这些标签暂时不适用」
5. **After/Δ 为 `-`** → 「没有模拟结果，因为被锁定了」

#### Tailwind 实现参考

```tsx
// 容器级：整体降透明度
<tbody className={isDisabled ? 'opacity-60' : ''}>

// 文字标签：group-data 驱动去色
<span className={cn(
  'ds-text-emerald-600',                              // 正常状态
  'group-data-[disabled]:text-muted-foreground'       // 禁用时去色
)}>
  Supplied
</span>

// 数值：保留原色不变（依赖容器 opacity 减弱）
<span className="ds-text-emerald-600 tabular-nums">
  {formatUsd(currentValue)}
</span>

// 进度条：灰度化
<div className={cn(
  'rounded-full bg-muted/40 overflow-hidden',
  'group-data-[disabled]:grayscale-[50%]',
  'group-data-[disabled]:opacity-50'
)}>

// After/Delta：disabled 时 mask 为 null
const after = disabled ? null : simulation.after;
```

#### 适用场景

- 金融/DeFi 数据表中因协议状态（frozen/paused/disabled）而不可操作的行
- 任何带有语义色分类的多列数据面板（如 Supply/Borrow、收入/支出、流入/流出）
- 仪表盘中因权限或状态而只读的卡片区域

#### 不适用的场景

- 简单的按钮/控件禁用 → 用 §8.1 的 `opacity-50 cursor-not-allowed` 即可
- 整页只读模式 → 此时不需要区分语义色，统一中性色更合适
- 单值指标卡 → 没有「分类色相」需要保留，直接降透明度即可

#### 本仓库实现参考

`SimulationSubRow.tsx` 的 `renderRow` 函数 + 容器级 `opacity-60` 是此模式的完整落地。`DesktopReserveRow.tsx` 的主数据行也遵循相同逻辑（背景底色保留，行内数值不受影响）。

### 8.2 加载

- 骨架屏：`animate-pulse bg-muted rounded`，与最终布局一致。
- 进度：不确定用 spinner，确定进度用 progress bar/ring；紧凑处用 progress ring。

---

## 9. 移动端与触控

- **触控目标**：最小 44×44px（包括可点击的“Simulation ⌄”等）。
- **浮层**：移动端详情类内容用**底部抽屉（bottom sheet）**：全宽、`rounded-t-2xl`、固定标题+关闭、内容区 `max-h-[80vh] overflow-y-auto`，背景 `fixed inset-0 z-30 bg-background/40` 点击关闭。间距全面紧凑：标题栏 `px-[var(--ds-space-2)] py-[var(--ds-space-1-5)]`，内容区 `px-[var(--ds-space-3)] pt-[var(--ds-space-2)] pb-[var(--ds-space-2)]`，内部行间距统一 `space-y-1`（移动端弹窗遮挡底层内容多，收紧垂直空间最大化可见表格区域）。动画使用 Framer Motion `AnimatePresence`：背景 opacity 0→1，面板 y: 100%→0、duration 0.28s。MobileReserveCard 的 cap/deficit/utilization/frozen 抽屉内联在组件内（`MobileCapSheet`），其他场景可用共享组件 `src/components/dashboard/BottomSheet.tsx`。不在移动端用小浮层 popover 锚定在触发点上。
- **轮播**：移动端轮播需包含：分页点、左右箭头（在可滚动时显示）、peek（如 `basis-[85%]`）、`align: "center"` + `containScroll: "trimSnaps"`。
- **避免**：仅在 hover 上做交互，移动端需提供 tap/click 等价操作。

### 9.1 Slider + 数值 Tooltip（移动端）

当 Slider 的 thumb 在拖动时会放大（如 `scale-[1.4]`）且上方有**数值 Tooltip** 时：

- **避免重叠**：Tooltip 与放大后的 thumb 之间必须留出明显空隙。按状态区分 Tooltip 的垂直偏移：
  - **拖动中**：使用更大上偏移（如 `-top-10` / 40px），确保与 thumb 的 ring/shadow 不贴。
  - **非拖动**：略小上偏移（如 `-top-8` / 32px），既不贴 thumb 也不离得过远。
- **层级**：Tooltip 使用更高 z-index（如 `z-20`），避免被 thumb 的 ring 或阴影盖住，造成“像重叠”的观感。
- **实现**：用同一 class 根据 `isDragging` 切换 `-top-10` / `-top-8`，并加 `transition-[top] duration-150` 使切换自然。

### 9.2 Slider 与下方区块间距

Slider 与紧挨其下的区块（如「Reference FDVs」、说明文字）可适当收紧间距，使视觉更紧凑：

- 在**不缩小触控热区、不损害可点击性**的前提下，将下方区块的 `margin-top` 从 4px 减至 2px（如 `--ds-space-1` → `--ds-space-0-5`），必要时可设为 0。
- 验收：间距更小但不显拥挤，下方区块仍易点、可访问性不受影响。

### 9.3 行内下拉菜单的视口边界约束（移动端 chip + dropdown 模式）

当移动端使用**水平排列的 chip 触发器 + 绝对定位下拉菜单**模式时（如排序栏、筛选栏），必须防止菜单溢出视口左右边缘。**禁止**用外层容器的 `overflow-hidden` 裁剪——这会同时裁剪掉绝对定位的下拉菜单使其不可见。

#### 三层防护体系

| 层 | 机制 | 作用 | 实现方式 |
|---|------|------|---------|
| **① 方向对齐** | 按 chip 在行中的位置选择展开方向 | 左侧 chip 向右展开不溢左边界；右侧 chip 向左展开不溢右边界 | `align` prop：`'start'` → `left-0`，`'end'` → `right-0` |
| **② 宽度约束** | viewport-aware max-width | 即使方向正确，超宽内容也不超出视口 | `max-w-[min(18rem,calc(100vw-1.5rem))]` |
| **③ 不裁剪祖先** | 每个 chip 容器显式 `overflow-visible` | 确保绝对定位菜单不被任何父级意外截断 | `<div className="relative overflow-visible">` |

#### 对齐策略

```
行内 chip 排列（LTR 布局）:

  [Size]  [Util]  [Supply]  [Borrow]  [Extra]
   ↓left    ↓left     ↓left      ↓right    ↓right
  (→向右) (→向右)  (→向右)    (←向左)   (←向左)
```

- **左侧芯片**（前半段，如 Size / Util / Supply）：默认 `left-0`，菜单向右展开。LTR 布局下右侧空间通常更充裕。
- **右侧芯片**（后半段，如 Borrow / Extra）：使用 `right-0`，菜单向左展开。避免向右溢出视口。
- **分界点**：通常取中点或按实际芯片数量分配。本项目 5 个 chip 时，前 3 个 `start`、后 2 个 `end`。
- **居中容器**：若外层 flex 使用 `justify-center`，两侧空间大致对称，上述策略效果最优。

#### 反模式

| 错误做法 | 后果 |
|----------|------|
| 外层容器加 `overflow-x-hidden` | 下拉菜单被裁剪不可见 |
| 所有菜单统一 `right-0` | 最左侧芯片菜单向左溢出视口 |
| 所有菜单统一 `left-0` | 最右侧芯片菜单向右溢出视口 |
| 不设 `max-w` 约束 | 长选项文本可能超出视口 |
| chip 容器未设 `overflow-visible` | 被更高层级的 `overflow` 意外截断 |

#### 测试策略

jsdom 单测无法测量真实布局，但可**结构性锁定**三层防护的不变量：
- 断言 chip 容器包含 `overflow-visible`
- 断言渲染特定菜单时出现 `absolute left-0`（左侧 chip）或 `absolute right-0`（右侧 chip）
- 断言所有菜单 div 包含 viewport-aware `max-w`
- 像素级回归需 Playwright e2e 在目标视口宽度截图或 `getBoundingClientRect` 验证

---

## 10. 无障碍与键盘

- 所有可交互元素有**可见焦点**：`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`。
- 状态不只用颜色表达，配合图标、文字或图案。
- 触控目标 ≥ 44px；悬停态有对应的焦点态以便键盘用户感知。
- Tooltip 可通过键盘焦点触发。

---

## 11. 暗色模式

- 所有悬停/边框在浅色和暗色下都需测试。
- 禁用态对比度足够。
- 必要时按主题调整透明度：`hover:bg-muted/60 dark:hover:bg-muted/40`。

---

## 12. 设计习惯速查

- **Tooltip**：不重复父级已有信息；自动展示用 `cursor-auto` + 轻微悬停反馈，点击展示用 `cursor-pointer` + 强反馈。
- **Toggle/选中态**：变化要明显，用边框色或明确背景，不只靠透明度。
- **语义色**：琥珀=警告、红=错误、绿=成功/正常，不用于普通数据。
- **多列**：等宽、统一内边距；表格留足 padding，文字不贴边。
- **对称**：成对区块（如 Supply / Borrow）在位置与权重上对称。
- **几何**：若需求给出具体尺寸/间距，按给定实现（如用 `getBoundingClientRect()` 计算），不随意近似。
- **轮廓与圆角拼接**：用 SVG 绘制 1px 边框以衔接 CSS 边框时，坐标必须对齐到半像素（如 `0.5`）以避免抗锯齿模糊或变粗；若需修改局部轮廓（如内侧反向圆角），优先使用 `clip-path` 局部切断底层原生边框，并使用单个包含精确几何指令（如 `A` 画圆弧）的 SVG `path` 一次性绘制连续轮廓，严禁使用“原边框 + 补丁层 + mask 遮罩”的多层叠加拼凑做法。
- **圆角卡片 + 全宽不透明子层**：子元素（尤其 `position: sticky` + `bg-card`）会按绘制顺序盖住父元素圆角处的 **`border`**，顶角看起来像断线。优先用 **`rounded-2xl` 外层 `p-px bg-border/60` + 内层 `rounded-[calc(1rem-1px)] bg-card`** 的 1px 沟槽描边；**不要**为此对含视口 sticky 的卡片使用 `overflow: hidden`（会改变 sticky 参照）。桌面 `ReservesTable` 卡片即此模式。

### 12.1 文档归位规则

- `DESIGN-SYSTEM-REFERENCE.md`：跨项目可迁移的主文档。
- `DESIGN.md`：本项目视觉画像和默认值，不是通用规则库。
- `frontend-interaction-guardrails.md`：本项目产品行为守则，不对外迁移。

### 12.2 迁移原则

- 能跨项目复用的规则，优先留在本文档。
- 只对本项目行为敏感的规则，放到 `frontend-interaction-guardrails.md`。
- 只描述本项目视觉气质和默认值的内容，放到 `DESIGN.md`。

### 12.3 复制前替换项

- 替换品牌色、语义色、字体族和 spacing token。
- 替换组件示例中的项目名、业务名和数据列名称。
- 保留通用结构、保留 Do/Don't、保留响应式和无障碍原则。

---

## 附录 A：本仓库项目特定规范（AaveAPY）

以下为与本仓库业务强相关的规范，复用到其他项目时可忽略或按需裁剪。

- **前端交互守则**：本目录下 `frontend-interaction-guardrails.md`（API 新鲜度、Forecast UI、Reserves 表、InkAprCalculator 等）。
- **数据加载**：`../frontend-data-loading-matrix.md`（prefetch、staleTime、缓存分层）。
- **DESIGN.md**：本目录下，本项目视觉主题、品牌色、组件类名（如 `ds-input-surface`、`glass-card`）的具体约定；**文本输入空态/有值与底色规则**见 **§4.1**（实现：`@/lib/dsInputSurface` 的 `cnDsInputSurface` / `cnDsInputNeutralWell`）。

---

## 附录 B：移动端储备卡 ASCII 示意（单一来源）

**完整版**（含 Current / Proposed、图例与说明）见同目录 **[mobile-reserve-card-ascii-layout.md](mobile-reserve-card-ascii-layout.md)**。请勿在本文件中重复粘贴大段 ASCII，避免双份维护。

---

## 文档来源与维护

本参考的主体内容来自 `docs/design/` 下既有规范与实现约定。

独立维护、与业务强相关的文档：

- `DESIGN.md` — 本项目视觉主题、品牌色、组件类名（如 `ds-input-surface`）
- `frontend-interaction-guardrails.md` — Forecast、Reserves、Merkl 等 AaveAPY 专项守则
- `mobile-reserve-card-ascii-layout.md` — 移动端储备卡 ASCII 详细示意

仓库根 `AGENTS.md` 中与设计相关的条目应与上述文档一致。

**约定**：一次性设计方案可删原文档，将可复用部分抽象进本文档（通用）或附录 A（项目特定）。后续新增通用设计习惯请更新本文档。
