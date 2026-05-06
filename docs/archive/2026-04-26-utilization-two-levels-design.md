# Design Doc: Utilization & Liquidity Two-Level Color Grading

> **已过时 (superseded):** 本文档记录的旧版颜色方案（amber-500 = 统一 Warning）已被 commit `c95559c` (`refactor(alert-colors): swap amber-500/600 so brighter = more severe`) 和后续补全修正所取代。
> **当前权威规范参见**：[`docs/design/DESIGN-SYSTEM-REFERENCE.md`](../design/DESIGN-SYSTEM-REFERENCE.md#21-颜色档位规范告警色分级)

## 当前生效的颜色方案 (v3)

**亮度梯度原则：越严重越亮越醒目**

| 色值 | Tailwind | 亮度 | 用途 |
|:---|:---|:---|:---|
| `amber-500` | 亮黄橙 `#f59e0b` | **亮** 最醒目 | **Critical**（三级指标第三档：Cap ≥ 95%、Deficit critical） |
| `amber-600` | 深棕橙 `#d97706` | **暗** 次醒目 | **Warning**（两级指标唯一告警档 + 三级指标第二档：Cap 80-95%、Deficit warning） |

### 两级指标 (利用率和流动性)

| Risk Level | Condition | Text Color |
|:---|:---|:---|
| **Level 1 (Safe)** | `util ≤ optimal` / `liquidity ≥ $10K` | `text-foreground` / `ds-text-purple-500` |
| **Level 2 (Warning)** | `util > optimal` / `liquidity < $10K` | **`text-amber-600`** |

### 三级指标 (Cap 和 Deficit)

| Metric | L1 Safe | L2 Warning | L3 Critical |
|:---|:---|:---|:---|
| **Supply Cap** | < 80% → emerald | 80-95% → `amber-600` | ≥ 95% → `amber-500` |
| **Borrow Cap** | < 80% → cyan | 80-95% → `amber-600` | ≥ 95% → `amber-500` |
| **Deficit Share** | neutral → muted | warning → `amber-600` | critical → `amber-500` |

## 影响组件清单

全量实现位置参考上方「告警色使用位置标注」。
