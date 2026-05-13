# Project Rules

## Mandatory Skill Bootstrap (技能自举 — 每次对话必须执行)

**This rule applies at the START of EVERY agent invocation — no exceptions.**

Before ANY other action (including reading files, searching code, or responding to the user), the agent MUST:

1. Invoke the `Skill` tool with name `using-superpowers`
2. Follow the loaded skill instructions exactly

This is NOT optional. Even for "simple questions" or "quick lookups", the skill check comes FIRST.

**Rationale:** `using-superpowers` establishes how to find and use skills properly. Skipping it leads to undisciplined workflows and missed opportunities to use relevant skills.

## Post-Modification Validation Gate (修改后验证门禁)

**This rule applies after EVERY code change — no exceptions.**

After making ANY code modification, the agent MUST immediately run the validation suite. The change is NOT considered complete until all checks pass.

### Mandatory Validation Sequence

Run these commands in order after each code change:

```bash
npm run lint        # ESLint — catches style and common errors
npm test            # Vitest — unit/integration tests
npm run build       # Vite build — ensures production bundle works
npx tsc --noEmit    # TypeScript type-checking — catches missing imports and type errors
```

### Workflow

1. **Make the code change**
2. **Run the full validation sequence** above
3. **If ANY check fails:**
   - Read the error output carefully
   - Fix the root cause in the code
   - Re-run the full validation sequence from the beginning
   - Repeat until ALL checks pass
4. **Only when ALL checks pass** is the modification considered complete

### Important Notes

- Do NOT skip any step in the sequence — all four must pass
- Do NOT assume a change is correct without running validation
- Do NOT hand back to the user with failing validation — fix it first
- For targeted changes, you may run a subset first for quick feedback, but the full sequence MUST pass before declaring done
- If `ci:remote` is available and relevant, run it as the final gate

### High-Risk Areas (Extra Care Required)

For changes in these areas, also follow the relevant checklists after validation passes:
- Simulation/reserves/table UI: `docs/conventions/frontend-regression-checklist.md`
- Design token / hardcoded style migrations: `docs/conventions/frontend-regression-checklist.md` § Design Token Regression Guards + `bash scripts/check-hardcoded-tokens.sh --strict`
- API contract changes: `docs/conventions/api-contract-checklist.md`

## Mobile Layout Design Principle (移动端布局设计原则)

**移动端设计必须紧凑 — 不允许冗余留白和独占行。**

When designing or modifying mobile UI (cards, sheets, panels), always follow these rules:

1. **复用现有留白空间，不加独占行** — 次要数据（如 deficit）不应单独占一整行。优先考虑：利用区块之间的 padding/margin 空隙、用绝对定位浮在间隙中、或嵌入已有行内。
2. **去掉冗余标签文字** — 图标已足够传达含义时，不要额外加文字标签（如 "deficit"）。
3. **优先用图标 + Tooltip，而非文字** — 数值过长会溢出/重叠（尤其是绝对定位元素），用图标 + 点击 tooltip 查看详情更安全。
4. **一行多信息，纵向省空间** — 同一行内通过 gap 分隔多个信息片段，比上下堆叠更好。
5. **字体和间距用最小档** — 次要信息用 `ds-text-10` / `ds-text-9`，间距用 `gap-0.5` / `gap-1`，不过度消耗纵向空间。

**反例（禁止）**：
```tsx
{/* ❌ 独占一整行 + 冗余文字标签 + 可能叠加到下方内容 */}
<div className="px-4 py-1 w-full">
  🛡 $4,523,891.23 deficit
</div>
```

**正例（推荐 — 图标 + 环形图 + Tooltip，零高度）**：
```tsx
{/* ✅ DeficitLiquidityRing：盾牌 + 环形进度 + Tooltip 详情，无文字溢出风险 */}
<motion.div className="relative mt-0.5">
  <div className="absolute -top-1.5 right-4 z-10">
    <DeficitLiquidityRing
      deficitUsd={deficitUsd}
      totalSuppliedUsd={displayReserveSizeUsd}
      displayMode={inputMode}
      ringSize={11}
      label={<DeficitShieldIcon ... />}
      poolExplorerUrl={buildPoolExplorerUrl(reserve.marketName)}
    />
  </div>
  <HeroApy ... />
</motion.div>
```

### 绝对定位的隐患与规避

在移动端用 `absolute` 将元素浮在间隙中时，需注意：

| 隐患 | 触发条件 | 规避方法 |
|------|----------|----------|
| 与相邻元素重叠 | 元素宽度/高度超出间隙 | 去掉文字，仅保留图标 + 小环（≤30px 宽） |
| 数值过长溢出到 APY | deficit 值位数多 | **不显示数值**，用 Tooltip 承载详情 |
| 间隙变化导致偏移 | 字体 token 或 padding 改动 | `-top-1.5` 依赖固定的 `mt-0.5` + `ds-text-13` 行高 |
| z-index 遮挡交互 | 浮层遮挡下方可点击区域 | 用 `z-10`，且元素本身有 hover/click 交互 |

**原则：absolute 定位的元素不应包含可变长度文字。** 如果必须显示文字，用正常流布局。</think>

<｜DSML｜parameter name
