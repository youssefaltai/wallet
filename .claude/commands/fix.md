Fix the following issue: $ARGUMENTS

## Step 1: Linear (orchestrator)

Search Linear for the issue by keyword or WALLET-ID (`list_issues`):
- If found: call `save_issue` to set state to **"In Progress"**
- If not found: create it (`save_issue`) with appropriate title, priority, and labels, then set to In Progress
- Note the **WALLET-XX** identifier

## Step 2: Preflight (orchestrator)

**Before touching git, verify this cwd is safe to branch in.** Two checks, both MUST pass:

### 2a. Working tree is clean
```bash
git status --porcelain
```
If there is ANY output (modified, staged, or untracked-but-tracked-by-gitignore files), STOP. Do not `git checkout`. A concurrent session may be editing in this cwd, or a prior session left work behind. Report to the user and ask which of these applies:
- Work belongs to a different branch → commit/stash on that branch first
- Work was mid-implementation here → finish it before switching
- Unknown → run `git diff` and let the user decide

### 2b. No concurrent Claude session
Check the SessionStart context at the top of this conversation for a `⚠️  CONCURRENT CLAUDE SESSION DETECTED` warning. If present, DO NOT run `git checkout main`. Instead, use a worktree (see Step 3 alternative).

## Step 3: Branch (orchestrator)

**Default path — single-session cwd, clean tree:**
```bash
git checkout main && git pull
git checkout -b fix/WALLET-{number}-{short-description}
```

**Alternative — worktree (use when another session is active, or the user is running parallel tasks):**
```bash
git worktree add ../wallet-WALLET-{number} -b fix/WALLET-{number}-{short-description} main
cd ../wallet-WALLET-{number}
```
Tell the user the worktree path. All subsequent work happens in the worktree, not the main checkout.

**Scope lock:** this branch exists to fix exactly the problem described in the Linear issue. Any other bug or improvement discovered during the fix must be filed as a new Linear issue and handled on a separate branch. Never add unrelated changes to a fix branch.

## Step 4: Fix — dispatch `fixer` agent

Dispatch the **`fixer`** agent with:
- The issue description (title + full details from Linear)
- The WALLET-XX identifier

The fixer reads the code, traces the root cause, and implements the minimal fix.

## Step 5: Validate — dispatch `checker` agent

Dispatch the **`checker`** agent.

If any gate fails: return failures to the user and wait for resolution before proceeding.

## Step 6: Ship

Dispatch in sequence:

1. **`shipper`** agent — push branch + open PR. Receive PR number and URL.
2. Call `save_issue` to set Linear state to **"In Review"**.
3. **`reviewer`** agent — review the PR and submit GitHub review.

## Step 7: Return

Output:
- PR URL
- Review verdict
- Next actions (e.g. "update the E2E test on line 271 and push")

After the PR merges: call `save_issue` to set the Linear issue to **Done**.
