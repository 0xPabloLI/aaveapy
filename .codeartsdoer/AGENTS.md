## Engineering Context

```json
{
  "Language Context": [
    "TS",
    "TS_ESM"
  ],
  "Architecture Stack": [
    "React"
  ]
}
```

## Validation Gate (修改后必跑验证)

**After EVERY code change, run ALL of these in order. The change is NOT complete until all pass:**

```bash
npm run lint        # ESLint
npm test            # Vitest
npm run build       # Vite production build
npx tsc --noEmit    # TypeScript type-checking
```

**If ANY check fails:**
- Fix the root cause in the code
- Re-run the full sequence from the beginning
- Repeat until ALL checks pass
- Do NOT hand back to the user with failing validation