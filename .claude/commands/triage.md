Audit the codebase for issues and create a Linear issue for each finding. Linear is the single source of truth — no findings are tracked in files.

## Steps

### 1. Run the audit

Invoke the auditor agent to scan all 13 domains. This produces a live list of findings from the actual current code — not a static document.

### 2. Fetch Linear state

- Call `list_teams` and `list_projects` to get the Wallet team and project IDs
- Call `list_issues` to get all existing Wallet issues
- Call `list_issue_statuses` to get state IDs (Backlog, Todo, In Progress, Done, Cancelled)
- Call `list_issue_labels` to get label IDs; create any missing labels (bug, security, ai, database, ui, performance, tech-debt, feature) via `create_issue_label`

### 3. Deduplicate

For each finding from the audit, check whether a Linear issue already exists by searching titles for the finding's description keywords. Skip any that already exist (open or done).

### 4. Create issues for new findings

For each finding NOT already in Linear, call `save_issue` with:
- **Title**: concise description (≤70 chars)
- **Description**: full finding detail — what's wrong, why it matters, exact file:line references
- **Priority**: Urgent (critical) / High / Medium / Low
- **Labels**: appropriate labels from above
- **State**: Backlog
- **Project**: Wallet

### 5. Report

List every issue created with its Linear ID and title. List any skipped (already existed). Give a count summary.

## Notes

- Run this whenever a fresh audit pass is needed — it's fully idempotent
- Do not maintain any issue list in files; Linear is the tracker
- Resolved issues should be closed in Linear directly via `save_issue` (set state to Done or Cancelled)
