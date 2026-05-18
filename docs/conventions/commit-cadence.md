# Commit Cadence (并行 agent 安全)

> **何时加载**: 当你正在并行多 agent 的 worktree 里改代码、即将 commit / push / amend、或想知道 stage 哪些文件时。
> AGENTS.md 只留一行指针;详细规则在此文档。

## 核心原则

这个仓库里可能同时有多个 agent / 用户在同一 worktree 工作。**未提交的改动随时可能被其它 agent 的 `git add -A` / 工具刷新 / 重写覆盖掉**。所以提交节奏与隔离比"漂亮的 git history"更重要。

## 五条规则

### 1. 每完成一个原子任务立即 commit

"原子任务" = 一个 hook 抽取、一个 bug fix、一个独立 feature slice、一个文档段落消化。

验证全绿(`lint` / `tsc --noEmit` / `vitest` / `build`)立刻 commit,不要攒成一大堆。攒 batch 的风险:
- 其它 agent 跑 `git add -A` 把你未提交的 in-progress 改动一起提交进他的 commit
- 文件被工具(prettier hook / codegen / sync 脚本)刷新,你的改动丢失
- IDE / format-on-save 改写文件,产生看不见的冲突

### 2. 同任务后续修复优先 amend 原 commit

发现同一任务里有 bug 或漏改,**不要**新开一个独立 commit。两种处理方式:

- **未 push**: `git add <paths> && git commit --amend --no-edit`
- **已 push 但还在自己分支顶端**: 同上,然后 `git push --force-with-lease`
- **任务边界已跨越**(后面又有别的 commit): 用 `git commit --fixup=<sha>` 紧跟 fixup commit,后续 rebase 时 `git rebase -i --autosquash` 自动合并

理由: 每个 commit 对应一个原子任务,history 干净,review/revert 边界清晰。"feat X" + 5 个 "fix typo in X" 散落 commit 是反模式。

### 3. push 后改写历史用 `--force-with-lease`,绝不用 `--force`

**注意：这只适用于改写历史（amend、rebase、squash 等）的场景。新增 commit 一律用普通 `git push`，不要带 `--force-with-lease`。**

`--force-with-lease` 会在 remote ref 与你 fetch 的 ref 不一致时拒绝(防止把别人的新 commit 推没了)。`--force` 不做这个检查,会盲覆盖。

```bash
git push --force-with-lease origin <branch>
```

### 4. 新增 commit 用普通 `git push`（不是 force push）

```bash
# ✅ 正确：新增 commit
git push

# ❌ 错误：新增 commit 还用 force push
git push --force-with-lease
```

理由：`--force-with-lease` 的语义是「我知道我重写了历史，请确保没覆盖别人」。新增 commit 没有重写历史，用它反而是多余的——而且会掩盖你应该先 `git pull --rebase` 再 push 的正确流程。

### 5. stage 时显式列出自己改的文件,绝不 `git add -A` / `git add .`

```bash
# ✅ 正确
git add src/hooks/foo.ts src/hooks/foo.test.ts src/components/Bar.tsx

# ❌ 错误 (会把并行 agent 的未提交改动一起 stage)
git add -A
git add .
git add --all
```

如果不确定自己改了哪些文件,先看 `git status --short`,把带 ` M ` / ` D ` / `??` 前缀但**不是你改的**那些挑出来排除掉,只 add 自己的。

### 6. 绝不还原他人的未提交改动

worktree 里出现的非己出改动一律**不动**:
- 不 `git checkout -- <file>` 还原它
- 不 `git restore` 它
- 不 `git stash` / `git reset --hard`(参考 AGENTS.md Git safety)
- 不"顺手清理"
- 不替他人 commit(除非用户当面要求)

只 stage 并 commit 自己改的路径。其它 agent 自会在他的 session 里处理他的改动。

## 工作流速查

```bash
# 一次 commit 的标准流程
npm run lint && npx tsc --noEmit && npm test -- --run && npm run build
git add <自己改的具体路径>
git commit -m "type(scope): message"

# 新增 commit，普通 push
git push

# 同任务发现问题,amend
git add <修改路径>
git commit --amend --no-edit
# 若已 push:
git push --force-with-lease

# 跨任务发现问题,fixup
git add <修改路径>
git commit --fixup=<原 commit sha>
# 后续整理:
git rebase -i --autosquash <base>
```

## 反例(不要这么做)

```bash
# ❌ 反例 1: 一次 commit 跨多个任务
git add -A
git commit -m "wip: extract hooks + fix tooltip + add deficit display"

# ❌ 反例 2: 同任务的小修拆 commit
# c1: feat: extract useFooHook
# c2: fix: typo in useFooHook
# c3: fix: another typo in useFooHook
# 应该: 把 c2/c3 amend 进 c1

# ❌ 反例 3: 帮别人 commit
git add src/foo/agent_b_was_editing.ts  # 别人改了一半,别帮他提
git commit -m "..."
```
