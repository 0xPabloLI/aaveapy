# AAV-344 前端：Reserve Snapshots 历史趋势展示

## 1. 目标
为用户提供 reserve 历史指标的可视化趋势，帮助判断 APY/利用率/价格变化走势。

## 2. 数据层

### 2.1 Hook：`useReserveSnapshots`

文件：`src/hooks/useReserveSnapshots.ts`

```typescript
interface UseReserveSnapshotsParams {
  reserveId?: string;
  marketName?: string;
  from: string;           // ISO
  to: string;             // ISO
  limit?: number;
}

interface UseReserveSnapshotsReturn {
  data: ReserveSnapshotsResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}
```

- **API 调用**：`fetch(\`${API_BASE}/markets/history?reserveId=...\`)`（`API_BASE` 来自 `src/lib/apiBase.ts`）
- **react-query key**：`['reserve-snapshots', reserveId, marketName, from, to, limit]`（参数化，reserveId 变化自动重新请求）
- **staleTime**：`queryStaleTimes.reserveSnapshots = 5 * 60 * 1000`（新增到 `src/config/queryStaleTimes.ts`）
- **模式对齐**：`useAaveMarkets`（`useQuery` + `safeParse` Zod schema）
- 返回数据经 `ReserveSnapshotsResponseSchema`（Zod）做运行时校验

### 2.2 Shared Schema 扩展

文件：`src/shared/market-contract/schemas.ts`

新增 `ReserveSnapshotItemSchema` 和 `ReserveSnapshotsResponseSchema`，字段对齐后端 API 返回结构。前端 re-export 在 `src/lib/apiSchemas.ts`。

### 2.3 TypeScript 类型

文件：`src/types/reserveSnapshot.ts`（新建，与 `aave.ts` 同目录）

新增 `ReserveSnapshotItem`、`ReserveSnapshotsResponse` 接口，对齐后端返回格式。

## 3. 组件层

### 3.1 `ReserveSnapshotChart`

文件：`src/components/dashboard/ReserveSnapshotChart.tsx`

**Props**：

```typescript
interface ReserveSnapshotChartProps {
  reserveId: string;
  marketName: string;
  tokenSymbol: string;
}
```

**内部结构**：
- **时间范围选择器**：7d / 30d / 90d，复用 `FilterChip` 组件（`src/components/ui/filter-chip.tsx`），选中态 `bg-card text-foreground shadow-sm border border-[rgb(var(--ds-brand-magenta-rgb))]`
- **指标切换器**：totalSupplyApy / totalBorrowApy / utilizationPct / tokenPrice，复用 `SegmentedToggle size="chip"`（`src/components/ui/segmented-toggle.tsx`）
  - `totalSupplyApy` = `supplyApy + supplyIncentivesApr`（后端已预聚合 incentive APR）
  - `totalBorrowApy` = `borrowApy + borrowIncentivesApr`（同上）
  - 前端只做加法，无需从 JSONB breakdown 自行聚合
- **图表区域**：Recharts `ResponsiveContainer` + `LineChart` + `Line` + `XAxis` + `YAxis` + `Tooltip`
- **图表库**：Recharts 3.8.0（项目已有依赖）

**数据获取**：组件内调用 `useReserveSnapshots`，时间范围由选择器控制

**Recharts 配置**：
- X 轴：`snapshotAt` 格式化为日期（`dd MMM`）
- Y 轴：根据指标类型格式化（APY 百分比 / 价格 USD / 利用率 %）
- Tooltip：`bg-card` 背景 + `border border-border/60` + `TooltipCalloutArrow`（arrow 融入边框，`fill=hsl(var(--card))`），对齐现有 tooltip 风格
- 线条颜色：`hsl(var(--primary))`，无渐变填充（简洁）

### 3.2 状态管理

组件内部状态，无需全局 store：
- `timeRange`: `'7d' | '30d' | '90d'`
- `metric`: `'totalSupplyApy' | 'totalBorrowApy' | 'utilizationPct' | 'tokenPrice'`

### 3.3 加载 / 空态 / 错误态

| 状态 | 表现 |
|------|------|
| loading | `Skeleton variant="subtle"` 骨架屏（对齐现有 `LoadingState` 组件，`src/components/ui/skeleton.tsx`） |
| 空数据 | "暂无历史数据" 居中提示（`text-muted-foreground`） |
| error | 错误提示 + 重试按钮（对齐现有 error boundary） |

## 4. 集成方式

### 4.1 推荐：ReservesTable 行内展开 + Tab

当前 `DesktopReserveRow` 展开区域只渲染 `SimulationSubRow`（纯 expand/collapse，无 tab）。集成方案：

1. 在展开区域顶部新增 `SegmentedToggle`：`模拟` | `历史趋势`
2. 默认 tab 为 `模拟`（保持现有 `SimulationSubRow` 行为不变）
3. 切换到 `历史趋势` tab 时，渲染 `<ReserveSnapshotChart />`
4. 两个 tab 内容共享同一个 expand/collapse 容器（复用现有 `grid-template-rows: 1fr / 0fr` 动画）

