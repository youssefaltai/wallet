Push the current branch and open a Pull Request.

## 1. Guard rails

- If on `main`: stop. Remind the user to create a branch first (`git checkout -b {type}/WALLET-XX-description`). Do not proceed.
- If working tree has uncommitted changes: stage and commit them first with a conventional commit message before pushing.

## 2. Validate

Run all quality gates via `/check` — stop and report if any fail. The gates are:

1. `pnpm tsc --noEmit` — zero errors
2. `pnpm lint` — zero errors and warnings
3. Migration check: compare `.sql` files in `src/lib/db/migrations/` against `meta/_journal.json` — flag any untracked SQL files
4. Financial invariant spot-check (from `/check`) — no direct balance updates, no hard journal deletes

## 3. Determine context

- Get current branch name: `git branch --show-current`
- Extract the Linear issue ID from the branch name (e.g. `fix/WALLET-5-overdraft` → `WALLET-5`)
- Get a summary of what changed: `git log main..HEAD --oneline`
- Get the diff stat: `git diff main..HEAD --stat`

## 4. Push

```bash
git push -u origin HEAD
```

## 5. Open the PR

Use `gh pr create` with all metadata filled out. Do NOT use `--fill` — write everything properly.

**Title**: `{conventional-commit-type}: {description} [WALLET-XX]`

**Labels** — apply all that fit:
| Label | When |
|-------|------|
| `bug` | Fix for broken behaviour |
| `enhancement` | New user-facing capability |
| `security` | Auth, authz, secrets, injection |
| `auth` | Authentication or session changes |
| `ai` | AI tools, system prompt, LLM integration |
| `database` | Schema, migrations, queries, indexes |
| `ui` | Components, layouts, CSS, accessibility |
| `performance` | Query optimisation, render speed, bundle |
| `tech-debt` | Refactors, audit fixes, test coverage |
| `documentation` | Docs, comments, CLAUDE.md |

**Body** — fill every section:
- Summary: 2-4 sentences on what changed and why
- Linear issue link: `https://linear.app/walletai/issue/WALLET-XX`
- Type of change: check the right box
- How to test: concrete steps a reviewer can follow
- Financial invariants: include only if services/ledger/tools were touched
- Checklist: all boxes checked

```bash
gh pr create \
  --title "..." \
  --assignee youssefaltai \
  --reviewer youssefaltai \
  --label "bug,security" \
  --body "$(cat <<'EOF'
...
EOF
)"
```

## 6. Update Linear

Call `save_issue` to set the Linear issue state to "In Review".

## 7. Self-review

Immediately run `/review-pr` on the PR that was just opened.

This is not optional — every PR Claude opens must have a review submitted before the human sees it. The self-review catches regressions, stale tests, and scope creep that quality gates don't catch.

If the self-review finds CRITICAL or HIGH issues: request changes on the PR, fix them on the branch, push, and re-review.

## 8. Output

Return the PR URL and the review verdict so the user can see both at once.
