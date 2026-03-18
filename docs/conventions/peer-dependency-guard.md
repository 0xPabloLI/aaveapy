# Peer Dependency Guard

> 防止 react/react-dom 等核心库版本不匹配导致白屏。
> 通用模式，可直接复制到任何 React 项目。

---

## 问题描述

React 生态中 `react` 和 `react-dom` **必须**是同一大版本。如果 Dependabot、手动升级、或 security fix 只升了其中一个，会导致：

- 白屏（`Cannot read properties of undefined (reading 'ReactCurrentDispatcher')`）
- Hooks 报错（`Invalid hook call`）
- 运行时崩溃无任何编译错误

这类问题特别隐蔽：**TypeScript 编译通过、Vite build 通过、ESLint 通过**，但浏览器打开就是白屏。

## 历史案例

### 2026-03-16: react@19 + react-dom@18 白屏

- **起因**：Dependabot PR `e5027c2` 将 `react` 从 18 升到 19，但 `react-dom` 留在 18
- **表现**：`localhost:8080` 白屏，无编译错误，无 lint 错误
- **诊断**：`node -e "import('react-dom/client')"` → `Cannot read properties of undefined (reading 'ReactCurrentDispatcher')`
- **修复**：将 `react-dom` 也升到 19，或将 `react` 降回 18

## 防护措施

### 1. package.json `overrides`（npm 专用）

强制所有子依赖使用同一版本，防止 node_modules 中出现多个 React 实例：

```jsonc
{
  "overrides": {
    "react": "$react",
    "react-dom": "$react-dom",
    "@types/react": "$@types/react",
    "@types/react-dom": "$@types/react-dom"
  }
}
```

> `$react` 语法表示"使用 dependencies 里声明的那个版本"。

**pnpm 等价写法**（`package.json`）:
```jsonc
{
  "pnpm": {
    "overrides": {
      "react": "$react",
      "react-dom": "$react-dom"
    }
  }
}
```

**yarn 等价写法**（`package.json`）:
```jsonc
{
  "resolutions": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  }
}
```

### 2. CI peer-dep-check job

在 CI 中显式检查版本一致性和 peer dep 冲突：

```yaml
peer-dep-check:
  name: peer-dep-check
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
        cache: npm
    - run: npm ci
    - name: Check react/react-dom version match
      run: |
        REACT_V=$(node -p "require('react/package.json').version")
        RDOM_V=$(node -p "require('react-dom/package.json').version")
        echo "react=$REACT_V  react-dom=$RDOM_V"
        if [ "$REACT_V" != "$RDOM_V" ]; then
          echo "::error::react ($REACT_V) and react-dom ($RDOM_V) version mismatch!"
          exit 1
        fi
    - name: Check for peer dependency conflicts
      run: npm ls --all 2>&1 | grep -i "invalid" && exit 1 || echo "No peer dep conflicts"
```

### 3. 本地诊断命令

```bash
# 快速检查版本是否一致
node -p "require('react/package.json').version"
node -p "require('react-dom/package.json').version"

# 检查 peer dep 冲突
npm ls react 2>&1 | grep "invalid"

# 运行时验证（不需要浏览器）
node --input-type=module -e "import('react-dom/client').then(() => console.log('OK')).catch(e => console.log('FAIL:', e.message))"
```

## 适用范围

此模式适用于任何有「核心库必须版本一致」约束的项目：

| 库组 | 必须一致的包 |
|------|-------------|
| React | `react`, `react-dom` |
| Vue | `vue`, `@vue/compiler-sfc` |
| Angular | `@angular/core`, `@angular/common`, `@angular/compiler` 等 |
| Next.js | `next`, `react`, `react-dom` |

## Checklist（升级 React 大版本时）

- [ ] `react` 和 `react-dom` 同时升级到同一版本
- [ ] `@types/react` 和 `@types/react-dom` 同步升级
- [ ] 检查 peer dep 冲突：`npm ls react 2>&1 | grep invalid`
- [ ] 检查关键依赖兼容性（next-themes, react-day-picker, vaul 等）
- [ ] 运行 `node --input-type=module -e "import('react-dom/client')..."` 验证
- [ ] 清除 Vite 缓存：`rm -rf node_modules/.vite`
- [ ] 浏览器验证不白屏
