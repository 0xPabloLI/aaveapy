# Design Doc: Utilization & Liquidity Two-Level Color Grading

## 1. Goal
Implement a simplified two-level color grading for the Utilization (资金利用率) and Liquidity metrics across the dashboard, reducing visual complexity while maintaining clear risk signaling.

## 2. Color Grading Strategy

### 2.1 Two-Level Metrics (Simplified)

| Risk Level | Condition | Text Color | Indicator Color | Status Description |
| :--- | :--- | :--- | :--- | :--- |
| **Level 1 (Safe)** | `utilization <= optimal` | `text-foreground` | `brand-cyan` | Below optimal / Normal |
| **Level 2 (Warning)** | `utilization > optimal` | `text-amber-500` | `amber-500` | Above optimal |

**Liquidity follows the same two-level pattern:**
- Safe: `liquidity >= $10K` → `ds-text-purple-500` (brand data color)
- Warning: `liquidity < $10K` → `text-amber-500`

### 2.2 Three-Level Metrics (Retained)

The following metrics **retain three-level grading** as they represent hard capacity constraints with distinct risk thresholds:

| Metric | L1 Safe | L2 Warning | L3 Critical | Colors |
| :--- | :--- | :--- | :--- | :--- |
| **Supply Cap** | < 80% | 80% - 95% | >= 95% | emerald / amber-500 / amber-600 |
| **Borrow Cap** | < 80% | 80% - 95% | >= 95% | cyan / amber-500 / amber-600 |
| **Deficit Share** | neutral | warning | critical | muted / amber-500 / amber-600 |

**Rationale:** Capacity metrics (Caps) need granular alerting at 95% (near exhaustion) vs 80% (elevated usage). Utilization and Liquidity are relative/continuous metrics where two levels suffice for clear UX without color overload.

## 3. Unified Warning Color

All "warning" states across **both** two-level and three-level metrics use the same `amber-500` color:
- Utilization > optimal
- Liquidity < $10K
- Cap 80-95%
- Deficit warning level

This ensures visual consistency — users learn that "amber = attention" regardless of metric type.

## 4. Impacted Components

### 4.1 `UtilizationIndicator.tsx` ✅
- **Two-level**: fill, dot, and tooltip colors
- Removed 95% critical tier (previously amber-600)

### 4.2 `DesktopReserveRow.tsx` ✅
- **Two-level**: utilization percentage text color
- **Two-level**: liquidity amount text color (threshold: $10K)

### 4.3 `MobileReserveCard.tsx` ✅
- **Two-level**: utilization text color on card summary
- Note: deficit uses three-level via shared `deficitSeverity` helper

### 4.4 `MobileReserveSheetContent.tsx` ✅
- **Two-level**: utilization status in bottom sheet
- **Two-level**: available liquidity in borrow cap sheet
- **Three-level retained**: supply/borrow cap percentages (95%/80%)
- **Three-level retained**: deficit severity

## 5. Implementation Notes

### 5.1 Key Changes from Previous Three-Level Design
1. Removed `isCritical (>= 95%)` check from utilization logic
2. Unified warning color to `amber-500` (removed `amber-600` for utilization/liquidity)
3. Simplified liquidity from three tiers ($1K/$10K) to two tiers ($10K)

### 5.2 Consistency Checklist
When adding new metrics, determine grading level by asking:
- [ ] Is this a **capacity hard limit**? → Consider three-level (80%/95%)
- [ ] Is this a **continuous/ratio metric**? → Use two-level with unified amber-500

## 6. Verification

- [x] Desktop utilization column: two-level color switching
- [x] Desktop liquidity subtext: two-level ($10K threshold)
- [x] Mobile utilization indicator: two-level
- [x] Mobile bottom sheet: two-level for util/liquidity, three-level for cap/deficit
- [x] Tooltip states: updated text removes "Critical / High Risk" tier
