---
description: PR hygiene — one PR one purpose, SRP enforcement, pre-ship checklist, split-pr guidance
paths: ["**"]
---

# PR Hygiene

## The Core Rule: One PR = One Logical Change

A PR must answer a single question: "What problem does this solve?" If the answer contains "and" describing two unrelated problems, the PR must be split.

**Single Responsibility Principle for PRs:** every file changed in the diff must serve the same goal. A PR that fixes a bug should not also add a feature. A PR that refactors a service should not also fix a UI issue.

## What Makes a Commit Belong on a PR

A commit belongs on the current branch if and only if:

1. It directly implements, tests, or prepares the stated purpose of the branch
2. It would be meaningless (or wrong) to apply it without the other commits on this branch
3. The branch name still accurately describes the cumulative change after adding this commit

If any of these are false, the commit belongs on a different branch.

## Pre-Ship Mental Model

Before running `/ship`, visualize the PR diff as a single reviewer will see it. Ask:

> "If I read this diff cold, would every changed line point at the same goal?"

If any file looks out of place — if you find yourself thinking "that's just a small thing I noticed" — it doesn't belong here. File a Linear issue, handle it separately.

## Pre-Ship Checklist (Claude must complete before /ship)

Run these steps in order. Stop at the first failure.

### 1. List every commit on this branch
```bash
git log main..HEAD --oneline
```
Each commit should tell one piece of the same story. If you see commits from different stories, stop — use `/split-pr`.

### 2. Categorize changed files by concern
```bash
git diff main...HEAD --stat
```
Map each changed file to a concern:
- `src/lib/db/schema.ts`, `migrations/` → **database**
- `src/lib/services/` → **service layer**
- `src/lib/ai/tools/` → **AI tools**
- `src/app/api/` → **API routes**
- `src/app/(app)/` or `src/components/` → **UI**
- `src/app/(auth)/` → **auth**
- `.claude/`, `AGENTS.md`, `CLAUDE.md` → **config**

If more than one concern is present: stop and ask — do they serve a single cohesive goal, or are they separate features/fixes?

### 3. SRP gate — ask explicitly
"Do all changes in this diff serve a single purpose?"

Acceptable multi-concern PRs (rare):
- A new feature that naturally requires schema + service + UI + AI tool changes (they're all part of the same feature)
- A refactor that touches multiple files in the same layer

Unacceptable:
- A bug fix + an unrelated refactor
- A feature + a separate bug fix noticed during implementation
- Schema change + UI change for different features
- Any "while I was in here" additions

### 4. Branch name match
Does the branch name still accurately describe what the PR does? If the scope drifted during implementation, either rename the branch or split it.

### 5. No dirty commits
```bash
git log main..HEAD --oneline | grep -iE '\b(wip|fixup|debug|temp|todo|hack|tmp)\b'
```
Any matches must be squashed or dropped before shipping.

### 6. No unrelated file changes
Check `git diff main...HEAD --name-only` for:
- Files that belong to a different feature area
- Config/migration changes that weren't part of the stated purpose
- Test files for code not touched in this PR

If found: stash the unrelated changes, commit them to a new branch, open separate PR.

## SRP Violation Examples

### BAD — bug fix + refactor mixed
```
feat/WALLET-42-dashboard-cards
  src/app/(app)/dashboard/cards.tsx    ← dashboard feature
  src/lib/services/transactions.ts    ← unrelated refactor noticed during impl
  src/app/(auth)/login.tsx            ← unrelated bug fix noticed during impl
```
Fix: cherry-pick the dashboard changes to `feat/WALLET-42`, put the service refactor on `refactor/WALLET-XX`, put the login fix on `fix/WALLET-XX`.

### BAD — multiple features bundled
```
feat/WALLET-50-bulk-operations
  src/lib/ai/tools/bulk-delete.ts     ← bulk delete feature
  src/lib/ai/tools/export-csv.ts      ← separate export feature
  src/lib/services/goals.ts           ← unrelated goal fix
```
Fix: three separate branches, three PRs.

### GOOD — cohesive feature
```
feat/WALLET-42-recurring-transaction-detection
  src/lib/services/transactions.ts    ← detection logic
  src/lib/ai/tools/detect-recurring.ts ← AI tool wrapping it
  src/app/api/chat/route.ts           ← tool registered in route
  tests/e2e/recurring.spec.ts         ← E2E for the feature
```
All files serve "recurring transaction detection". This is correct.

## Handling "Oops, I Mixed Changes"

If you're mid-implementation and realize the branch has mixed concerns:

**Option A — uncommitted work is separate:**
```bash
git stash                      # stash the unrelated work
# now branch only has the original purpose
git add <relevant files>
git commit -m "..."
# then: git checkout main && git checkout -b new-branch && git stash pop
```

**Option B — already committed, need to split:**
Use `/split-pr` — it walks through cherry-picking commits onto new branches.

**Option C — small stray change, not yet committed:**
Just don't stage it. Leave it unstaged, move on. File a Linear issue to track it.

## Branch Scope Lock

When a branch is created (via `/feature` or `/fix`), its scope is locked:

- The branch exists to solve exactly the problem described in its Linear issue
- Any other problem discovered during implementation gets its own Linear issue and its own branch
- "I'll just fix this while I'm here" is the root cause of messy PRs — never do it

## Commit Message Discipline

Commits on a branch should tell the story of how the solution evolved:

```
feat: add detectRecurring query in transactions service
feat: wrap detection logic in AI tool with recurrence metadata
test: add E2E covering monthly recurring detection
```

Not:
```
fix stuff
WIP
done
also fixed the login thing
```

Each commit message should complete the sentence: "If applied, this commit will..."
