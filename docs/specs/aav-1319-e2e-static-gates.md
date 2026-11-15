# AAV-1319 — e2e 目录纳入静态门（typecheck + lint），并接进三道门

> Status: implemented 2026-11-15 · Issue: [AAV-1319](https://linear.app/aaveapy/issue/AAV-1319) · Type: verification coverage (no runtime behavior change)
> Scope: 让 `e2e/` 与 `playwright.config.ts` 进入类型门与 lint 门，并把类型门接进 pre-commit / `ci:remote` / PR CI。

## 背景与根因

AAV-1308 实施期发现 e2e 侧没有常态静态门（2026-09-28）。2026-11-15 复核，三层缺口都在，且第三层比票面写的更大：

| 门 | 实际覆盖 | 证据 |
| -- | -- | -- |
| `npm run lint` | `eslint.config.js` 的 `ignores` 显式含 `e2e` | `eslint .` 是空转在 e2e 上 |
| `npm run typecheck` | `tsc -p tsconfig.app.json`（include 仅 `src`）+ `tsc -p tsconfig.node.json`（仅 `vite.config.ts`） | `e2e/*.spec.ts`、`e2e/playwright.fields.config.ts`、`e2e/test-reserves.ts`、根 `playwright.config.ts` 全不在内 |
| GitHub PR CI | `ci.yml` 只跑 `npm run lint` / `npm test` / `npm run build`，**没有任何 `npm run typecheck`**；`build` 走 vite（esbuild 只剥类型） | `grep -rn "typecheck" .github/workflows/*.yml` 命中 0 处调用 |

后果不是理论上的：`e2e/portfolio-cross-asset-pairing.spec.ts` 曾长期带着 `test.skip('字符串')`（不匹配任何 Playwright 重载，靠运行时真值侥幸生效），因为没人编译过它；AAV-1308 顺带修掉 2 处。

第三层是本次新增的定性：**类型门只存在于本地 pre-commit**。网页端提交、`--no-verify`、或 hook 安装缺失的机器上，类型错误可以直接进 `dev`/`main`——CI 不会红。

### 接门前的存量状态（决定能不能一次接死）

- `tsc -p`（`include: ["e2e/**/*.ts"]`）实测 **rc=0 / 0 error / ~1.0s**：存量类型错误已被 2026-09-29 那次显式 tsc 清零（45 错），所以接门不会炸出一片红。
- `e2e` 不反向 import `src`（`grep -rlE "(\.\./)+src/" e2e/*.ts` = 0 个文件），因此新 tsconfig 不需要 `@/*` 路径映射也能自洽。
- `eslint` 用与非 type-aware 的 `recommended` 基线扫 `e2e`：**28 条**。分布：17 `no-empty-pattern`（Playwright fixture `async ({}) => …` 的合法写法）、9 `@typescript-eslint/no-unused-vars`（其中 6 条是 `_page` 这类约定俗成的前缀豁免名，3 条是真死代码）、2 `no-useless-escape`。

## 设计

1. **`tsconfig.e2e.json`**（新增）：`target ES2022`、`module ESNext`、`moduleResolution bundler`、`types: ["node"]`、`strict`、`skipLibCheck`、`noEmit`，`include: ["e2e/**/*.ts", "playwright.config.ts"]`。
   - 顺带把根 `playwright.config.ts` 纳入：它与 e2e spec 同属一条链，之前同样零覆盖，加进同一 tsconfig 零额外成本。
   - 不加进根 `tsconfig.json` 的 `references`：现有 `tsconfig.app/node` 都没有 `composite: true`，加引用会引入 TS6306。编辑器侧能否按此 tsconfig 校验 e2e 属编辑器行为，不在本票验收内（见 Out of scope）。
2. **脚本拆分**：`typecheck:src`（原 `typecheck` 的两条 tsc）、`typecheck:e2e`（`tsc -p tsconfig.e2e.json --noEmit`）、`typecheck` = 两者串联。
   - `typecheck` 的对外语义不变（pre-commit 与文档都引它），只是覆盖面变大；`typecheck:e2e` 单独可跑，便于只改 e2e 时快速迭代。
3. **`ci:remote` 前置 `npm run typecheck`**：pre-push 从此真的跑类型门。原来 `ci:remote` = lint + react-singleton + test + build + audit，一条 typecheck 都没有。
4. **生成物顺序收进 `pretypecheck`**：`tsconfig.app.json` import 两个 gitignored 的 `*.generated` 模块，干净 worktree 直接跑 tsc 会炸 `TS2307`（读数像代码回归）。这条知识原先只写在 `.husky/pre-commit` 的注释里，接门后 `ci:remote` 与 CI 也要它 ⇒ 改为 `"pretypecheck": "node scripts/generate-icon-manifests.mjs"`，由 npm 生命周期保证**任何** `npm run typecheck` 入口都先补生成物。`.husky/pre-commit` 里那行独立 generate 与 `ci.yml` 里的独立 step 都随之删除，避免三处各记一份顺序。
5. **`ci.yml` 的 `lint` job 增加 typecheck step**：该 job 已有 checkout/setup-node/`npm run ci:lockcheck`，因为 pretypecheck，不需要额外的 generate step。
6. **`eslint.config.js`**：`ignores` 去掉 `e2e`，新增 `e2e/**/*.ts` 与 `playwright.config.ts` 的 block：
   - 规则集与 src 对齐（`js.configs.recommended` + `tseslint.configs.recommended` + `import/no-duplicates`），但 `@typescript-eslint/no-unused-vars` **保持开启**并配 `argsIgnorePattern/varsIgnorePattern/destructuredArrayIgnorePattern: "^_"`。src 关这条是历史包袱（注释写明「暂关闭」），e2e 只有 42 个文件、没有那个包袱，开着才有实际收益（本次就靠它抓出 3 处真死代码）。
   - `no-empty-pattern` 对 e2e 关闭：Playwright 的 `test('…', async ({}) => …)` 是官方 fixture 形态，关掉的是误报而不是缺陷。
   - type-aware（`parserOptions.project`）不做，见 Out of scope。
7. **存量清理**（仅静态等价改写）：3 处真死变量（`page.evaluate((id) => …, slug)` 的无用参数与其实参、`beforeEach(({}, testInfo) => …)`、`.filter((r, i) => …)`）+ 2 处多余转义（`/\-?\d+\.\d{2}%/` → `/-?\d+\.\d{2}%/`、`/^\+?\-?\$[0-9]/` → `/^\+?-?\$[0-9]/`）+ 2 处重复 import（启用 `import/no-duplicates` 后暴露：`e2e/reserves-table-simulation-*.spec.ts` 各有一行 `import type { Page }`，合并进首个 import）。
8. **AGENTS.md**：Validation Gate 段由「`e2e/` 也不在 lint 与 typecheck 的覆盖范围内：改了 e2e … 就对那几个文件显式跑 tsc」改为「`npm run typecheck` 覆盖 `e2e` + `playwright.config.ts`；e2e 也在 eslint 覆盖内」。`scripts/validate-agents-md.mjs` 会校验文中 `npm run <name>` 是否真实存在，故新增脚本名可被它兜住。

## Modified Files Impact

| 文件 | 修改内容 | 风险等级 | 评估 |
|------|---------|---------|------|
| `tsconfig.e2e.json`（新增） | e2e + playwright.config.ts 的独立 tsconfig | Low | 纯新增；不影响既有两条 tsc |
| `package.json` | 拆 `typecheck:src` / 新增 `typecheck:e2e` / `typecheck` 串联 / `pretypecheck` 补生成物 / `ci:remote` 前置 typecheck | Medium | `typecheck` 覆盖面变大 ⇒ pre-commit 与 pre-push 会因 e2e 类型错误而红（预期行为）；`ci:remote` 时长 +~14s |
| `tsconfig.e2e.json` / `.husky/pre-commit` / `.github/workflows/ci.yml` | 生成物顺序从三处复制收敛为 `pretypecheck`；CI 的 `lint` job 加 typecheck step | Medium | job 名不变；失败会让 PR 红（预期） |
| `eslint.config.js` | 从 `ignores` 移除 `e2e`；新增 e2e block（含 `import/no-duplicates`） | Medium | `eslint .` 开始扫 42 个 e2e 文件 + 根 playwright.config.ts；规则差异集中在这一 block |
| `scripts/e2e-static-gate.test.mjs`（新增） | 契约 + 行为守卫（类型负控、lint 负控、覆盖深度） | Low | 随 `npm test` 生效，不新增 npm script |
| `e2e/*.spec.ts`（7 个文件） | 3 处死变量 + 2 处多余转义 + 2 处重复 import 的等价改写 | Low | 不触及断言与等待策略；`_` 前缀名保持 |
| `AGENTS.md` | 验证门段落与实际覆盖对齐 | Medium | agent 指令文件，已获 maintainer（本 session 用户）同意 |
| `docs/DOCS-INDEX.md` / `docs/issue-roadmap.md` | 登记本 spec、更新 frontier | Low | 共享登记文件 |

最坏后果：tsconfig 的 `include` 写错（例如漏 `e2e/**/*.ts`）⇒ 门存在但检查 0 个文件，又是一张假绿灯。因此守卫测试同时断言 `include` 内容**和**负控（写一个带类型错误的探针文件必须让门变红），不只断言「命令存在」。

## Scenario & Risk Verification Matrix

| # | Scenario | Expected Behavior | Risk | Evidence | Mitigation |
|---|----------|-------------------|------|----------|------------|
| E1 | 干净树跑 `npm run typecheck:e2e` | rc=0、0 error（新门不能自带假红） | High | runtime-real-command（`tsc -p tsconfig.e2e.json`） | 接门前实测 rc=0 / 1.0s |
| E2 | `e2e/*.spec.ts` 写入类型错误 | 门 rc≠0，且输出点名探针文件 | High | automated test（负控：写 `e2e/__static_gate_probe__.spec.ts` → 跑真 tsc → 断言失败且输出点名该文件 → 清理） | 票面 AC1 |
| E3 | 未被任何测试 import 的 e2e 文件有类型错误 | 同样让门变红 | High | automated test（同一探针：spec 文件不被任何测试 import，仍被 `include` 编译）+ static-check（`include` 含根 `playwright.config.ts`） | 这是当前最大缺口：旧配置只靠「被 src import」顺带编译 |
| E4 | 新 worktree / 干净 runner 缺 `*.generated` | `npm run typecheck` 自己先补生成物，不依赖调用方记得 | Medium | runtime-real-command（删掉 `src/lib/chainIconManifest.generated.ts` 后裸 `tsc -p tsconfig.app.json` 报 TS2307，而 `npm run typecheck` 绿）+ static-check（`pretypecheck` 接线断言） | 顺序收进 npm 生命周期，pre-commit / ci:remote / CI 三处不再各记一份 |
| E5 | e2e 里有 `_page` 这类约定未使用参数 | lint 不报（`^_` 豁免） | Medium | automated test（`npx eslint e2e` rc=0）+ 规则配置断言 | `argsIgnorePattern: "^_"` |
| E6 | e2e 里有真死变量 / 多余转义 | lint rc≠0 | High | automated test（正方向：清理后 `eslint e2e` rc=0 且至少读到 20 个文件；负控：写 `__static_gate_lint_probe__.spec.ts` 带未使用变量 → rc≠0 且规则名为 `no-unused-vars`） | 本次清掉 7 处（5 处规则违规 + 2 处重复 import） |
| E7 | Playwright `async ({}) => …` 空 fixture 模式 | lint 不报 `no-empty-pattern` | Medium | static-check（eslint 配置断言 + `eslint e2e` rc=0） | 该规则对 e2e 关闭并注明理由 |
| E8 | 只改 e2e 的 agent 跑 `npm run typecheck` | 覆盖 e2e（不需要手动拼 tsc 命令行） | High | static-check（`typecheck` 链路断言） | AGENTS.md 同一 commit 更新 |
| E9 | 网页端/绕过 hook 的提交进 PR | PR CI 因类型错误变红 | High | static-check（`ci.yml` 含 `npm run typecheck` step，且在 manifest 生成之后） | 新增 step |
| E10 | `ci:remote` 失败被 hook 吞掉 | 仍然阻断（AAV-1330 的 `|| { … exit 1; }` 不动） | Medium | 既有 `scripts/hook-failure-propagation.test.mjs` 保持绿 | 不改 `.husky/*` 逻辑，只依赖 `npm run typecheck` 已在 `ci:remote` 内 |
| E11 | 文档与命令漂移 | `check:agents-md` 通过（引用的脚本名必须存在） | Medium | runtime-real-command（`npm run check:agents-md`） | AGENTS.md 用真实脚本名 |
| E12 | 门导致本地/CI 明显变慢 | typecheck +≤2s、eslint e2e +≤3s | Low | runtime-real-command（实测：`npm run typecheck` 13.4s，其中 e2e 段 0.85–1.0s；`eslint e2e` 1.0s；`eslint .` 18.9s 含既有 74 条 complexity warn） | 已记录，无回归 |

## Tickets（tracer-bullet 依赖边）

- **T1**(red)：新增 `scripts/e2e-static-gate.test.mjs`（契约 E4/E8/E9/E11 + 行为 E2/E5/E6/E7）→ 预期红（`tsconfig.e2e.json` 不存在、脚本未接线）
- **T2**(green)：`tsconfig.e2e.json` + `package.json`（`typecheck:src` / `typecheck:e2e` / `typecheck` / `ci:remote`）→ E1/E8 绿
- **T3**(green)：`eslint.config.js` 移除 ignores + 新增 e2e block（含 `import/no-duplicates`）+ 清 7 处存量（3 死变量 / 2 转义 / 2 重复 import）→ E5/E6/E7 绿
- **T4**：`pretypecheck` 收拢生成物顺序 + `ci.yml` 加 typecheck step → E4/E9 绿
- **T5**：`AGENTS.md` + `docs/DOCS-INDEX.md` + `docs/issue-roadmap.md` → E11 绿
- **T6**：全门验证（`npm run typecheck` / `npm run lint` / `npm test` / `npm run ci:remote` / e2e 子集）+ 双轴 review + commit

依赖边：T1 → T2 → T3 → T4 → T5 → T6。

## Out of scope

- **IDE 侧覆盖**：不把 `tsconfig.e2e.json` 挂进根 `references`（需给三个 tsconfig 都加 `composite: true`，属独立改造），因此编辑器打开 e2e 文件时仍可能没有类型提示。
- **`scripts/**/*.ts` 的静态门**：`scripts/` 同时被 eslint 的 `ignores` 与两条 tsconfig 排除，且 `scripts/lib/*.test.ts` 迁移到 `.mjs` 后只剩 `check-*.ts` 等工具脚本。同族缺口，但位置与风险面不同，另票处理。
- **e2e 提为 required status check**：分支保护是 repo setting，按 AAV-1349 的结论留待单独拍板；本票只保证 CI 会红，不保证「红会被拦」。
- **type-aware lint**（`parserOptions.project`）：会让 eslint 走 TS 程序、时间翻倍且引入 `no-floating-promises` 等一批存量违规，属另一档严格度。
