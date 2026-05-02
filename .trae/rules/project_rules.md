# Project Rules

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
- API contract changes: `docs/conventions/api-contract-checklist.md`
