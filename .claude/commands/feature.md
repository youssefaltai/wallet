Plan and implement a new feature: $ARGUMENTS

## Phase 1: Plan + Linear (parallel)

Dispatch these two in **parallel**:

**A. Dispatch `planner` agent** with the feature description.
Receives: structured plan with appetite, approach, files changed, migration required, rabbit holes, definition of done.

**B. Linear lookup (orchestrator):** Call `list_teams`, `list_projects`, `list_issue_statuses`, `list_issue_labels`, `list_issues` to prepare for issue creation.

Wait for both to complete. Present the plan to the user and **wait for confirmation** before proceeding.

## Phase 2: Linear issue + branch (orchestrator)

After confirmation:

**Scope lock:** once the branch is created in this step, its scope is fixed to the approved plan. Any other problem or improvement discovered during implementation must be filed as a separate Linear issue and handled on a separate branch — never added to this branch. "While I was in here" additions are the root cause of messy PRs.

1. Call `save_issue` with:
   - Title: ≤70 chars
   - Description: plan summary (appetite, files, done criteria)
   - Priority: Medium (High if retention-critical)
   - Label: `feature`
   - State: In Progress
   - Note the **WALLET-XX** identifier

2. **Preflight**: verify this cwd is safe to branch in. Both checks MUST pass before running any `git checkout`:
   - **Working tree is clean**: `git status --porcelain` must produce zero output. If not, STOP and ask the user whether the pending work belongs elsewhere.
   - **No concurrent Claude session**: if the SessionStart context shows `⚠️  CONCURRENT CLAUDE SESSION DETECTED`, use the worktree alternative below instead of `git checkout`.

3. Create the branch.

   **Default path — single-session cwd, clean tree:**
   ```bash
   git checkout main && git pull
   git checkout -b feat/WALLET-{number}-{short-description}
   ```

   **Worktree alternative — use when another session is active or the user is running parallel tasks:**
   ```bash
   git worktree add ../wallet-WALLET-{number} -b feat/WALLET-{number}-{short-description} main
   cd ../wallet-WALLET-{number}
   ```
   Tell the user the worktree path. All subsequent implementation happens there.

## Phase 3: Migration (if required)

If the plan indicates a DB migration is needed:

Dispatch the **`migrator`** agent with the schema change description from the plan. Wait for it to complete before dispatching the implementer — the implementer depends on the schema being in place.

## Phase 4: Implementation — dispatch `implementer` agent

Dispatch the **`implementer`** agent with:
- The full plan from phase 1
- The branch name
- The WALLET-XX identifier
- Whether migration was already applied (yes/no)

## Phase 5: Validation — dispatch `checker` agent

Dispatch the **`checker`** agent.

If any gate fails: return failures to the user and wait for resolution before proceeding.

## Phase 6: Ship

Dispatch the **`shipper`** agent with branch name, WALLET-XX, and change summary.
Receive: PR number and URL.

Then call `save_issue` to set Linear state to **"In Review"**.

Then dispatch the **`reviewer`** agent with the PR number.

## Phase 7: Return

Output:
- PR URL
- Review verdict
- What needs to happen for the PR to merge (if any review issues)
