# Git Concurrent Recovery

> Git 并发竞态的应急配方。仅在**竞态已发生、且无法用 worktree 隔离**时加载：对方 session 把你的提交挤出分支历史、或必须在不动共享工作区/index 的前提下完成提交。
> 可预判的并行任务一律走 `docs/workflows/cross-branch-workflow.md` 的 worktree 规则（并在新 worktree 先 `npm install`，否则 husky 门整条静默消失），不进入本文件路径。
> 底本 `~/Documents/code/agent-harness/core/git-concurrent-recovery.md`；本 repo 已安装 husky 门，绕过 hook 的补偿要求更严（见每处标注）。

## 触发条件（本 repo 实证）

2026-11-18：同一条 `dev` 链上两个 session 的 commit 交替落地（`045658e9` → `4fef636c` → `26f0cb11` …），共享工作树与 index；一方在途改动让另一方 `pre-commit` 的全仓 lint/typecheck 变红。此类场景才加载本文件。

## 配方 1：临时 index 隔离提交

共享目录被并行 session 占用时，不触碰当前 index 与工作区，直接组装提交：

```bash
BASE=$(git rev-parse <branch>)                        # 记录期望旧值，供 update-ref 比对
GIT_INDEX_FILE=<tmp> git read-tree "$BASE"            # 临时 index，不动共享 index
GIT_INDEX_FILE=<tmp> git add <本任务路径>              # 显式列路径；同文件交叠时不可用（会装入混合内容）
TREE=$(GIT_INDEX_FILE=<tmp> git write-tree)           # 产出树对象
git ls-tree -r "$TREE"                                # 核对只含本任务文件
COMMIT=$(GIT_INDEX_FILE=<tmp> git commit-tree "$TREE" -p "$BASE" -m "<message>")
git update-ref refs/heads/<branch> "$COMMIT" "$BASE"   # 带期望旧值：他方已推进则失败而不是覆盖
```

要点（不得省略）：

1. **`update-ref` 必须带期望旧值**。不带旧值时，他方在你组装期间推进的 ref 会被静默覆盖。失败（非 0 退出）时等待对方停滞并重新取 BASE。
2. **禁止整表重置共享 index**。确需对齐时先检查：
   ```bash
   git diff --cached --quiet || { echo "STOP: 共享 index 含未提交内容，禁止重置"; exit 1; }
   git read-tree HEAD
   ```
3. **同文件交叠时禁用本配方**：`git add` 会把混合内容装进树。
4. **绕过 hook 的补偿（本 repo 加强）**：`commit-tree` 不触发 `pre-commit`/`pre-push`，而本仓有**只存在于 pre-push** 的四道门（`osv-scanner` / `semgrep` / `knip` / `dup:check`，GitHub CI 无对应 job）。因此该 commit **不得直接 push 到 `dev`/`main`**：必须先在干净 worktree（先 `npm install` 并 `npm run check:hooks-path` 确认 gated）补跑一遍完整 `pre-push` 内容，结果写进汇报。
5. 提交后共享 index 仍停留在旧树：`git status` 会出现反向 diff，按第 2 点对齐。

## 配方 2：找回被挤出的孤儿提交

1. `git reflog` / `git fsck --lost-found` 定位孤儿 commit sha，`git show --stat <sha>` 确认内容。
2. 按配方 1 在新 HEAD 上重做提交。

## 配方 3：从孤儿提交恢复单个文件

```bash
git rev-parse <orphan-sha>:<path>                   # 取 blob sha
GIT_INDEX_FILE=<tmp> git update-index --cacheinfo 100644,<blob-sha>,<path>
```

## 配方 4：pathspec 重提（混合 index 场景）

staging 区含他方 staged 改动、自己的改动在工作区时，**禁止裸 `git commit`**：

```bash
git commit <你的文件...>
```

untracked 文件先 `git add <file>` 再列入 pathspec；同文件交叠回到配方 1。交叠判定不能依赖开工时的 `git status`——每次 pathspec 提交前逐 hunk 核查归属：

```bash
git diff <baseline> -- <path>
```

陌生内容 = 外来源 hunk，回到配方 1。本 repo 额外一步：pathspec commit 会触发全仓 pre-commit，他方在途改动一红就挡住提交；此时不要 `--no-verify`，等对方停滞或按配方 1 走 plumbing 并事后补跑门禁。

## 复评触发

- worktree 纪律稳定、竞态未再触发 → 评估把本文件降级为 archive。
- 反复触发 → 先修 worktree 执行纪律，而不是把应急路径常态化。
