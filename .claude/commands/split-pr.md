Split a branch with mixed concerns into clean, focused PRs.

Use this when a branch has accumulated changes that belong to more than one logical purpose.

## Step 1: Audit the mixed branch (orchestrator)

```bash
git log main..HEAD --oneline
git diff main...HEAD --stat
```

List every commit and every changed file. Group them into concerns:

```
Concern A — {description}:
  commits: abc1234, def5678
  files: src/lib/services/transactions.ts, tests/e2e/transactions.spec.ts

Concern B — {description}:
  commits: ghi9012
  files: src/app/(app)/dashboard/cards.tsx, src/components/shared/card.tsx
```

If all commits serve a single concern, the branch doesn't need splitting — proceed with `/ship` instead.

Present the concern breakdown to the user and confirm before continuing.

## Step 2: Create a branch for each concern (orchestrator)

For each concern identified in Step 1:

1. Create a Linear issue if one doesn't exist (`save_issue`), note the WALLET-XX ID
2. Create a new branch from main:
   ```bash
   git checkout main
   git checkout -b {type}/WALLET-{number}-{description}
   ```

## Step 3: Cherry-pick commits onto each new branch (orchestrator)

For each new branch, cherry-pick only the commits that belong to that concern:

```bash
git cherry-pick <commit-sha> [<commit-sha> ...]
```

**If cherry-pick has conflicts:**
- Resolve them manually — the conflict means the commits were entangled
- After resolving: `git cherry-pick --continue`
- If the entanglement is deep, consider re-implementing the change cleanly on the new branch instead

**Verify after cherry-pick:**
```bash
git diff main...HEAD --stat
```
Only files belonging to this concern should appear.

## Step 4: Validate each new branch (orchestrator)

Dispatch the `checker` agent for each new branch before shipping:
- TypeScript must pass
- Lint must pass
- Financial invariants intact (if services/ledger touched)

Fix any issues introduced by the split before proceeding.

## Step 5: Clean up the original branch (orchestrator)

Once all new branches are ready and validated:

```bash
# Delete the original mixed branch locally
git branch -d {original-branch-name}

# If already pushed to origin, delete there too
git push origin --delete {original-branch-name}
```

If the original branch already had an open PR, close it with a comment explaining it was split.

## Step 6: Ship each new branch separately (orchestrator)

For each concern branch, dispatch the `shipper` agent to open a PR.

Each PR should be:
- Titled and labeled for its specific concern
- Linked to its own Linear issue
- Fully independent — reviewable without the other PRs

## Step 7: Return (orchestrator)

Output for each new PR:
- PR URL
- WALLET-XX it addresses
- Summary of what it contains

## Edge Cases

**Commits that touch both concerns in one file:**
This means the original commits were too coarse. Options:
1. Use `git add -p` to stage only the relevant hunks before committing to the new branch
2. Re-implement each concern cleanly on its own branch (safest)

**One concern depends on the other:**
File a note in both PRs explaining the dependency. Merge the foundational PR first, then rebase the dependent branch on main before shipping it.

**Already opened a PR for the mixed branch:**
1. Close the original PR with a comment: "Splitting into [PR-A] and [PR-B] for cleaner review"
2. Open the new focused PRs
3. Update the Linear issue to reference the new PRs
