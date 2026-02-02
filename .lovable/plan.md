
## 目标
- 移动端拖动时（thumb 1.4x 放大）与“弹窗数字 tooltip”不再重叠，留出明显间距。
- 移动端滑动条区域与下方 Reference FDVs 再靠近一点（不影响可点击性/可访问性）。

---

## 现状定位（已确认代码）
在 `src/components/dashboard/InkAprCalculator.tsx` 的 CompactLayout（非 XL 布局）：
- Thumb 视觉尺寸：`w-4 h-4`，拖动时 `scale-[1.4]`（≈ 22.4px）
- Tooltip 目前是固定 `-top-6`（24px）：
  ```tsx
  className="absolute -top-6 -translate-x-1/2 ... "
  ```
这会让 tooltip 底部非常接近放大后的 thumb（尤其加上 ring/shadow 视觉上会更“挤”），所以你看到“重叠程度很大”。

---

## 修改方案（核心思路）
### 1) Tooltip 垂直位置改成“拖动时更高、非拖动时稍低”
目的：保证放大期间一定不重叠，同时不拖动时 tooltip 不要离得太远。

- 非拖动（仅 showTooltip）：用 `-top-8`（32px）
- 拖动中（isDragging）：用 `-top-10`（40px）
- 同时给 tooltip 加 `z-20`，避免层级被 thumb 的阴影/环压住造成“像重叠”的观感

实现方式：把 tooltip 的 `className` 从固定字符串改为根据 `isDragging` 条件拼接（沿用你项目里已有的字符串拼接风格即可）。

**修改点（CompactLayout tooltip）**
文件：`src/components/dashboard/InkAprCalculator.tsx`  
位置：你 diff 里 tooltip 那段（大约 766-776）

把：
```tsx
className="absolute -top-6 -translate-x-1/2 ..."
```
改成类似：
```tsx
className={`absolute ${isDragging ? '-top-10' : '-top-8'} -translate-x-1/2 ... z-20`}
```

> 这样拖动时会明显上移，确保和放大的 thumb 拉开距离；不拖动时也会比现在更高一点，避免轻微贴边。

---

### 2) Reference FDVs 再靠近 slider 一点
目前已经从 `mt-[var(--ds-space-2)]` 缩到 `mt-[var(--ds-space-1)]`（4px）。如果你还觉得“有点远”，下一步建议：
- 改为 `mt-[var(--ds-space-0-5)]`（2px）  
或如果你想更极致：
- 改为 `mt-0`

**修改点（Collapsible 外层）**
文件：`src/components/dashboard/InkAprCalculator.tsx`  
位置：`<Collapsible ... className="mt-[var(--ds-space-1)] -mb-1">`

将 `mt-[var(--ds-space-1)]` 改为 `mt-[var(--ds-space-0-5)]`（优先）  
若你仍嫌远，再进一步改为 `mt-0`。

---

## 验收方式（你可按这个顺序快速确认）
1. 用手机（或 390px 宽）拖动 slider：
   - 观察 thumb 放大后，tooltip 底部与 thumb（含 ring）之间是否始终留有明显空隙。
2. 松手后 tooltip 仍显示一小段时间（800ms）：
   - 确认此时（非拖动）tooltip 位置不会显得过高，同时也不贴着 thumb。
3. 看 slider 到 “Reference FDVs” 的距离：
   - 确认更紧凑但不显拥挤，Reference 区域可点击仍正常。

---

## 影响范围与风险
- 仅影响非 XL（移动/平板）布局的 slider tooltip 与 Reference 区块间距。
- 不改变触控热区（`w-11 h-11`）与拖动逻辑，仅做视觉布局调整。
- 如果你的卡片顶部空间极小，tooltip 上移可能更接近标题区域；但因为 tooltip 是 overlay（absolute）且不占布局高度，一般不会造成挤压，只是“浮层”位置更靠上。
