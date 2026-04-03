Fix the following issue: $ARGUMENTS

## 1. Find or create the Linear issue

- Search Linear via `list_issues` for the issue by keyword or WALLET-ID
- If found: call `save_issue` to set state to "In Progress"
- If not found: create it with appropriate title, priority, and labels, then set to "In Progress"
- **Note the WALLET-XX identifier**

## 2. Branch

```bash
git checkout main && git pull
git checkout -b fix/WALLET-{number}-{short-description}
```

## 3. Understand before touching

- Read every file mentioned in the issue
- Understand the root cause — not just the symptom
- Plan the smallest change that fully resolves it (no scope creep)

## 4. Implement

Make the fix. After each file edit, the TypeScript hook fires automatically — fix any errors before continuing.

## 5. Verify

```bash
pnpm tsc --noEmit   # zero errors
pnpm lint           # zero errors
```

If the fix has testable behaviour: add or update an E2E test in `tests/`.

## 6. Ship

Run `/ship` — validates, pushes the branch, opens the PR with a description of what was broken and how it's fixed, sets Linear to "In Review".

After the PR merges: call `save_issue` to set the Linear issue to Done.
