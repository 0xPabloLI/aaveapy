# Design Doc: Utilization Three-Level Color Grading

## 1. Goal
Implement a consistent three-level color grading for the Utilization (资金利用率) metric across the dashboard, matching the granularity of the Liquidity color grading.

## 2. Thresholds and Visual Mapping
Based on "Scheme A", the thresholds are defined relative to the `optimal` point and absolute critical values.

| Risk Level | Condition | Text Color | Indicator Color | Status Description |
| :--- | :--- | :--- | :--- | :--- |
| **Level 1 (Safe)** | `utilization <= optimal` | `text-foreground` | `brand-cyan` | Normal / Healthy |
| **Level 2 (Warning)** | `optimal < utilization < 95%` | `text-amber-500` | `amber-500` | Above optimal |
| **Level 3 (Critical)** | `utilization >= 95%` | `text-amber-600` | `amber-600` | Critical / High Risk |

## 3. Impacted Components

### 3.1 `UtilizationIndicator.tsx`
- Update the logic to determine `fill` and `dot` colors based on the three levels.
- Update Tooltip text for the "Critical" state.

### 3.2 `DesktopReserveRow.tsx`
- Update the utilization percentage text color logic.

### 3.3 `MobileReserveCard.tsx`
- Update the utilization percentage text color logic on the card summary.

### 3.4 `MobileReserveSheetContent.tsx`
- Update the utilization status text and color in the bottom sheet.

## 4. Implementation Steps
1. Create a helper function or shared constants if needed, otherwise implement directly if the logic is simple enough to keep DRY via existing patterns.
2. Update `UtilizationIndicator`.
3. Update `DesktopReserveRow`.
4. Update Mobile components.
5. Verify across all breakpoints.