**Mobile（`MobileReserveCard`）**：同样在 simulation 展开区域加 tab，用 compact pill 样式。

**理由**：
- 复用已有行展开 UI，不新增路由
- 上下文完整（用户在同一 reserve 行查看历史）
- 移动端/桌面端一致

### 4.2 备选：独立路由（后续迭代）

路由 `src/pages/ReserveHistoryPage.tsx`，路径 `/reserve/:reserveId/history`，仅在需要深度分析时启用。

## 5. 移动端适配

- 响应式判断：复用 `useIsMobile()` hook（768px 断点，`src/hooks/use-mobile.tsx`）
- 图表高度：桌面 280px，移动 200px
- 时间选择器：移动端 `FilterChip` 水平滚动（`overflow-x-auto`），不换行
- 指标切换器：移动端 `SegmentedToggle size="chip"` 不占额外行
- Tooltip：移动端 `side="bottom"`，touch 触发不依赖 hover（PREFERENCE_17）

## 6. 样式

- 组件样式对齐 `docs/design/DESIGN-SYSTEM-REFERENCE.md`
- 时间选择器：复用 `FilterChip`（`ds-chip rounded-md`，选中态 magenta border）
- 指标切换器：复用 `SegmentedToggle size="chip"`
- 图表容器：`rounded-xl border border-border/45`，对齐 Dashboard card 风格
- 指标数值颜色：`hsl(var(--primary))` / `hsl(var(--muted-foreground))`
- 禁止亮色/黄色（PREFERENCE_9）
- Tab 分隔符：竖线 `|` 而非水平线（PREFERENCE_4）

## 7. 测试

| 层 | 内容 |
|----|------|
| Hook 单测 | `useReserveSnapshots.test.ts`：mock API 返回，验证参数传递、queryKey 参数化、schema 校验 |
| 组件单测 | `ReserveSnapshotChart.test.tsx`：验证时间/指标切换、loading/empty/error 渲染 |
| Schema canary | `field-canary.test.ts` 扩展：枚举 `ReserveSnapshotItem` 字段名 |
| 架构守卫 | `architecture-guard.test.ts` 确认新文件位置合规 |
| 集成测试 | 展开 DesktopReserveRow → 切换到"历史趋势" tab → 图表渲染 |

## 8. 验收标准
- `useReserveSnapshots` 正确调用 `GET /api/markets/history`，queryKey 随参数变化
- `ReserveSnapshotChart` 渲染折线图，时间/指标切换正常
- 展开 row 默认显示"模拟" tab，切换到"历史趋势"渲染图表
- 移动端布局紧凑，不浪费空间
- 加载/空态/错误态正确展示
- 所有单测通过，CI/CD 正常

## 9. 依赖
- 后端 `GET /api/markets/history` API 已上线（见[后端方案](https://github.com/0xPabloLI/aave-protocol-analysis/blob/main/docs/backend/reserve-snapshots.md)）
- **无需新建 DB 表**：后端复用已有 `market_snapshots`（cron 每次已写入含 `supply_incentives_apr` / `borrow_incentives_apr` 预聚合列的快照）
- Recharts 3.8.0（已有）
- `src/shared/market-contract/schemas.ts` 已扩展 `ReserveSnapshotItemSchema`
- `src/config/queryStaleTimes.ts` 已新增 `reserveSnapshots` 条目
- `src/lib/apiBase.ts`（已有，`API_BASE`）

## 10. 关键文件参考

| 用途 | 文件 |
|------|------|
| API base URL | `src/lib/apiBase.ts` |
| react-query staleTime | `src/config/queryStaleTimes.ts` |
| 现有 hook 模式 | `src/hooks/useAaveMarkets.ts` |
| 展开行（Desktop） | `src/components/dashboard/DesktopReserveRow.tsx` |
| 展开行（Mobile） | `src/components/dashboard/MobileReserveCard.tsx` |
| Simulation 内容 | `src/components/dashboard/SimulationSubRow.tsx` |
| FilterChip | `src/components/ui/filter-chip.tsx` |
| SegmentedToggle | `src/components/ui/segmented-toggle.tsx` |
| Skeleton | `src/components/ui/skeleton.tsx` |
| Tooltip | `src/components/ui/tooltip.tsx` |
| useIsMobile | `src/hooks/use-mobile.tsx` |
| Shared Zod schema | `src/shared/market-contract/schemas.ts` |

## 11. 关联文档
- 后端实现方案：[`aave-protocol-analysis/docs/backend/reserve-snapshots.md`](https://github.com/0xPabloLI/aave-protocol-analysis/blob/main/docs/backend/reserve-snapshots.md)（DB schema、cron 采集、API 定义）
