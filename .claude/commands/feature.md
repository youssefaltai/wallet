Plan and implement a new feature: $ARGUMENTS

## Phase 1: Plan

Invoke the planner agent:
- Retention value of this feature?
- Appetite (1 day / 1 week / 2 weeks)?
- What files change?
- What are the risks and rabbit holes?
- What does "done" look like?

Show the plan and **wait for confirmation** before proceeding.

## Phase 2: Linear issue

Create the issue before writing any code:

1. `list_teams` + `list_projects` → get Wallet project ID
2. `list_issue_statuses` → get "In Progress" state ID
3. `list_issue_labels` → find `Feature` label ID
4. `save_issue`:
   - Title: concise (≤70 chars)
   - Description: plan summary — appetite, files, done criteria
   - Priority: Medium (High if retention-critical)
   - Label: Feature
   - State: In Progress
5. **Note the identifier** — e.g. `WALLET-42`

## Phase 3: Branch

```bash
git checkout main && git pull
git checkout -b feat/WALLET-{number}-{short-description}
```

## Phase 4: Implement

1. If DB migration needed: run `/migrate <description>`
2. Implement in dependency order: schema → services → AI tools / API routes → UI → tests
3. After each file: wait for TypeScript hook — fix errors before moving on
4. Commit incrementally with conventional commit messages as you go

## Phase 5: Test

Write E2E tests:
- Happy path
- Auth check (unauthenticated request rejected)
- Error path (invalid input handled gracefully)

Run: `pnpm test:e2e -- --grep "<feature name>"`

## Phase 6: Ship

Run `/ship` — it validates, pushes the branch, opens the PR, and sets Linear to "In Review".

After the PR merges, set the Linear issue to Done via `save_issue`.
