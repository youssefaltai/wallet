Push the current branch and open a Pull Request.

## Guard rails (orchestrator)

- If on `main`: stop. Branch first — `git checkout -b {type}/WALLET-XX-description`.
- If uncommitted changes exist: stage and commit them with a conventional commit message before dispatching.

## Step 1: Validate — dispatch `checker` agent

Dispatch the **`checker`** agent. If any gate fails, stop and return the failures. Do not proceed until all gates are green.

## Step 2: Gather context (orchestrator)

```bash
git branch --show-current          # branch name → extract WALLET-XX
git log main..HEAD --oneline       # change summary
git diff main..HEAD --stat         # diff stat
```

Extract the Linear issue ID from the branch name (e.g. `fix/WALLET-5-overdraft` → `WALLET-5`).

## Step 3: Push and open PR — dispatch `shipper` agent

Dispatch the **`shipper`** agent with:
- Branch name
- Linear issue ID
- Conventional commit type (inferred from branch prefix)
- Summary of changes (from git log)
- Relevant labels (inferred from changed file paths)

Receive: PR number and URL.

## Step 4: Update Linear (orchestrator)

Call `save_issue` to set the Linear issue state to **"In Review"**.

## Step 5: Self-review — dispatch `reviewer` agent

Dispatch the **`reviewer`** agent with the PR number from step 3.

If the reviewer requests changes:
- Fix the issues on the branch
- Commit and push
- Re-dispatch `checker` agent (must pass before re-reviewing)
- Re-dispatch `reviewer` agent

## Step 6: Return

Output:
- PR URL
- Review verdict (APPROVE / REQUEST CHANGES / COMMENT)
- Any action items from the review
