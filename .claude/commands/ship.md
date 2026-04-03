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

Use `gh pr create` with a fully filled-out description. Do NOT use `--fill` — write the description properly:

- **Title**: `{conventional-commit-type}: {description} [WALLET-XX]`
- **Body**: fill the PR template sections:
  - Summary: 2-4 sentences describing what changed and why
  - Linear issue link: `https://linear.app/walletai/issue/WALLET-XX`
  - Type of change: check the right box
  - How to test: concrete steps
  - Financial invariants section: include only if services/ledger/tools were touched
  - Checklist: all boxes checked (you verified them in step 2)

```bash
gh pr create --title "..." --body "$(cat <<'EOF'
...
EOF
)"
```

## 6. Update Linear

Call `save_issue` to set the Linear issue state to "In Review".

## 7. Output

Return the PR URL so the user can open it immediately.
