
# 移动端滑动条调整：缩小 Thumb 基础尺寸 + 拉近 Reference FDVs

## 问题确认

1. **移动端 thumb 太大**：当前是 `w-5 h-5`（20px），比桌面端 `w-4 h-4`（16px）大 25%
2. **间距过大**：滑动条与 Reference FDVs 之间的 `mt-[var(--ds-space-2)]` 太宽

## 修改方案

### 修改 1：统一 Thumb 基础尺寸

将移动端 thumb 从 `w-5 h-5` 改为 `w-4 h-4`，与桌面端保持一致。

**文件**: `src/components/dashboard/InkAprCalculator.tsx`
**位置**: 第 758-763 行

```tsx
// 修改前
<div
  className={`w-5 h-5 rounded-full border-2 border-white shadow-md pointer-events-none transition-all duration-150 ${
    isDragging ? 'scale-[1.4] shadow-lg ring-2 ring-white/30' : ''
  }`}
  style={{ background: positionToThumbColor(sliderPosition) }}
/>

// 修改后
<div
  className={`w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none transition-all duration-150 ${
    isDragging ? 'scale-[1.4] shadow-lg ring-2 ring-white/30' : ''
  }`}
  style={{ background: positionToThumbColor(sliderPosition) }}
/>
```

### 修改 2：缩小 Tooltip 距离

Thumb 缩小后，tooltip 可以适当拉近：

```tsx
// 修改前
className="absolute -top-7 -translate-x-1/2 ..."

// 修改后
className="absolute -top-6 -translate-x-1/2 ..."
```

### 修改 3：拉近 Reference FDVs 间距

将 Collapsible 的顶部间距从 `mt-[var(--ds-space-2)]` 改为 `mt-[var(--ds-space-1-5)]`：

**位置**: 第 781 行

```tsx
// 修改前
<Collapsible open={isReferenceOpen} onOpenChange={setIsReferenceOpen} className="mt-[var(--ds-space-2)] -mb-1">

// 修改后
<Collapsible open={isReferenceOpen} onOpenChange={setIsReferenceOpen} className="mt-[var(--ds-space-1)] -mb-1">
```

## 修改后效果

| 属性 | 修改前 | 修改后 |
|------|--------|--------|
| 移动端 thumb 基础尺寸 | 20px | 16px（与桌面一致）|
| 拖动放大后尺寸 | 28px | 22.4px |
| Tooltip 位置 | -top-7 (28px) | -top-6 (24px) |
| Reference FDVs 间距 | 8px | 4px |

## 技术说明

- 44px 触控热区（`w-11 h-11`）保持不变，仍然满足 WCAG 触控目标要求
- 只是视觉上的 thumb 变小，不影响触控操作的容错范围
