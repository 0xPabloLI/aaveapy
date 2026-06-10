# Align Portfolio Toggle Across Modes

## 问题
当前 `Portfolio` 开关在两种模式下的水平位置不一致：

- **Single 模式**：开关位于 `ReservesTable` 的 scenario 行（外层 `flex items-center gap-2`），`ml-auto shrink-0`，紧贴 scenario 容器最右边缘。
- **Portfolio 模式**：开关被搬进 `PortfolioPanel` 的 header 内部，与一组图标按钮（同步、保存、搜索、清空）放在同一个 cluster 中。该 cluster 用 `pr-[11px] -mr-[27px]` 做了硬补偿，header 又有自己的 `px-4 py-3`，导致开关相对页面/卡片右边缘比 Single 模式的位置**整体向左偏移**几像素，切换模式时视觉上会"跳一下"。

目标：两种模式下 Portfolio 开关的右边缘 X 坐标完全一致，切换无位移。

## 方案：把开关提到 PortfolioPanel 外层、与 Single 模式共用同一插槽

让 `ReservesTable` 的 scenario 行始终是同一个 flex 容器：

```text
[ 左侧内容 ............................................ ] [ Portfolio 开关 ]
  Single  : ScenarioControls (flex-1)                      PortfolioModeToggle
  Portfolio: PortfolioPanel (flex-1，去掉自带开关 + 负 margin) PortfolioModeToggle
```

这样开关在两种模式下都是同一棵 DOM 节点的同一个位置，X 坐标天然一致。

### 改动点

1. `src/components/dashboard/ReservesTable.tsx`
   - 在桌面与移动两段渲染中，**移除 `!isPortfolioMode` 分支差异**对 toggle 的影响：始终渲染外层 `flex items-center gap-2` + 末尾 `PortfolioModeToggle`。
   - 左侧 slot 根据模式渲染 `ScenarioControls` 或 `PortfolioPanel`。
   - 向 `PortfolioPanel` 传入 `simulationMode={undefined}` / 不传 `onSimulationModeChange`，让它不再渲染自己那个 toggle。

2. `src/components/dashboard/PortfolioPanel.tsx`
   - header 右侧 cluster 去掉 `pr-[11px] -mr-[27px]` 这组硬补偿（这组 hack 原本是为了让内嵌的 toggle 对齐外层；现在 toggle 移走，hack 同步移除，避免图标按钮再向右溢出）。
   - 保留同步/保存/搜索/清空四个图标按钮的相对排布，整体右内边距回到 header 的 `px-4`（移动端 `px-2.5`），与卡片其它内容一致。
   - `PortfolioModeToggle` 引入与渲染分支删除（props 仍保留以兼容现有调用方／测试，但 panel 内部不再使用）。

3. 移动端
   - 同样把 toggle 提到外层。Single 模式的 `flex items-center gap-2` 已经存在；Portfolio 模式新增一个一行 flex 容器，把 `PortfolioPanel` 放左、toggle 放右，间距用 `gap-2` 与 Single 模式一致。
   - 移动端 toggle 在 `PortfolioModeToggle` 内部已有 `flex-col` 紧凑样式，无需改动。

### 验证

- 桌面 1280 与 1440 宽度：切换 Single ⇄ Portfolio，截图对比 `PortfolioModeToggle` 右边缘 X 坐标一致（≤1px 浮动）。
- 移动 390 宽度：同样对比，开关不与卡片边缘重叠。
- `npm run lint && npm test && npm run build && npx tsc --noEmit`
- 已有相关测试：`ReservesTable.test.tsx`、`src/test/header-controls.test.ts` 必须仍通过；如果有断言 toggle 在 PortfolioPanel 内的测试，调整为断言 toggle 在 scenario 行内。

### 不做的事

- 不动 PortfolioPanel 的其它布局（搜索框、suggested chips、summary）。
- 不改 `PortfolioModeToggle` 自身样式。
- 不改 sticky / pin-scroll 逻辑（ADR-0013 不受影响：toggle 高度可忽略，仍由 `useReservesLayoutRefs` 测量）。

## 确认点

切换模式时 toggle 应**完全不动**——这是验收标准。请确认这是你想要的"在同一位置"的含义；如果你的意思是别的（例如让 Portfolio 模式里 toggle 仍嵌在 panel header 内、只是把整个 panel 的右内边距改成与 ScenarioControls 一致），我可以改成更轻量的方案：仅删除 `-mr-[27px]/pr-[11px]` 那组负 margin，让 toggle 自然落在 `px-4` 内边缘。
