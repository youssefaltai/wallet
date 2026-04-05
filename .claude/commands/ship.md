Push the current branch and open a Pull Request.

## Guard rails (orchestrator)

- If on `main`: stop. Branch first — `git checkout -b {type}/WALLET-XX-description`.
- If uncommitted changes exist: stage and commit them with a conventional commit message before dispatching.

## Step 0: PR Hygiene Pre-flight (orchestrator — MANDATORY, runs before everything else)

This step enforces the single-responsibility principle. Complete all checks and stop if any fail.

### 0a. List every commit on this branch
```bash
git log main..HEAD --oneline
```
Read every commit. Do they tell a single coherent story? If you see commits that belong to a different purpose, stop — run `/split-pr` before proceeding.

### 0b. Categorize changed files by concern
```bash
git diff main...HEAD --stat
```
Group each file under one of: database, service layer, AI tools, API routes, UI, auth, config.

Ask: **"Do all changed files serve the same goal?"**

Acceptable: one cohesive feature touching multiple layers (schema + service + UI + tests are all part of the same feature).

Not acceptable: a bug fix + an unrelated refactor, two separate features bundled, "while I was in here" additions.

If the answer is NO — stop. Do not proceed. Tell the user which concerns are mixed and instruct them to run `/split-pr`.

### 0c. Check branch name still matches the work
Does the branch name accurately describe what the PR does? If scope drifted, note it and ask the user whether to rename or split.

### 0d. Check for dirty commits
```bash
git log main..HEAD --oneline | grep -iE '\b(wip|fixup|debug|temp|todo|hack|tmp)\b'
```
Any match → squash or drop those commits before continuing.

### 0e. Confirm SRP passes
State explicitly: "All changes on this branch serve a single purpose: {state the purpose}." Then proceed.

## Step 1: Validate — dispatch `checker` agent

Dispatch the **`checker`** agent. If any gate fails, stop and return the failures. Do not proceed until all gates are green.

## Step 2: Gather context (orchestrator)

```bash
git branch --show-current          # branch name → extract WALLET-XX
git log origin/main..HEAD --oneline   # change summary (use origin/main — local main may be ahead)
git diff origin/main..HEAD --stat     # diff stat
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
