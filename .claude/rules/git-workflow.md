---
description: Git workflow — branch strategy, PR conventions, commit rules, merge policy
paths: ["**/*"]
---

# Git Workflow

## The One Rule: Main is Always Deployable

**Never commit directly to `main`.** Every change — feature, fix, chore — goes through a branch and a PR. Main only moves forward via squash merges from PRs that have passed CI.

## Starting Any Piece of Work

Before touching a single file:

```bash
git checkout main
git pull
git checkout -b {type}/WALLET-{number}-{short-description}
```

If on main with uncommitted changes, stash first:

```bash
git stash
git checkout -b {type}/WALLET-{number}-...
git stash pop
```

## Parallel Work — One Session Per Working Directory

**Never run two Claude sessions in the same working directory.** Git state is shared: one session's `git checkout` silently auto-stashes the other's uncommitted work onto the wrong branch (see WALLET-41 for the incident).

**When parallel work is needed, use a worktree per task** instead of the `git checkout -b` above:

```bash
git worktree add ../wallet-WALLET-{number} -b {type}/WALLET-{number}-{description} main
cd ../wallet-WALLET-{number}
# all subsequent work — implementation, tests, ship — happens inside the worktree
```

After the PR merges, clean up:
```bash
git worktree remove ../wallet-WALLET-{number}
```

**How to know when a worktree is required:** the SessionStart hook emits a `⚠️  CONCURRENT CLAUDE SESSION DETECTED` block in the session context when a sibling session is active in this cwd. Both `/fix` and `/feature` have a preflight step that forbids `git checkout main` when that warning is present — they use the worktree path instead. Sub-agents dispatched from those commands inherit the same rule: if the warning is in the session context, don't touch shared-cwd branches.

## Branch Naming

Format: `{type}/WALLET-{number}-{kebab-description}`

| Type | When |
|------|------|
| `feat/` | New user-facing capability |
| `fix/` | Bug fix |
| `refactor/` | Code restructure, no behaviour change |
| `chore/` | Deps, config, tooling, migrations |
| `test/` | Tests only |
| `docs/` | Documentation only |

Examples:
- `feat/WALLET-42-recurring-transaction-detection`
- `fix/WALLET-5-overdraft-prevention`
- `chore/WALLET-29-idempotency-key-uuid`

## Commits on Branches

Use conventional commits. Be descriptive — commits on a branch tell the story of how the fix/feature evolved:

```
feat: add resolveCrossAmounts helper in money.ts
feat: use helper in createTransaction cross-currency block
feat: use helper in fundGoal and withdrawFromGoal
test: add E2E for cross-currency goal funding
```

Don't include the Linear ID on individual commits — it goes in the PR title and the final squash merge commit.

## Opening a PR

Use `/ship` — it validates, pushes the branch, and opens the PR via `gh pr create`.

PR title format: `{type}: {description} [WALLET-XX]`

Examples:
- `feat: add recurring transaction detection [WALLET-42]`
- `fix: prevent overdraft on concurrent fund operations [WALLET-5]`

Fill in the PR template fully. Reviewers and future-you will thank you.

## CI

Every PR runs:
- `pnpm tsc --noEmit`
- `pnpm lint`

CI must be green before merging. Never merge a red PR.

## Merge Strategy

**Always squash merge.** One clean commit per PR on main. GitHub sets the squash commit message to the PR title automatically — this is why the PR title must follow conventional commit format.

Delete the branch after merge.

## Linear Integration

- Branch name encodes the Linear issue ID → Linear auto-links the PR
- `/ship` sets the Linear issue to "In Review" when it opens the PR
- `/fix` and `/feature` set the issue to "Done" after the PR merges
- Issues move: Backlog → In Progress (when branch created) → In Review (when PR opened) → Done (when merged)

## PR Review Process

Every PR must receive a formal GitHub review before it can be merged. "Formal" means an actual `gh pr review` submission — not just a text summary in the conversation.

**Verdict rules:**

| Finding | Review action |
|---------|--------------|
| Any CRITICAL or HIGH issue | `gh pr review {number} --request-changes --body "..."` |
| Only MEDIUM or LOW issues | `gh pr review {number} --comment --body "..."` |
| No issues found | `gh pr review {number} --approve --body "..."` |

**Self-review on `/ship`:** Every time `/ship` opens a PR, it immediately runs `/review-pr` on that PR. Claude reviews its own work before the human sees it. If the self-review finds CRITICAL/HIGH issues, fix them on the branch, push, and re-review before surfacing the PR URL to the user.

**Re-review after changes:** When a PR author addresses requested changes, run `/review-pr` again to confirm resolution and update the verdict.

**Never merge a PR with an open "request changes" review** — even if CI is green. Resolve or dismiss the review first.

## What NOT to Do

- Don't `git push --force` to main
- Don't merge your own PR without CI passing
- Don't open a PR without filling in the template
- Don't leave branches open after merge
- Don't commit directly to main, ever
- Don't leave a review as just conversation text — always submit it to GitHub with `gh pr review`
