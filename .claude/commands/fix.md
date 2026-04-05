Fix the following issue: $ARGUMENTS

## Step 1: Linear (orchestrator)

Search Linear for the issue by keyword or WALLET-ID (`list_issues`):
- If found: call `save_issue` to set state to **"In Progress"**
- If not found: create it (`save_issue`) with appropriate title, priority, and labels, then set to In Progress
- Note the **WALLET-XX** identifier

## Step 2: Branch (orchestrator)

```bash
git checkout main && git pull
git checkout -b fix/WALLET-{number}-{short-description}
```

**Scope lock:** this branch exists to fix exactly the problem described in the Linear issue. Any other bug or improvement discovered during the fix must be filed as a new Linear issue and handled on a separate branch. Never add unrelated changes to a fix branch.

## Step 3: Fix — dispatch `fixer` agent

Dispatch the **`fixer`** agent with:
- The issue description (title + full details from Linear)
- The WALLET-XX identifier

The fixer reads the code, traces the root cause, and implements the minimal fix.

## Step 4: Validate — dispatch `checker` agent

Dispatch the **`checker`** agent.

If any gate fails: return failures to the user and wait for resolution before proceeding.

## Step 5: Ship

Dispatch in sequence:

1. **`shipper`** agent — push branch + open PR. Receive PR number and URL.
2. Call `save_issue` to set Linear state to **"In Review"**.
3. **`reviewer`** agent — review the PR and submit GitHub review.

## Step 6: Return

Output:
- PR URL
- Review verdict
- Next actions (e.g. "update the E2E test on line 271 and push")

After the PR merges: call `save_issue` to set the Linear issue to **Done**.
