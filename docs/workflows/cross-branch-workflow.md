# Cross-Branch Workflow

**核心规则**：永远不要在当前工作目录执行 `git checkout`/`git switch` 切换分支。所有跨分支操作通过 worktree 或 GitHub API 完成。

## 场景 1：需要向 main 提交改动（main 有分支保护，必须走 PR）
```bash
# 1. 创建 worktree（不会切换当前分支）
git worktree add /tmp/aaveapy-main main
# 2. 在 worktree 中操作
cd /tmp/aaveapy-main
git checkout -b fix/xxx
# 编辑文件、commit
git push -u origin fix/xxx
gh pr create --title "fix: xxx" --body "..." --base main --head fix/xxx
gh pr merge <PR_NUMBER> --squash --auto   # CI 通过后自动合并
# 3. 清理 worktree
cd <original-repo>
git worktree remove /tmp/aaveapy-main
```

## 场景 2：需要从其他分支 cherry-pick 到当前分支
```bash
git cherry-pick <commit-sha>   # 不需要切分支，直接在当前分支操作
```

## 场景 3：需要查看其他分支的文件
```bash
git show main:path/to/file     # 不切分支，直接读取
git diff main..lovable -- path/to/file
```

## 场景 4：需要将 lovable 的改动合入 main
通过 PR：从 lovable 向 main 开 PR，不要本地 merge。

## 场景 5：lovable → dev 同步（避免 DIRTY PR）

lovable 和 dev 需要保持同步。dev 有分支保护（lint + build required checks），应通过 PR 合并。

**标准流程**：
1. 从 lovable 向 dev 开 PR（merge commit 方式，不要 squash）
2. 启用 auto-merge：`gh pr merge <PR_NUMBER> --merge --auto`
3. CI 通过后自动合并

**如果 PR 报 DIRTY（有合并冲突）**：
1. 在 lovable 分支上合并 dev 解决冲突：`git merge origin/dev`
2. 解决冲突后 commit + push lovable
3. PR 自动变为 CLEAN，auto-merge 正常执行

**禁止的操作**：
- ❌ 不要用 worktree 直接 merge + push 绕过 PR（违反 dev 分支保护规则）
- ❌ 不要用 squash merge 同步 lovable→dev（会丢失历史连通性，导致下次同步更容易 DIRTY）
- ❌ 不要攒大量 commit 才同步（减少冲突概率）

**为什么用 merge commit 而不是 squash**：dev 和 lovable 的 commit 历史不同源（dev 有早期 Lovable 平台自动 commit），squash 会进一步割裂历史，使后续 PR 更容易 DIRTY。merge commit 保持双向可追踪。
