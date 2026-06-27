# 对齐 Portfolio Toggle 的位置（保留 panel header 同层结构）

## 目标
切换 Single ⇄ Portfolio 时 `PortfolioModeToggle` 的右边缘 X 坐标完全一致（≤1px 浮动）；toggle 仍渲染在 `PortfolioPanel` header 内部，与图标按钮 cluster 同一行同一层；PortfolioPanel 整体外观/布局不变。

## 现状（为什么需要改）

两种模式 toggle 都落在 `ReservesTable` 的 scenario 包装器内（`p-[var(--ds-space-3)]`，12px padding）：

- **Single**：`<div className="flex items-center gap-2"> <ScenarioControls /> <div className="ml-auto shrink-0"><PortfolioModeToggle /></div> </div>` → toggle 右边缘 = 包装器内边缘 = 卡片外边缘 − 12px。
- **Portfolio**：`<PortfolioPanel>` 根 `<div className="space-y-3">` 无 padding，header 内层 `<div className="px-4 py-3">`（16px），右侧 cluster 用 `pr-[11px] -mr-[27px]`（净 −16px）硬补偿 `px-4`。理论上 toggle 右边缘也应等于卡片外边缘 − 12px。

实际仍有偏移，因为：
1. `-mr-[27px] pr-[11px]` 把整个 cluster（Wallet/Save/Search/Trash + Toggle）一起外推 16px，让所有图标按钮都越过了 header 的 `px-4` 自然边界，靠 trash/save 等图标自身的内 padding 才"看起来"差不多对齐 —— 实际 toggle 的 Switch 控件比图标按钮窄、右侧无 padding，所以右边缘比 Single 模式更往里 1–3px。
2. 这组负 margin 是为旧布局凑出来的魔法值，没有跟随 `--ds-space-3` 这个 token，token 一旦变（如改成 14px）就漂。

## 方案：去掉 cluster 整体外推，让 toggle 单独对齐到 12px 内边距

让 PortfolioPanel header 的右内边距与 scenario 包装器一致（12px），这样 toggle 的右边缘自然落在与 Single 模式相同的 X，不再依赖魔法值。

### 改动点（一处文件）

`src/components/dashboard/PortfolioPanel.tsx` 的 header 区域（当前 line 371–467）：

1. 外层 header 容器把右内边距从 `px-4` 改成左右非对称：`pl-4 pr-[var(--ds-space-3)]`（移动端同理：`pl-2.5 pr-[var(--ds-space-3)]`）。
   - 左侧 16px 保留标题（Layers icon + "Portfolio" + italic 提示）的呼吸空间不变。
   - 右侧降到 12px，与 scenario 包装器的内边距对齐。
2. 删除右侧 cluster 的 `pr-[11px] -mr-[27px]` 硬补偿，改回 `className="flex items-center gap-[var(--ds-space-1)]"`。
3. Toggle 仍作为 cluster 的最后一个子节点渲染在 header 内（保持 `simulationMode` / `onSimulationModeChange` 走 panel 内部）—— 不动 toggle 自身的 props 和 DOM 位置。

### 数学验证

```text
Single:    toggle.right = wrapper.right − 12px (scenario p-3 右内边距)
Portfolio: toggle.right = panel.right − 0  (cluster 无补偿)
                       = header.right − 0
                       = wrapper.right − 12px (新的 pr-[var(--ds-space-3)])
=> 完全相等
```

### 副作用与处理

- Wallet/Save/Search/Trash 四个图标按钮也会跟随 cluster 一起回退到 12px 内边距（不再外推 4px）。视觉上这些图标会向左挪约 4px —— 这是合理的：原先 cluster 外推到 panel root 是为了对齐 toggle，现在 toggle 自然对齐了，图标也回到正常的 padding 区内，反而和 PortfolioPanel 下方的 token rows 对齐更整齐。
- Snapshots 区域（line 468+）、token rows、summary 都不在 header 内，零影响。
- 移动端：`px-2.5` 拆成 `pl-2.5 pr-[var(--ds-space-3)]` 同理对齐；移动 scenario 包装器同样用 `var(--ds-space-3)` padding（line 940-953 mobile 分支无 p-3，需在改动时再确认是否也需要做相同处理）。
- ADR-0013（portfolio 模式禁用 desktop sticky）不受影响：toggle 高度变化为 0。

## 不做的事

- 不动 `ReservesTable.tsx`（toggle 渲染位置不变，仍由 `PortfolioPanel` 内部根据 `simulationMode` 渲染）。
- 不动 `PortfolioModeToggle` 自身样式与 props。
- 不改 ScenarioControls 或 Single 模式分支（887–905 / 857–865）。
- 不改 scenario 包装器（line 1046–1055）的 padding。

## 验证

1. `npm run lint && npm test && npm run build && npx tsc --noEmit`
2. 浏览器在桌面 1280 / 1440 与移动 390 三种宽度下：
   - 截图 Single 模式 toggle 的右边缘像素坐标。
   - 切到 Portfolio 模式，截图 toggle 右边缘像素坐标。
   - 两者差值 ≤ 1px。
3. 同时观察 Wallet/Save/Search/Trash 四个图标按钮没有溢出 panel 边界、与 token rows 视觉对齐。
4. `src/test/header-controls.test.ts` 和 `PortfolioPanel.layout.test.tsx` 应继续通过；若有断言魔法值 `-mr-[27px]` 的测试，更新断言。

## 备选方案（更轻量，但不彻底）

如果觉得整列图标按钮一起左移视觉上接受不了，可以只调 toggle 一个：保留 cluster 的 `pr-[11px] -mr-[27px]`，在 toggle 外再单独包一层 `<div className="-mr-[5px]">`（或精确测出的 px 数）让 toggle 的 Switch 控件右边缘对齐到 12px。代价是又多一个魔法值；不推荐，除非有视觉上必须的理由。

## 确认点

请确认主方案（让整组右侧图标按钮回归 12px 内边距，toggle 自然对齐）符合你说的"整个 portfolio 层跟现在的格局都一致" —— 严格说图标按钮位置会有约 4px 左移；如果要求图标按钮也"完全不动"，那就只能走备选方案，再叠一层 toggle 专属的负 margin。
