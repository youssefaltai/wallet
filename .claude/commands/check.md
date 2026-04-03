Run all quality gates on the current codebase state.

Execute each step in order and report results:

1. **TypeScript**: Run `pnpm tsc --noEmit`
   - Report: ✓ clean, or list all errors with file:line references

2. **Lint**: Run `pnpm lint`
   - Report: ✓ clean, or list all warnings/errors

3. **Migration sync**: Compare `src/lib/db/migrations/*.sql` file count against entries in `src/lib/db/migrations/meta/_journal.json`
   - Report: ✓ N migrations applied, or ⚠️ unapplied migrations detected

4. **Uncommitted changes**: Run `git status --short`
   - Report: list of modified/untracked files

5. **E2E tests** (if `tests/` exists): Run `pnpm test:e2e`
   - Report: ✓ all passing, or list failing tests
   - Skip this step only if no tests exist yet

6. **Financial invariant spot-check**: Grep the codebase for these red-flag patterns:
   - `db.update(accounts)` outside of ledger.ts — direct balance updates
   - `db.insert(journalLines)` outside of ledger.ts — bypassing ledger engine
   - Any `.delete(journalLines)` that lacks a `deletedAt` check — hard deletes
   - Report: ✓ no violations, or list violations with file:line

Report everything. Do not stop at the first failure — run all checks and give a complete picture.

If all checks pass, you're ready to run `/ship` to push the branch and open a PR.
If anything fails, list what needs to be fixed before shipping.
