# Header Controls — 设计 Token 用法

Header 区域所有交互控件（FAQ 链接、Wallet 按钮、时钟 popover、watch-address 输入、ThemeToggle…）共用一套 token，定义在 `src/lib/headerControlStyles.ts`。

> 改尺寸/字号/hover/focus，只改这一个文件即可。组件不允许再写局部的 `w-7`、`text-[11px]`、`px-2 py-1`、`ring-1` 等硬编码。

## 1. Token → 像素映射

| Token | CSS 变量 | 移动端 | 桌面端 | 用途 |
|---|---|---|---|---|
| `HEADER_CONTROL_MOBILE_CLASS` | `--ds-control-h` | **32px** 圆形 | — | 移动端 FAQ / 时钟 / Wallet / 单图标按钮 |
| `HEADER_CONTROL_DESKTOP_CLASS` | `--ds-space-2` / `--ds-space-1` / `--ds-text-14` | — | 高 ≈ 28px，pad 8/4，字号 **14px** | 桌面端 Connect / View address / FAQ 等次级状态 |
| `HEADER_CONTROL_DESKTOP_ACTIVE_CLASS` | 同上 | — | 同上 | 桌面端已连接钱包等"激活"态（前景色） |
| `HEADER_CONTROL_ICON_CLASS` | — | **16px** (`w-4 h-4`) | **16px** | 主图标（Wallet / HelpCircle / Eye…） |
| `HEADER_CONTROL_AFFORDANCE_ICON_CLASS` | — | **14px** (`w-3.5 h-3.5`) | **14px** | 次级/装饰图标（Chevron / 时钟 / popover 列表项） |
| `HEADER_CONTROL_INNER_GAP_CLASS` | `--ds-space-1` | **4px** | **4px** | 控件内部 图标↔文字 间距 |
| `HEADER_CONTROL_GROUP_GAP_CLASS` | `--ds-space-1` | — | **4px** | 同组兄弟控件水平间距（如 Connect + View address） |
| `HEADER_CONTROL_POPOVER_ITEM_CLASS` | `--ds-space-2` / `--ds-space-1-5` / `--ds-text-11` | 11px 字号 | 11px 字号 | Popover 内列表行（Switch / Disconnect） |
| `HEADER_CONTROL_FOCUS_RING_CLASS` | `--ring` | `ring-2 ring-ring ring-offset-2 ring-offset-background` | 同上 | 全部 header 控件统一 focus-visible |

CSS 变量定义在 `src/index.css`：

```
--ds-control-h:  2rem;     /* 32px */
--ds-space-1:    0.25rem;  /*  4px */
--ds-space-1-5:  0.375rem; /*  6px */
--ds-space-2:    0.5rem;   /*  8px */
--ds-text-11:    11px;
--ds-text-14:    14px;
```

## 2. 使用示例

### 移动端图标按钮（FAQ / 时钟 / Wallet）

```tsx
import { HEADER_CONTROL_MOBILE_CLASS, HEADER_CONTROL_ICON_CLASS } from '@/lib/headerControlStyles'

<a href="#faq" className={HEADER_CONTROL_MOBILE_CLASS} aria-label="FAQ">
  <HelpCircle className={HEADER_CONTROL_ICON_CLASS} />
</a>
```

### 桌面端文字按钮（Connect / View address / FAQ）

```tsx
import { HEADER_CONTROL_DESKTOP_CLASS, HEADER_CONTROL_ICON_CLASS } from '@/lib/headerControlStyles'

<button className={HEADER_CONTROL_DESKTOP_CLASS}>
  <Wallet className={HEADER_CONTROL_ICON_CLASS} aria-hidden />
  <span>Connect</span>
</button>
```

### Popover 列表行（Switch to watch mode / Disconnect）

```tsx
<button className={cn(HEADER_CONTROL_POPOVER_ITEM_CLASS, 'text-destructive')}>
  <X className={HEADER_CONTROL_AFFORDANCE_ICON_CLASS} />
  Disconnect
</button>
```

## 3. 约束

1. **不要**在 Header / WalletButton / WatchAddressInput 中写硬编码尺寸（`w-7`、`h-7`、`text-[11px]`、`px-2 py-1`、`ring-1`）。架构守卫测试 `src/test/header-controls.test.ts` 会阻止此类回归。
2. **不要**自定义 focus ring。统一使用 `HEADER_CONTROL_FOCUS_RING_CLASS`，否则点击/Tab 聚焦时会出现亮圈样式不一致。
3. 新增 Header 控件时，先确认能否套用现有 token；如确需新尺寸，**先**扩展 token 文件再用。

## 4. 相关文件

| 文件 | 角色 |
|---|---|
| `src/lib/headerControlStyles.ts` | Token 定义（单一来源） |
| `src/components/dashboard/Header.tsx` | 消费者：FAQ 链接、时钟 popover |
| `src/components/dashboard/WalletButton.tsx` | 消费者：Connect / View address / 已连接态 + popover |
| `src/components/dashboard/WatchAddressInput.tsx` | 消费者：watch 地址输入框、Confirm / Cancel 圆按钮 |
| `src/test/header-controls.test.ts` | 视觉回归 / 一致性守卫 |
