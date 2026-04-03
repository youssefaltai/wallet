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

## What NOT to Do

- Don't `git push --force` to main
- Don't merge your own PR without CI passing
- Don't open a PR without filling in the template
- Don't leave branches open after merge
- Don't commit directly to main, ever
