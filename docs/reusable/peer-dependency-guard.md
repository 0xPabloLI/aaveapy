# Peer Dependency Guard

Prevent core library version mismatches that cause silent runtime failures (white screens, hook errors) while passing all static checks.

## The Problem

In many frontend frameworks, core packages **must** share the same major version. If automated upgrades, manual edits, or security patches upgrade one package without the other, the result is:

- White screen / blank page (no compile error, no lint error)
- Hook or lifecycle errors at runtime
- Runtime crash with zero build-time signal

This is especially insidious because **TypeScript compiles, bundler builds, and linting all pass**.

## Which Libraries Are Affected

| Framework | Packages that must match |
|-----------|------------------------|
| React | `react`, `react-dom` |
| Vue | `vue`, `@vue/compiler-sfc` |
| Angular | `@angular/core`, `@angular/common`, `@angular/compiler`, etc. |
| Next.js | `next`, `react`, `react-dom` |

## Defenses

### 1. Package manager overrides

Force all sub-dependencies to use the same version:

**npm** (`package.json`):
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

**pnpm** (`package.json`):
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

**yarn** (`package.json`):
```jsonc
{
  "resolutions": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

### 2. CI version-match check

```yaml
peer-dep-check:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
        cache: npm
    - run: npm ci
    - name: Check core library version match
      run: |
        # Adapt package names for your framework
        PKG_A=$(node -p "require('react/package.json').version")
        PKG_B=$(node -p "require('react-dom/package.json').version")
        echo "react=$PKG_A  react-dom=$PKG_B"
        if [ "$PKG_A" != "$PKG_B" ]; then
          echo "::error::Version mismatch: react ($PKG_A) vs react-dom ($PKG_B)"
          exit 1
        fi
    - name: Check for peer dependency conflicts
      run: npm ls --all 2>&1 | grep -i "invalid" && exit 1 || echo "No peer dep conflicts"
```

### 3. Local diagnostic commands

```bash
# Quick version check
node -p "require('react/package.json').version"
node -p "require('react-dom/package.json').version"

# Peer dep conflicts
npm ls react 2>&1 | grep "invalid"

# Runtime verification (no browser needed)
node --input-type=module -e "import('react-dom/client').then(() => console.log('OK')).catch(e => console.log('FAIL:', e.message))"
```

## Major Version Upgrade Checklist

- [ ] Upgrade all paired packages simultaneously
- [ ] Upgrade corresponding `@types/*` packages
- [ ] Check peer dep conflicts: `npm ls <pkg> 2>&1 | grep invalid`
- [ ] Check key dependency compatibility
- [ ] Runtime verification (import check without browser)
- [ ] Clear bundler cache (e.g. `rm -rf node_modules/.vite`)
- [ ] Browser verification: no white screen
