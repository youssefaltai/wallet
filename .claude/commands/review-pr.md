Review the current branch's pull request, or a specific PR if a number is provided as $ARGUMENTS.

## 1. Identify the PR

```bash
# If $ARGUMENTS is a PR number, use it. Otherwise, use the current branch.
gh pr view ${ARGUMENTS:-""} --json number,title,body,files,additions,deletions,commits,baseRefName,headRefName,statusCheckRollup,reviews
gh pr diff ${ARGUMENTS:-""}
```

Note which **domains** the changed files touch — this determines which checks apply.

## 2. Check CI

```bash
gh pr checks ${ARGUMENTS:-""} 2>/dev/null || echo "(no CI configured)"
```

## 3. Apply domain-specific review checks

Work through every applicable check. Read the actual diff lines — don't guess.

**If `src/lib/services/` or `src/lib/ai/tools/` changed — Financial invariants:**
- All balance mutations go through `createJournalEntry` in `ledger.ts`? (no direct `db.insert(journalLines)` or `db.update(accounts)`)
- Every multi-step write wrapped in `db.transaction()`?
- Every query scoped to `userId`? (no bare `where(eq(table.id, id))` without AND userId)
- No cached FX rates on write operations?
- Monetary values converted with `toMinorUnits()`/`toMajorUnits()` at every boundary?
- New service functions: `userId` is the second parameter?

**If `src/app/api/` changed — API route correctness:**
- Every HTTP method (GET, POST, PUT, PATCH, DELETE) checks auth before any logic?
- Write methods call `rateLimit()`?
- No stack traces or internal error messages in responses?
- All inputs validated (UUID format, type, length)?
- Correct HTTP status codes (401 unauth, 403 forbidden, 404 not found, 400 bad input)?

**If `src/lib/auth.ts` or `src/app/(auth)/` changed — Auth correctness:**
- Auth errors use typed error classes (like `RateLimitError extends CredentialsSignin`), not raw `null` returns?
- Rate limiting present on login/signup?
- No sensitive data (passwords, tokens) in logs or responses?

**If `src/lib/db/schema.ts` or migrations changed — Migration safety:**
- No unintended `DROP COLUMN` or `DROP TABLE`?
- New `NOT NULL` columns have `DEFAULT` values?
- FK columns have corresponding indexes?
- Migration SQL file is in `_journal.json`?

**If `src/components/` or `src/app/(app)/` changed — UI correctness:**
- No DB or service imports in `"use client"` files?
- `cachedAuth()` used instead of raw `auth()` in Server Components and actions?
- Dashboard (`src/app/(app)/dashboard/`) has no mutation buttons added?
- `useEffect` data fetches have `AbortController` cleanup?

**Always check:**
- No `: any` type annotations or `@ts-ignore` suppressions?
- No `as unknown as SomeType` double-casts?
- No `.env*` file changes?
- If behavior changed: does it need a new E2E test in `tests/`?

## 4. Output a structured review

```
## PR Review: [title] (#number)

### Summary
[2-3 sentences on what this change does and why]

### Issues Found

#### CRITICAL (block merge)
- [issue description] — [file:line]

#### HIGH (should fix before merge)
- ...

#### MEDIUM (consider addressing)
- ...

#### LOW (optional)
- ...

### Clean areas
- [list what checked out fine]

### Verdict: APPROVE / REQUEST CHANGES / COMMENT
[One sentence rationale]
```

If no issues found: state "No issues found — ready to merge." explicitly.
